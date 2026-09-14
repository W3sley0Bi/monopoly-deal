import { useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomView } from '../types';
import { useI18n } from '../i18n';

/**
 * The coach for a scripted tutorial table.
 *
 * The server owns the curriculum: which lesson you are on, what is on the
 * table for it, and whether you have done the thing. That is the half that has
 * to agree with the rules. This file owns the half that does not — the words,
 * what to point at, and which gesture to mime — because a mouse and a finger
 * are taught differently and the server has no idea which one you have.
 */

interface Hint {
    /** `data-tour` region the lesson is about. */
    anchor?: string;
    /** Narrow screens sometimes need a different anchor. */
    anchorNarrow?: string;
    /** The cards or controls the task is actually about. */
    targets?: string;
    gesture?: 'drag' | 'tap';
}

/** Hand cards that can start a colour set. */
const PROPERTY_IN_HAND =
    '.hand-card[data-card-type="property"], .hand-card[data-card-type="property_wildcard"]';

/** One named action card in hand, rather than every action you happen to hold. */
const action = (name: string) => `.hand-card[data-card-action="${name}"]`;

/**
 * Where each lesson points. Keyed by the lesson id the server sends, so adding
 * a lesson in Go without a hint here degrades to a centred card rather than
 * breaking.
 */
const HINTS: Record<string, Hint> = {
    hand: { anchor: 'hand', targets: '.hand-card' },
    property: { anchor: 'properties', targets: PROPERTY_IN_HAND, gesture: 'drag' },
    wildcard: {
        anchor: 'properties',
        targets: '.hand-card[data-card-type="property_wildcard"]',
        gesture: 'drag',
    },
    // Dragging is not the only way in: every card opens a menu when it is
    // clicked or tapped, so the lesson points at the card and mimes a tap.
    tapping: { anchor: 'hand', targets: PROPERTY_IN_HAND, gesture: 'tap' },
    bank: { anchor: 'bank', targets: '.hand-card[data-card-type="money"]', gesture: 'drag' },
    // An action card is played by putting it in the action space, so that is
    // where the lesson points — lighting the card alone says what to pick up
    // but never where it goes.
    pass_go: { anchor: 'action-space', targets: action('pass_go'), gesture: 'drag' },
    end_turn: { anchor: 'end-turn', targets: '[data-tour="end-turn"]', gesture: 'tap' },
    rent: { anchor: 'action-space', targets: '.hand-card[data-card-type="rent"]', gesture: 'drag' },
    double_rent: {
        // Both halves of the move: the rent and the card that doubles it.
        anchor: 'action-space',
        targets: `.hand-card[data-card-type="rent"], ${action('double_rent')}`,
        gesture: 'drag',
    },
    // A pending action owns the screen, so the coach is a strip and has
    // nothing of its own to point at.
    paying: {},
    just_say_no: {},
    sly_deal: { anchor: 'action-space', targets: action('sly_deal'), gesture: 'drag' },
    forced_deal: { anchor: 'action-space', targets: action('forced_deal'), gesture: 'drag' },
    deal_breaker: { anchor: 'action-space', targets: action('deal_breaker'), gesture: 'drag' },
    house: { anchor: 'action-space', targets: action('house'), gesture: 'drag' },
    win: { anchor: 'properties', targets: PROPERTY_IN_HAND, gesture: 'drag' },
};

const STORAGE_KEY = 'md.tutorial.done';

/** Whether this device has already been through the tutorial. */
export function tutorialSeen(): boolean {
    return localStorage.getItem(STORAGE_KEY) === '1';
}

export function markTutorialSeen(seen: boolean) {
    if (seen) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
}

interface Rect { top: number; left: number; width: number; height: number }

/** Ringing every card in a full hand highlights nothing. */
const MAX_TARGETS = 4;

const centre = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * A hand that mimes the move: it picks the card up, carries it to where it
 * goes, and puts it down, over and over until the player does it themselves.
 * Words describe a gesture; this performs one.
 */
