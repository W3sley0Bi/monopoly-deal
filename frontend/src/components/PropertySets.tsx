import type { Card, Color, SetView } from '../types';
import { colorMeta } from '../game/meta';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import PlayingCard from './PlayingCard';

interface Props {
    sets: SetView[];
    size?: 'xs' | 'sm' | 'md';
    /** Called when a card in a set is clicked; enables selection UI. */
    onCardClick?: (card: Card, color: Color) => void;
    /** Cards that can be clicked. When omitted every card is clickable. */
    enabledIds?: Set<string>;
    selectedIds?: Set<string>;
    flaggedIds?: Set<string>;
    /** Overrides the default "no properties yet" line; already translated. */
    emptyLabel?: string;
    /** Cards that can be picked up and dropped on another colour. */
    draggableIds?: Set<string>;
    onDragCard?: (card: Card) => void;
    onDragEndCard?: () => void;
    draggingId?: string;
    /** Grey out cards outside `enabledIds`. Off for your own board. */
    dimDisabled?: boolean;
}

export default function PropertySets({
    sets, size = 'sm', onCardClick, enabledIds, selectedIds, flaggedIds, emptyLabel,
    draggableIds, onDragCard, onDragEndCard, draggingId, dimDisabled = true,
}: Props) {
    const { t, tCard, tColor } = useI18n();

    if (!sets.length) {
        return <div className="px-1 py-4 text-xs italic text-white/35">{emptyLabel ?? t('sets.empty')}</div>;
    }

    return (
        <div className="flex flex-wrap items-start gap-3">
            {sets.map(set => {
                const m = colorMeta(set.color);
                return (
                    <div
                        key={set.color}
                        className={`rounded-xl border p-1.5 transition-shadow ${set.complete ? 'border-brass/70' : 'border-white/10'}`}
                        style={{
                            background: `linear-gradient(180deg, ${m.hex}22, rgb(0 0 0 / 0.25))`,
                            boxShadow: set.complete ? '0 0 0 1px rgb(242 193 78 / 0.6), 0 0 22px -8px rgb(242 193 78 / 0.8)' : undefined,
                        }}
                    >
                        <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                            <span className="flex items-center gap-1">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.hex }} />
                                <span className="label-caps !text-[0.6rem] !text-white/75">{tColor(set.color)}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[0.6rem] font-bold">
                                <span className={set.complete ? 'text-brass' : 'text-white/55'}>
                                    {set.cards.length}/{set.size}
                                </span>
                                <span className="rounded bg-black/40 px-1 py-px text-emerald-300">{money(t, set.rent)}</span>
                            </span>
                        </div>

                        <div className="flex items-end gap-1">
                            <div className="flex">
                                {set.cards.map((c, i) => {
                                    const enabled = onCardClick && (!enabledIds || enabledIds.has(c.id));
                                    return (
                                        <PlayingCard
                                            key={c.id}
                                            card={c}
                                            size={size}
                                            selected={selectedIds?.has(c.id)}
                                            flagged={flaggedIds?.has(c.id)}
                                            dimmed={Boolean(dimDisabled && onCardClick && enabledIds && !enabledIds.has(c.id))}
                                            onClick={enabled ? () => onCardClick!(c, set.color) : undefined}
                                            draggable={draggableIds?.has(c.id)}
                                            dragging={draggingId === c.id}
                                            onDragStart={() => onDragCard?.(c)}
                                            onDragEnd={onDragEndCard}
                                            className={i > 0 ? '-ml-8' : ''}
                                            style={{ zIndex: i }}
                                        />
                                    );
                                })}
                            </div>

                            {set.buildings.length > 0 && (
                                <div className="flex flex-col gap-0.5 pb-0.5">
                                    {set.buildings.map(b => {
                                        const enabled = onCardClick && (!enabledIds || enabledIds.has(b.id));
                                        return (
                                            <button
                                                key={b.id}
                                                type="button"
                                                disabled={!enabled}
                                                onClick={enabled ? () => onCardClick!(b, set.color) : undefined}
                                                title={tCard(b)}
                                                className={[
                                                    'grid h-6 w-6 place-items-center rounded-md border border-black/40 text-sm',
                                                    b.action === 'hotel' ? 'bg-rose-500' : 'bg-emerald-500',
                                                    selectedIds?.has(b.id) ? 'shadow-[var(--shadow-glow)]' : '',
                                                    enabled ? 'cursor-pointer hover:brightness-110' : '',
                                                ].join(' ')}
                                            >
                                                {b.action === 'hotel' ? '🏨' : '🏠'}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
