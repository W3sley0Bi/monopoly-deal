import type { CSSProperties } from 'react';
import type { Card, Color, SetView } from '../types';
import type { I18n } from '../i18n';
import { ACTION_BLURB_KEY, colorMeta } from '../game/meta';
import { useI18n } from '../i18n';
import HoverDetails from './HoverDetails';
import DualWildcard from './DualWildcard';
import PropertyArtwork from './PropertyArtwork';
import { money } from '../i18n/format';

type Size = 'xs' | 'sm' | 'md';

const SIZES: Record<Size, string> = {
    xs: 'w-14 h-20 text-[8px]',
    sm: 'w-[4.5rem] h-[6.5rem] text-[9px]',
    md: 'w-[6.5rem] h-[9.25rem] text-[11px]',
};

interface Props {
    card: Card;
    size?: Size;
    activeColor?: Color;
    setInfo?: SetView;
    banked?: boolean;
    inspectable?: boolean;
    selected?: boolean;
    dimmed?: boolean;
    /** Highlight ring, e.g. a card being offered in a swap. */
    flagged?: boolean;
    onClick?: () => void;
    className?: string;
    style?: CSSProperties;
    title?: string;
    /** Enables HTML5 dragging for play-by-drag. */
    draggable?: boolean;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    /** Dimmed and lifted while this card is the one being dragged. */
    dragging?: boolean;
}

/**
 * Wildcard and rent names like "Green/Railroad" break mid-word on a narrow
 * card, so render them from the short colour labels with spaces around the
 * slash. That also translates them without a catalog entry per combination.
 */
function cardTitle(card: Card, t: I18n['t'], tCard: I18n['tCard']): string {
    const cols = card.colors ?? [];
    const short = (c: Color) => t(`color.short.${c}`);
    if (
        (card.type === 'property_wildcard' || card.type === 'rent') &&
        cols.length === 2
    ) {
        return `${short(cols[0])} / ${short(cols[1])}`;
    }
    if (card.type === 'rent' && cols.length === 1) return short(cols[0]);
    return tCard(card);
}

/** Colours drawn in the header stripe. */
function stripeColors(card: Card): Color[] {
    const cols = card.colors ?? [];
    if (!cols.length) return [];
    if (cols.length === 1 && cols[0] === 'all') return ['all'];
    return cols;
}