function TourHand({
    from,
    to,
    gesture,
}: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    gesture: 'drag' | 'tap';
}) {
    return (
        <div
            className={`tour-hand tour-hand-${gesture}`}
            aria-hidden="true"
            style={
                {
                    '--x1': `${from.x}px`,
                    '--y1': `${from.y}px`,
                    '--x2': `${to.x}px`,
                    '--y2': `${to.y}px`,
                } as React.CSSProperties
            }
        >
            <svg viewBox="0 0 40 46" width="40" height="46">
                <g fill="#fff" stroke="rgb(9 30 28 / 0.55)" strokeWidth="1.5">
                    <rect x="13.5" y="2" width="7.5" height="21" rx="3.75" />
                    <rect x="20" y="12" width="7" height="12" rx="3.5" />
                    <rect x="26" y="15" width="6.5" height="10" rx="3.25" />
                    <rect x="7" y="15" width="6.5" height="10" rx="3.25" />
                    <path d="M7 20h25v10a12 12 0 0 1-12 12h-1a12 12 0 0 1-12-12z" />
                </g>
            </svg>
        </div>
    );
}

const same = (a: Rect[], b: Rect[]) =>
    a.length === b.length &&
    a.every((r, i) => {
        const o = b[i];
        return (
            Math.abs(r.top - o.top) < 0.5 &&
            Math.abs(r.left - o.left) < 0.5 &&
            Math.abs(r.width - o.width) < 0.5 &&
            Math.abs(r.height - o.height) < 0.5
        );
    });

