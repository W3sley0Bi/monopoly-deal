import type { CSSProperties } from 'react';
import { Fragment } from 'react';
import type { PlayerView } from '../types';
import { colorMeta, moneyMeta } from '../game/meta';
import { useI18n } from '../i18n';
import HoverDetails from './HoverDetails';
import PlayerBoard from './PlayerBoard';

interface Props {
    players: PlayerView[];
    /** Your own id, so your place is the near edge of the table. */
    you: string;
    /** Whose turn it is, so their board opens already labelled as such. */
    turnId?: string;
    /**
     * Wide screens make a place big enough to point at, so hovering one opens
     * that player's whole board — which is why the seat panels no longer carry
     * a second copy of it. A phone has no pointer and its own way in, the chip
     * and the sheet, so the cards there stay a picture and nothing more.
     */
    interactive?: boolean;
}

/** Only the top of a pile is readable, so there is no point drawing more. */
const MAX_BANK = 4;
/** How many cards down the offset keeps growing before the pile goes flat. */
const PILE_DEPTH = 2;

/**
 * Everybody's played cards, laid out on the felt.
 *
 * A phone shows rivals as chips and the middle of the table as empty green,
 * which is the one part of the game that looks nothing like the game. These
 * are the cards on the table: no text, no handles, nothing to press — the
 * property in front of each seat and the bank stacked beside it, each place
 * turned to face whoever is sitting there, so the table reads from where you
 * are sitting rather than from nowhere.
 *
 * Every seat keeps its place for the life of the game whether it has played
 * anything or not. Laying them out around only the players who had played
 * meant the whole table shuffled itself each time somebody new put a card
 * down, and cards already on the felt do not move.
 */
export default function FeltCards({ players, you, turnId, interactive }: Props) {
    const { t } = useI18n();
    const start = players.findIndex(p => p.id === you);
    const seats = start < 0 ? players : [...players.slice(start), ...players.slice(0, start)];

    return (
        <div className={`felt-cards ${interactive ? 'felt-live' : ''}`} aria-hidden="true">
            {seats.map((player, seat) => {
                // Straight down is your own edge; the rest run round from it.
                const angle = Math.PI / 2 + (seat * 2 * Math.PI) / seats.length;
                // A seated player's cards face them, so the place is turned by
                // how far round the table it is: yours upright, the one across
                // from you upside down, the sides on their ends.
                // Only the direction is decided here. How far out a place
                // sits is a layout question, so the reach lives in CSS and can
                // differ between a phone and a table with room to spare.
                //
                // Facing snaps to a quarter turn. Sat at a real table people
                // square their cards to the edge in front of them; left at the
                // exact seat angle, a place at 45 or 72 degrees turns every
                // card into a diamond, which reads as debris rather than as
                // somebody's hand laid out.
                const face = Math.round(((angle * 180) / Math.PI - 90) / 90) * 90;
                const style = {
                    '--ux': Math.cos(angle).toFixed(4),
                    '--uy': Math.sin(angle).toFixed(4),
                    '--face': `${face}deg`,
                } as CSSProperties;
                // Highest note on top: a pile shows its best card.
                const bank = [...player.bank]
                    .sort((a, b) => a.value - b.value)
                    .slice(-MAX_BANK);

                const pile = (
                    <div className="felt-pile" style={style}>
                        <span className="felt-props">
                            {player.sets.map(set => {
                                const meta = colorMeta(set.color);
                                return (
                                    <span
                                        key={set.color}
                                        className={`felt-set ${set.complete ? 'felt-set-complete' : ''}`}
                                    >
                                        {set.cards.map((card, i) => (
                                            <i
                                                key={card.id}
                                                style={{
                                                    '--c': meta.hex,
                                                    // Nobody lays a card down square.
                                                    '--r': `${((i * 7 + set.color.length * 3) % 5) - 2}deg`,
                                                } as CSSProperties}
                                            />
                                        ))}
                                    </span>
                                );
                            })}
                        </span>

                        {/* A real pile: the note on top is readable, the one under
                            it shows an edge, and the rest are only depth. */}
                        {bank.length > 0 && (
                            <span className="felt-money">
                                {bank.map((card, i) => {
                                    const meta = moneyMeta(card.value);
                                    const depth = Math.min(bank.length - 1 - i, PILE_DEPTH);
                                    const top = depth === 0;
                                    return (
                                        <i
                                            key={card.id}
                                            style={{
                                                '--c': meta.hex,
                                                '--ink': meta.ink,
                                                '--d': depth,
                                                '--r': `${(card.value % 3) - 1}deg`,
                                                zIndex: i,
                                            } as CSSProperties}
                                        >
                                            {top ? card.value : ''}
                                        </i>
                                    );
                                })}
                            </span>
                        )}
                    </div>
                );

                // A phone has no pointer to hover with, and its own way in.
                if (!interactive) return <Fragment key={player.id}>{pile}</Fragment>;
                return (
                    <HoverDetails
                        key={player.id}
                        sticky
                        content={
                            <div className="felt-board">
                                <p className="label-caps">{t('table.their_board')}</p>
                                <h3>{player.name}</h3>
                                <PlayerBoard player={player} isTurn={player.id === turnId} />
                            </div>
                        }
                    >
                        {pile}
                    </HoverDetails>
                );
            })}
        </div>
    );
}
