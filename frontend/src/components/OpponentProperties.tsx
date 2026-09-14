import type { PlayerView, SetView } from '../types';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import { colorMeta } from '../game/meta';
import HoverDetails from './HoverDetails';
import PlayingCard from './PlayingCard';

function SetDetails({ set }: { set: SetView }) {
    const { t, tColor, tCard } = useI18n();
    return (
        <div className="set-inspection">
            <p className="label-caps">{t('board.properties')}</p>
            <h3>{tColor(set.color)}</h3>
            <div className="inspection-statline">
                <b>
                    {set.cards.length}/{set.size}
                </b>
                <span>
                    {t('card.type.rent')} <b>{money(t, set.rent)}</b>
                </span>
            </div>
            <div className="inspection-set-cards">
                {set.cards.map((card) => (
                    <PlayingCard
                        key={card.id}
                        card={card}
                        size="sm"
                        activeColor={set.color}
                        inspectable={false}
                    />
                ))}
            </div>
            {set.buildings.length > 0 && (
                <p>{set.buildings.map(tCard).join(' · ')}</p>
            )}
            <p className="inspection-note">
                {t(set.complete ? 'inspect.protected' : 'inspect.exposed')}
            </p>
        </div>
    );
}

/** Public property faces stay on the shared table; labels preserve set clarity. */
export default function OpponentProperties({
    player,
    onOpen,
}: {
    player: PlayerView;
    onOpen: () => void;
}) {
    const { t, tColor } = useI18n();
    if (!player.sets.length)
        return (
            <p className="opponent-properties-empty">{t('sets.empty_short')}</p>
        );
    return (
        <div
            className={`opponent-properties ${player.sets.length > 3 ? 'opponent-properties-dense' : ''}`}
            data-rows={player.sets.length > 3 ? Math.ceil(player.sets.length / 4) : 1}
            aria-label={`${player.name}: ${t('board.properties')}`}
        >
            {player.sets.map((set) => {
                const meta = colorMeta(set.color);
                return (
                    <div
                        key={set.color}
                        className={`opponent-set ${set.complete ? 'opponent-set-complete' : ''}`}
                    >
                        <HoverDetails content={<SetDetails set={set} />}>
                            <button
                                type="button"
                                className="opponent-set-label"
                                onClick={onOpen}
                                style={{
                                    background: meta.hex,
                                    color: meta.ink,
                                }}
                                aria-label={`${tColor(set.color)}, ${set.cards.length}/${set.size}, ${t('card.type.rent')} ${money(t, set.rent)}`}
                            >
                                <span>{t(`color.short.${set.color}`)}</span>
                                <b>
                                    {set.cards.length}/{set.size}
                                    {set.complete ? ' ✓' : ''}
                                </b>
                            </button>
                        </HoverDetails>
                        <div className="opponent-set-stack">
                            {set.cards.map((card) => (
                                <PlayingCard
                                    key={card.id}
                                    card={card}
                                    size="xs"
                                    className="opponent-property-card"
                                    activeColor={set.color}
                                    setInfo={set}
                                />
                            ))}
                        </div>
                        <span className="opponent-set-rent">
                            {set.buildings.length > 0 && (
                                <span aria-label={t('inspect.buildings')}>
                                    {set.buildings
                                        .map((b) =>
                                            b.action === 'hotel' ? '▥' : '⌂',
                                        )
                                        .join(' ')}
                                </span>
                            )}
                            {money(t, set.rent)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
