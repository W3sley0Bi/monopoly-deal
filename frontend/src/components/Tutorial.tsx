import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameView, PlayerView, RoomView } from '../types';
import { useI18n } from '../i18n';

/**
 * A guided tour that doubles as the tutorial. Each step points at a real part
 * of the table (through `data-tour` attributes) and most of them finish when
 * the player actually does the thing, not when they press Next — so the tour
 * teaches by having you play rather than by reading.
 */

interface Ctx {
    g: GameView;
    me?: PlayerView;
    /** Your turn, nothing pending. */
    myTurn: boolean;
    narrow: boolean;
}

interface Step {
    id: string;
    /** `data-tour` value to spotlight. Omitted for a centred card. */
    anchor?: string;
    /** Narrow screens sometimes need a different anchor. */
    anchorNarrow?: string;
    /** Steps carry catalog keys, never English text, so a step reads in the
     *  language the player chose and switching language re-renders the tour. */
    titleKey: string;
    bodyKey: string;
    /** Shown in amber under the body: what to actually do. */
    taskKey?: string;
    /** True once the player has done the step's task; advances by itself. */
    done?: (c: Ctx) => boolean;
    /** Only show the step while this holds. */
    when?: (c: Ctx) => boolean;
    /** Wait here until the table is ready for the task. */
    blocked?: (c: Ctx) => boolean;
    blockedNoteKey?: string;
}

const propertiesInPlay = (c: Ctx) => (c.me?.sets ?? []).reduce((n, s) => n + s.cards.length, 0);

export const STEPS: Step[] = [
    {
        id: 'welcome',
        titleKey: 'tutorial.welcome.title',
        bodyKey: 'tutorial.welcome.body',
        taskKey: 'tutorial.welcome.task',
    },
    {
        id: 'goal',
        titleKey: 'tutorial.goal.title',
        bodyKey: 'tutorial.goal.body',
        anchor: 'sets-progress',
    },
    {
        id: 'hand',
        anchor: 'hand',
        titleKey: 'tutorial.hand.title',
        bodyKey: 'tutorial.hand.body',
        taskKey: 'tutorial.hand.task',
    },
    {
        id: 'play-property',
        anchor: 'properties',
        titleKey: 'tutorial.play-property.title',
        bodyKey: 'tutorial.play-property.body',
        taskKey: 'tutorial.play-property.task',
        blocked: c => !c.myTurn,
        blockedNoteKey: 'tutorial.play-property.blocked',
        done: c => propertiesInPlay(c) > 0,
    },
    {
        id: 'bank',
        anchor: 'bank',
        titleKey: 'tutorial.bank.title',
        bodyKey: 'tutorial.bank.body',
        taskKey: 'tutorial.bank.task',
        blocked: c => !c.myTurn,
        blockedNoteKey: 'tutorial.bank.blocked',
        done: c => (c.me?.bank.length ?? 0) > 0,
    },
    {
        id: 'plays',
        anchor: 'plays',
        titleKey: 'tutorial.plays.title',
        bodyKey: 'tutorial.plays.body',
    },
    {
        id: 'actions',
        anchor: 'hand',
        titleKey: 'tutorial.actions.title',
        bodyKey: 'tutorial.actions.body',
    },
    {
        id: 'opponents',
        anchor: 'opponents',
        titleKey: 'tutorial.opponents.title',
        bodyKey: 'tutorial.opponents.body',
    },
    {
        id: 'log',
        anchor: 'log',
        anchorNarrow: 'log-narrow',
        titleKey: 'tutorial.log.title',
        bodyKey: 'tutorial.log.body',
    },
    {
        id: 'end-turn',
        anchor: 'end-turn',
        titleKey: 'tutorial.end-turn.title',
        bodyKey: 'tutorial.end-turn.body',
        taskKey: 'tutorial.end-turn.task',
        blocked: c => !c.myTurn,
        blockedNoteKey: 'tutorial.end-turn.blocked',
        done: c => !c.myTurn,
    },
    {
        id: 'pending',
        titleKey: 'tutorial.pending.title',
        bodyKey: 'tutorial.pending.body',
        when: c => Boolean(c.g.pending),
        done: c => !c.g.pending,
        taskKey: 'tutorial.pending.task',
    },
    {
        id: 'done',
        titleKey: 'tutorial.done.title',
        bodyKey: 'tutorial.done.body',
        taskKey: 'tutorial.done.task',
    },
];