export default function PlayingCard({
    card,
    size = 'md',
    selected,
    dimmed,
    flagged,
    onClick,
    className = '',
    style,
    title,
    draggable,
    onDragStart,
    onDragEnd,
    dragging,
    activeColor,
    setInfo,
    banked,
    inspectable = true,
}: Props) {
    const { t, tCard, tColor } = useI18n();
    const interactive = Boolean(onClick);
    const cols = stripeColors(card);
    const isProp =
        card.type === 'property' || card.type === 'property_wildcard';

    const dual = card.type === 'property_wildcard' && cols.length === 2;
    const description = card.action
        ? t(ACTION_BLURB_KEY[card.action])
        : card.type === 'rent'
          ? t('inspect.rent_rule')
          : card.type === 'money'
            ? t('inspect.money_rule')
            : t('inspect.property_rule');
    const details = (
        <div className="card-inspection">
            <div className="inspection-art" aria-hidden="true">
                <PlayingCard
                    card={card}
                    activeColor={activeColor}
                    inspectable={false}
                />
            </div>
            <div className="inspection-copy">
                <p className="label-caps">
                    {t(
                        banked
                            ? 'board.bank'
                            : `card.type.${card.type === 'property_wildcard' ? 'wildcard' : card.type === 'money' ? 'bank' : card.type}`,
                    )}
                </p>
                <h3>{tCard(card)}</h3>
                <p>{banked ? t('inspect.banked_rule') : description}</p>
                <dl>
                    <div>
                        <dt>{t('card.value')}</dt>
                        <dd>{money(t, card.value)}</dd>
                    </div>
                    {activeColor && (
                        <div>
                            <dt>{t('inspect.played_as')}</dt>
                            <dd>{tColor(activeColor)}</dd>
                        </div>
                    )}
                    {setInfo && (
                        <>
                            <div>
                                <dt>{t('inspect.set_progress')}</dt>
                                <dd>
                                    {setInfo.cards.length}/{setInfo.size}
                                </dd>
                            </div>
                            <div>
                                <dt>{t('card.type.rent')}</dt>
                                <dd>{money(t, setInfo.rent)}</dd>
                            </div>
                        </>
                    )}
                </dl>
                {setInfo && (
                    <p className="inspection-note">
                        {t(
                            setInfo.complete
                                ? 'inspect.protected'
                                : 'inspect.exposed',
                        )}
                    </p>
                )}
                {dual && (
                    <p className="inspection-note">
                        {t(
                            activeColor
                                ? 'table.wildcard_move_cost'
                                : 'inspect.wild_choose',
                        )}
                    </p>
                )}
                {title && title !== tCard(card) && (
                    <p className="inspection-note">{title}</p>
                )}
            </div>
        </div>
    );
    return (
        <HoverDetails
            enabled={inspectable}
            openOnClick={!onClick}
            content={details}
        >
            <button
                type="button"
                data-card-id={card.id}
                data-card-type={card.type}
                data-active-color={activeColor}
                data-dual={dual || undefined}
                data-selected={selected || undefined}
                aria-pressed={interactive ? Boolean(selected) : undefined}
                aria-label={`${tCard(card)}, ${money(t, card.value)}${activeColor ? `, ${t('inspect.played_as')} ${tColor(activeColor)}` : ''}`}
                disabled={!inspectable && !interactive && !draggable}
                draggable={draggable}
                onDragStart={(e) => {
                    // Some browsers cancel the drag without any payload.
                    e.dataTransfer.setData('text/plain', card.id);
                    e.dataTransfer.effectAllowed = 'move';
                    onDragStart?.();
                }}
                onDragEnd={onDragEnd}
                onClick={onClick}
                style={
                    {
                        '--card-color': cols.length
                            ? colorMeta(activeColor ?? cols[0]).hex
                            : card.type === 'money'
                              ? '#42bd97'
                              : '#f5b643',
                        ...style,
                    } as CSSProperties
                }
                className={[
                    'card-face flex shrink-0 flex-col text-left leading-tight',
                    SIZES[size],
                    interactive || draggable || inspectable
                        ? 'cursor-pointer transition-transform duration-150 hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]'
                        : 'cursor-default',
                    draggable ? 'active:cursor-grabbing' : '',
                    selected
                        ? '-translate-y-1.5 shadow-[var(--shadow-glow)]'
                        : '',
                    dragging ? 'opacity-35 saturate-50' : '',
                    dimmed ? 'opacity-45 saturate-50' : '',
                    flagged ? 'ring-2 ring-sky-300' : '',
                    className,
                ].join(' ')}
            >
                {dual ? (
                    <DualWildcard card={card} activeColor={activeColor} />
                ) : (
                    <>
                        {cols.length > 0 && (
                            <div className="flex h-[26%] w-full border-b border-black/25">
                                {cols.map((c, i) => {
                                    const m = colorMeta(c);
                                    return (
                                        <div
                                            key={`${c}-${i}`}
                                            className="flex-1 grid place-items-center font-black tracking-wide"
                                            style={{
                                                background:
                                                    c === 'all'
                                                        ? 'conic-gradient(from 210deg, #f87171, #fbbf24, #34d399, #60a5fa, #c084fc, #f87171)'
                                                        : m.hex,
                                                color: m.ink,
                                            }}
                                        >
                                            <span
                                                className={`truncate px-0.5 uppercase ${cols.length > 1 ? 'text-[0.75em]' : 'text-[0.85em]'}`}
                                            >
                                                {cols.length > 1
                                                    ? t(`color.short.${c}`)
                                                    : tColor(c)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {card.type === 'money' && (
                            <div
                                className="flex h-[26%] w-full items-center justify-between border-b border-emerald-900/30 px-1.5 font-black uppercase"
                                style={{
                                    background:
                                        'linear-gradient(180deg,#bbf7d0,#4ade80)',
                                    color: '#04240f',
                                }}
                            >
                                <span className="text-[0.85em] tracking-widest">
                                    {t('card.type.bank')}
                                </span>
                                <span className="text-[0.85em]">$</span>
                            </div>
                        )}

                        {card.type === 'action' && (
                            <div
                                className="flex h-[26%] w-full items-center justify-between border-b border-purple-900/30 px-1.5 font-black uppercase"
                                style={{
                                    background:
                                        'linear-gradient(180deg,#e9d5ff,#a855f7)',
                                    color: '#280046',
                                }}
                            >
                                <span className="text-[0.85em] tracking-widest">
                                    {t('card.type.action')}
                                </span>
                                <span className="text-[1.1em] leading-none">
                                    ✦
                                </span>
                            </div>
                        )}

                        <div className="card-body relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-center">
                            {isProp && (
                                <PropertyArtwork
                                    color={activeColor ?? cols[0]}
                                />
                            )}
                            {!isProp && card.type !== 'money' && (
                                <span
                                    className="card-symbol"
                                    aria-hidden="true"
                                >
                                    {isProp
                                        ? '⌂'
                                        : card.type === 'rent'
                                          ? '↗'
                                          : {
                                                pass_go: '➜',
                                                deal_breaker: '✦',
                                                sly_deal: '♠',
                                                forced_deal: '⇄',
                                                debt_collector: '$',
                                                birthday: '★',
                                                house: '⌂',
                                                hotel: '▥',
                                                just_say_no: '⊘',
                                                double_rent: '×2',
                                            }[card.action ?? 'pass_go']}
                                </span>
                            )}
                            {card.type === 'rent' && (
                                <span className="rounded bg-black/80 px-1.5 py-px text-[0.8em] font-black uppercase tracking-widest text-white">
                                    {t('card.type.rent')}
                                </span>
                            )}

                            {card.type === 'money' ? (
                                <>
                                    <span
                                        className="font-display text-[2.8em] leading-none text-emerald-800"
                                        style={{
                                            textShadow:
                                                '0 1px 0 rgb(255 255 255 / 0.7)',
                                        }}
                                    >
                                        {card.value}
                                    </span>
                                    <span className="text-[0.8em] font-bold uppercase tracking-widest opacity-55">
                                        {t('card.million')}
                                    </span>
                                </>
                            ) : (
                                <span className="w-full text-[1em] font-bold break-words hyphens-auto">
                                    {cardTitle(card, t, tCard)}
                                </span>
                            )}

                            {card.type === 'action' &&
                                card.action &&
                                size !== 'xs' && (
                                    <span className="text-[0.85em] italic opacity-65">
                                        {t(ACTION_BLURB_KEY[card.action])}
                                    </span>
                                )}

                            {isProp && size === 'md' && (
                                <span className="text-[0.85em] opacity-55">
                                    {t(
                                        card.type === 'property_wildcard'
                                            ? 'card.type.wildcard'
                                            : 'card.type.property',
                                    )}
                                </span>
                            )}
                        </div>

                        {card.type !== 'money' && (
                            <div className="flex items-center justify-between border-t border-black/15 bg-black/5 px-1.5 py-0.5">
                                <span className="text-[0.8em] font-semibold uppercase opacity-50">
                                    {t('card.value')}
                                </span>
                                <span className="font-display text-[1.15em] leading-none">
                                    {money(t, card.value)}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </button>
        </HoverDetails>
    );
}

/** Face-down card used for the deck and opponents' hands. */
export function CardBack({
    size = 'md',
    className = '',
    label,
    style,
}: {
    size?: Size;
    className?: string;
    label?: string;
    style?: CSSProperties;
}) {
    return (
        <div
            className={`card-back ${SIZES[size]} grid shrink-0 place-items-center ${className}`}
            style={style}
        >
            <span className="card-back-mark" aria-hidden="true">
                <small>MONOPOLY</small>
                <b>{label ?? 'DEAL'}</b>
            </span>
        </div>
    );
}
