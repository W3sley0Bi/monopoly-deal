import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { PlayerView } from '../types';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import Avatar from './Avatar';
import PropertySets from './PropertySets';
import { CardBack } from './PlayingCard';

interface Props {
    player: PlayerView;
    onOpen: () => void;
}

/** More than this and the pile stops reading as a hand and starts as a wall. */
const MAX_BACKS = 7;

/**
 * The board of whoever is playing, spelled out on the shared table.
 *
 * On a phone every rival is a chip, and a chip is a summary: to see what the
 * player in front of you is actually building you had to open their sheet,
 * which is a strange thing to have to do while watching someone take a turn.
 * This gives the centre of the table back to whoever is using it.
 */
export default function ActiveBoard({ player, onOpen }: Props) {
    const { t } = useI18n();
    const [fanned, setFanned] = useState(false);
    const backs = Math.min(player.hand_count, MAX_BACKS);

    return (
        <section className="active-board" aria-label={t('table.turn_of', { name: player.name })}>
            <div className="active-board-head">
                {/* Identity and the way in are one target: a sentence telling
                    you to click something is not a button. */}
                <button
                    type="button"
                    className="active-board-who"
                    onClick={onOpen}
                    title={t('inspect.open_board')}
                    aria-label={`${player.name}: ${t('table.their_board')}`}
                >
                    <Avatar id={player.id} name={player.name} size={26} active />
                    <strong>{player.name}</strong>
                    <span className="active-board-bank">{money(t, player.bank_total)}</span>
                    <span className="active-board-chevron" aria-hidden="true">›</span>
                </button>

                {/* Their hand rests as a pile; a tap spreads it, because the
                    count matters more often than the shape of it does. */}
                <button
                    type="button"
                    className="active-hand"
                    aria-expanded={fanned}
                    onClick={() => setFanned(open => !open)}
                    title={t('opponent.hand_title')}
                    aria-label={`${t('opponent.hand_title')}: ${player.hand_count}`}
                >
                    <span className={`active-hand-pile ${fanned ? 'is-fanned' : ''}`} aria-hidden="true">
                        {Array.from({ length: backs }).map((_, i) => (
                            <CardBack
                                key={i}
                                size="xs"
                                style={{ '--i': i - (backs - 1) / 2 } as CSSProperties}
                            />
                        ))}
                    </span>
                    <b>{player.hand_count}</b>
                </button>
            </div>

            <div className="active-board-sets">
                <PropertySets
                    sets={player.sets}
                    size="sm"
                    emptyLabel={t('sets.empty_short')}
                    dimDisabled={false}
                />
            </div>
        </section>
    );
}