const STORAGE_KEY = 'md.tutorial.done';

/** Whether this device has already been through the tour. */
export function tutorialSeen(): boolean {
    return localStorage.getItem(STORAGE_KEY) === '1';
}

export function markTutorialSeen(seen: boolean) {
    if (seen) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
}

interface Props {
    room: RoomView;
    narrow: boolean;
    /** A dialog or payment panel owns the screen: shrink to a hint strip so the
     *  tour never covers the thing it just asked the player to use. */
    compact: boolean;
    onClose: () => void;
}

interface Rect { top: number; left: number; width: number; height: number }

export default function Tutorial({ room, narrow, compact, onClose }: Props) {
    const { t } = useI18n();
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [handRect, setHandRect] = useState<Rect | null>(null);
    const [cardHeight, setCardHeight] = useState(200);
    const cardRef = useRef<HTMLDivElement | null>(null);

    const g = room.game;
    const me = g.players.find(p => p.id === g.you);
    const ctx: Ctx = useMemo(() => ({
        g,
        me,
        myTurn: g.players[g.current_turn]?.id === g.you && !g.pending,
        narrow,
    }), [g, me, narrow]);

    // Steps whose `when` no longer holds are skipped, so the conditional ones
    // (like the payment panel) only appear when the table shows them.
    const visible = useMemo(() => STEPS.filter(s => !s.when || s.when(ctx)), [ctx]);
    const step = visible[Math.min(index, visible.length - 1)];
    const last = index >= visible.length - 1;

    const blocked = Boolean(step?.blocked?.(ctx));
    const complete = Boolean(step?.done?.(ctx));

    // A step with a task finishes itself the moment the player does it.
    useEffect(() => {
        if (!step?.done || blocked || !complete) return;
        const t = setTimeout(() => setIndex(i => Math.min(i + 1, visible.length - 1)), 650);
        return () => clearTimeout(t);
    }, [step, blocked, complete, visible.length]);

    // A pending action jumps the tour to the step that explains it.
    useEffect(() => {
        if (!g.pending) return;
        const at = visible.findIndex(s => s.id === 'pending');
        if (at >= 0) setIndex(i => (i < at ? at : i));
    }, [g.pending, visible]);

    // The table reflows constantly, so re-measure the anchor rather than
    // trusting a single read.
    const anchor = compact ? undefined : (narrow && step?.anchorNarrow) || step?.anchor;
    useEffect(() => {
        if (!anchor) {
            setRect(null);
            return;
        }
        const measure = () => {
            const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
            if (!el) {
                setRect(null);
                return;
            }
            const r = el.getBoundingClientRect();
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        };
        measure();
        const timer = setInterval(measure, 250);
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [anchor, index]);

    // The hand is the one region the card may never cover.
    useEffect(() => {
        const measure = () => {
            const el = document.querySelector<HTMLElement>('[data-tour="hand"]');
            if (!el) {
                setHandRect(null);
                return;
            }
            const r = el.getBoundingClientRect();
            setHandRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        };
        measure();
        const timer = setInterval(measure, 250);
        window.addEventListener('resize', measure);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', measure);
        };
    }, []);

    useEffect(() => {
        const h = cardRef.current?.offsetHeight;
        if (h && Math.abs(h - cardHeight) > 4) setCardHeight(h);
    });

    const keepClear = anchor === 'hand' ? null : handRect;

    if (!step) return null;

    const finish = () => {
        markTutorialSeen(true);
        onClose();
    };
    const next = () => (last ? finish() : setIndex(i => i + 1));

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
    const cardStyle: React.CSSProperties = { width: cardWidth };

    if (!box) {
        cardStyle.top = '50%';
        cardStyle.left = '50%';
        cardStyle.transform = 'translate(-50%, -50%)';
    } else {
        cardStyle.left = Math.min(
            Math.max(box.left + box.width / 2 - cardWidth / 2, 12),
            Math.max(vw - cardWidth - 12, 12),
        );
        // A tall, mostly empty spotlight (the property mat) has room for the
        // card inside it; anything else gets the card below, or above when
        // there is no space underneath.
        const below = box.top + box.height + 12;
        let top: number;
        if (box.height >= cardHeight + 60) top = box.top + (box.height - cardHeight) / 2;
        else if (below + cardHeight + 12 <= vh) top = below;
        else top = box.top - cardHeight - 12;

        // The card must never sit on top of the hand — that is what the player
        // needs to reach for most of these steps.
        if (keepClear && top + cardHeight > keepClear.top - 8) {
            top = Math.min(top, keepClear.top - cardHeight - 8);
        }
        cardStyle.top = Math.min(Math.max(top, 12), Math.max(vh - cardHeight - 12, 12));
    }

    if (compact) {
        return (
            <div className="pointer-events-none fixed inset-x-2 bottom-2 z-[90] flex justify-center">
                <div className="panel pointer-events-auto flex max-w-lg items-center gap-3 border-brass/40 px-3 py-2">
                    <span className="label-caps shrink-0 text-brass">{t('tutorial.label')}</span>
                    <p className="min-w-0 flex-1 truncate text-sm">
                        <span className="font-semibold">{t(step.titleKey)}</span>
                        {step.taskKey && <span className="text-white/60"> — {t(step.taskKey)}</span>}
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

    return (
        <div className="pointer-events-none fixed inset-0 z-[80]">
            {/* Dimmer. With an anchor it is the spotlight's own shadow, so the
                highlighted control stays fully visible and clickable. */}
            {box ? (
                <div
                    className="absolute rounded-2xl ring-2 ring-brass transition-all duration-300"
                    style={{
                        top: box.top,
                        left: box.left,
                        width: box.width,
                        height: box.height,
                        boxShadow: '0 0 0 9999px rgb(2 12 8 / 0.62), 0 0 30px rgb(242 193 78 / 0.45)',
                    }}
                />
            ) : (
                <div className="absolute inset-0 bg-[rgb(2_12_8_/_0.62)]" />
            )}

            <div
                ref={cardRef}
                className="panel animate-pop pointer-events-auto absolute border-brass/40 p-4 shadow-2xl"
                style={cardStyle}
            >
                <div className="mb-1 flex items-center gap-2">
                    <span className="label-caps text-brass">
                        {t('tutorial.progress', { current: index + 1, total: visible.length })}
                    </span>
                    <button
                        type="button"
                        className="btn btn-ghost ml-auto !px-2 !py-0.5 !text-xs"
                        onClick={finish}
                    >
                        {t('tutorial.skipTour')}
                    </button>
                </div>

                <h2 className="font-display text-2xl leading-tight tracking-wide text-brass">{t(step.titleKey)}</h2>
                <p className="mt-1 text-sm leading-snug text-white/80">{t(step.bodyKey)}</p>

                {step.taskKey && (
                    <p className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        complete
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : blocked
                                ? 'bg-white/10 text-white/60'
                                : 'bg-brass/15 text-amber-200'
                    }`}>
                        {complete
                            ? t('tutorial.taskDone')
                            : blocked
                                ? t(step.blockedNoteKey ?? 'tutorial.waiting')
                                : `→ ${t(step.taskKey)}`}
                    </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-ghost !py-1.5 !text-sm"
                        disabled={index === 0}
                        onClick={() => setIndex(i => Math.max(i - 1, 0))}
                    >
                        {t('common.back')}
                    </button>
                    <span className="flex gap-1">
                        {visible.map((s, i) => (
                            <span
                                key={s.id}
                                className={`h-1.5 w-1.5 rounded-full ${i <= index ? 'bg-brass' : 'bg-white/25'}`}
                            />
                        ))}
                    </span>
                    <button
                        type="button"
                        className="btn btn-gold ml-auto !py-1.5 !text-sm"
                        onClick={next}
                    >
                        {last
                            ? t('tutorial.finish')
                            : step.done && !complete
                                ? t('tutorial.skipStep')
                                : t('common.next')}
                    </button>
                </div>
            </div>
        </div>
    );
}