/** Tracks a region of the page as the table reflows under it. */
function useRects(selector: string | undefined, limit: number): Rect[] {
    const [rects, setRects] = useState<Rect[]>([]);
    useEffect(() => {
        if (!selector) {
            setRects([]);
            return;
        }
        const measure = () => {
            const found = Array.from(document.querySelectorAll<HTMLElement>(selector)).slice(0, limit);
            const next = found.map(el => {
                const r = el.getBoundingClientRect();
                return { top: r.top, left: r.left, width: r.width, height: r.height };
            });
            // A fresh array four times a second re-renders the whole overlay
            // whether anything moved or not, which is its own source of jitter.
            setRects(prev => (same(prev, next) ? prev : next));
        };
        measure();
        // The table reflows constantly — a hand re-fans itself whenever a card
        // leaves it — so this re-measures rather than trusting one read.
        const timer = window.setInterval(measure, 250);
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [selector, limit]);
    return rects;
}

interface Props {
    room: RoomView;
    narrow: boolean;
    /** A dialog or payment panel owns the screen: shrink to a hint strip so the
     *  coach never covers the thing it just asked the player to use. */
    compact: boolean;
    send: (msg: ClientMessage) => void;
    onClose: () => void;
}

export default function Tutorial({ room, narrow, compact, send, onClose }: Props) {
    const { t } = useI18n();
    const [cardHeight, setCardHeight] = useState(220);
    const cardRef = useRef<HTMLDivElement | null>(null);

    const lesson = room.game.tutorial;
    const hint = lesson ? (HINTS[lesson.id] ?? {}) : {};

    const anchorName = compact ? undefined : (narrow && hint.anchorNarrow) || hint.anchor;
    const anchorRects = useRects(anchorName ? `[data-tour="${anchorName}"]` : undefined, 1);
    // A read-through lesson has nothing to point at; a finished one has
    // nothing left to ask for.
    const wantTargets = Boolean(lesson && lesson.task && !lesson.done && !compact);
    const targets = useRects(wantTargets ? hint.targets : undefined, MAX_TARGETS);
    const handRects = useRects('[data-tour="hand"]', 1);

    useEffect(() => {
        const h = cardRef.current?.offsetHeight;
        if (h && Math.abs(h - cardHeight) > 4) setCardHeight(h);
    });

    // Which half of the screen the coach parks in, decided once per lesson.
    // It used to be recomputed from the anchor on every measurement, so the
    // card crept around the screen as the hand re-fanned and cards left it —
    // that is, while the player was trying to aim at something.
    const [slot, setSlot] = useState<'top' | 'bottom'>('top');
    const slotFor = useRef<string | null>(null);
    const lessonId = lesson?.id;

    useEffect(() => {
        slotFor.current = null;
        setSlot('top');
    }, [lessonId]);

    useEffect(() => {
        if (!lessonId || slotFor.current === lessonId) return;
        const r = anchorRects[0];
        if (!r) return;
        slotFor.current = lessonId;
        // Only a region high on the screen pushes the coach down. Everything
        // else a lesson explains lives at the bottom, so above is where it
        // belongs.
        setSlot(r.top < cardHeight + 40 ? 'bottom' : 'top');
    }, [lessonId, anchorRects, cardHeight]);

    if (!lesson) return null;

    const finish = () => {
        markTutorialSeen(true);
        onClose();
    };
    const advance = () => {
        if (lesson.step >= lesson.total) {
            finish();
            return;
        }
        send({ type: 'tutorial_next' });
    };

    const rect = anchorRects[0] ?? null;

    const pad = 8;
    const box = rect && {
        top: Math.max(rect.top - pad, 4),
        left: Math.max(rect.left - pad, 4),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
    };

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = Math.min(340, vw - 24);

    // The hand is the one thing the coach must never cover, and on a desktop
    // it is not always along the bottom: the hand-position setting can stand it
    // up as a column down either side. Blocking off its vertical span in that
    // case leaves no screen at all, which collapsed the coach to a hint strip
    // for the whole tour.
    const hand = handRects[0] ?? null;
    const sideHand = Boolean(hand && hand.height > vh * 0.6);
    const free = {
        left: hand && sideHand && hand.left < vw / 2 ? hand.left + hand.width : 0,
        right: hand && sideHand && hand.left >= vw / 2 ? hand.left : vw,
        top: 0,
        bottom: hand && !sideHand ? hand.top : vh,
    };

    // Parked, not tracked: centred in whatever the hand leaves, and in the slot
    // chosen when the lesson opened. The highlight still follows what it is
    // pointing at; the words do not have to.
    const cardStyle: React.CSSProperties = {
        width: cardWidth,
        left: (free.left + free.right) / 2,
        transform: 'translateX(-50%)',
    };
    if (slot === 'bottom') cardStyle.bottom = Math.max(vh - free.bottom + 12, 12);
    else cardStyle.top = free.top + 12;

    // On a phone there is often no room above the hand for a full card. Rather
    // than clamp it into the cards it is pointing at, the coach becomes a strip
    // and gets out of the way entirely.
    const cramped = free.bottom - free.top - 24 < cardHeight;

    const titleKey = `lesson.${lesson.id}.title`;
    const bodyKey = `lesson.${lesson.id}.body`;
    const taskKey = `lesson.${lesson.id}.task`;
    // The same move is a drag with a mouse and a pull with a thumb, and the
    // two need different words as well as a different mime.
    const gestureKey = hint.gesture
        ? `tutorial.gesture.${hint.gesture}_${narrow ? 'touch' : 'pc'}`
        : null;

    if (compact || cramped) {
        // A dialog owns the bottom of the screen, so the strip sits under it;
        // a cramped table owns the bottom with the hand, so it sits on top.
        return (
            <div
                className={`pointer-events-none fixed inset-x-2 z-[90] flex justify-center ${
                    compact ? 'bottom-2' : 'tour-strip-top top-2'
                }`}
            >
                <div className="panel pointer-events-auto flex max-w-lg items-center gap-3 border-brass/40 px-3 py-2">
                    <span className="label-caps shrink-0 text-brass">{t('tutorial.label')}</span>
                    <p className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-semibold">{t(titleKey)}</span>
                        {lesson.task && <span className="text-white/60"> — {t(taskKey)}</span>}
                    </p>
                    <button
                        type="button"
                        className="btn btn-ghost shrink-0 !px-2 !py-0.5 !text-xs"
                        onClick={finish}
                    >
                        {t('tutorial.skipTour')}
                    </button>
                </div>
            </div>
        );
    }

    const from = targets.length > 0 ? centre(targets[0]) : null;
    const to = hint.gesture === 'drag' && box
        ? centre(box)
        : hint.gesture === 'tap' && from
          ? from
          : null;
    const showGesture = Boolean(from && to && wantTargets);

    // Every hole the dimmer leaves open: the region being explained, and each
    // card the player is being asked to move. A spread box-shadow can only cut
    // one, so the dimmer is a masked rectangle instead.
    const holes = [...(box ? [box] : []), ...targets];

    return (
        <div className="pointer-events-none fixed inset-0 z-[80]">
            {holes.length > 0 ? (
                <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <defs>
                        <mask id="tour-mask">
                            <rect width="100%" height="100%" fill="white" />
                            {holes.map((h, i) => (
                                <rect key={i} x={h.left} y={h.top} width={h.width} height={h.height} rx={12} fill="black" />
                            ))}
                        </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgb(2 12 8 / 0.62)" mask="url(#tour-mask)" />
                    {showGesture && hint.gesture === 'drag' && from && to && (
                        <line className="tour-route" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                    )}
                </svg>
            ) : (
                <div className="absolute inset-0 bg-[rgb(2_12_8_/_0.62)]" />
            )}

            {box && (
                <div
                    className="absolute rounded-2xl ring-2 ring-brass transition-all duration-300"
                    style={{
                        top: box.top,
                        left: box.left,
                        width: box.width,
                        height: box.height,
                        boxShadow: '0 0 30px rgb(242 193 78 / 0.45)',
                    }}
                />
            )}

            {targets.map((target, i) => (
                <div
                    key={i}
                    className="tour-target"
                    style={{
                        top: target.top,
                        left: target.left,
                        width: target.width,
                        height: target.height,
                        animationDelay: `${i * 140}ms`,
                    }}
                />
            ))}

            {showGesture && from && to && (
                <TourHand from={from} to={to} gesture={hint.gesture ?? 'tap'} />
            )}

            <div
                ref={cardRef}
                className="panel animate-pop pointer-events-auto absolute border-brass/40 p-4 shadow-2xl"
                style={cardStyle}
            >
                <div className="mb-1 flex items-center gap-2">
                    <span className="label-caps text-brass">
                        {t('tutorial.progress', { current: lesson.step, total: lesson.total })}
                    </span>
                    <button
                        type="button"
                        className="btn btn-ghost ml-auto !px-2 !py-0.5 !text-xs"
                        onClick={finish}
                    >
                        {t('tutorial.skipTour')}
                    </button>
                </div>

                <h2 className="font-display text-2xl leading-tight tracking-wide text-brass">{t(titleKey)}</h2>
                <p className="mt-1 text-sm leading-snug text-white/80">{t(bodyKey)}</p>

                {lesson.task && (
                    <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        lesson.done ? 'bg-emerald-500/20 text-emerald-200' : 'bg-brass/15 text-amber-200'
                    }`}>
                        {lesson.done ? t('tutorial.taskDone') : `→ ${t(taskKey)}`}
                    </p>
                )}

                {/* How to do it with what you are holding. */}
                {lesson.task && !lesson.done && gestureKey && (
                    <p className="mt-1.5 text-xs text-white/50">{t(gestureKey)}</p>
                )}

                <div className="mt-3 flex items-center gap-2">
                    <span className="flex flex-1 gap-1">
                        {Array.from({ length: lesson.total }).map((_, i) => (
                            <span
                                key={i}
                                className={`h-1.5 flex-1 rounded-full ${i < lesson.step ? 'bg-brass' : 'bg-white/25'}`}
                            />
                        ))}
                    </span>
                    <button
                        type="button"
                        className={`btn ml-auto !py-1.5 !text-sm ${lesson.done ? 'btn-gold' : 'btn-ghost'}`}
                        onClick={advance}
                    >
                        {lesson.step >= lesson.total
                            ? t('tutorial.finish')
                            : lesson.task && !lesson.done
                              ? t('tutorial.skipStep')
                              : t('common.next')}
                    </button>
                </div>
            </div>
        </div>
    );
}
