import type { ChatMessage, PlayerView } from '../types';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import HoverDetails from './HoverDetails';
import { PlayBubble, ReactionBubble } from './Reactions';
import Avatar from './Avatar';
import { CardBack } from './PlayingCard';

interface Props {
    player: PlayerView;
    isTurn: boolean;
    isTargeted?: boolean;
    onOpen: () => void;
    reaction?: ChatMessage;
    /** The move this player just made, already translated. */
    play?: string;
    /** Changes with each move, so a repeat still replays the animation. */
    playKey?: number;
}

export default function OpponentPanel({
    player,
    isTurn,
    isTargeted,
    onOpen,
    reaction,
    play,
    playKey,
}: Props) {
    const { t, tCard } = useI18n();
    const fan = Math.min(player.hand_count, 7);
    return (
        <div
            data-player-id={player.id}
            className={`opponent-seat ${isTurn ? 'seat-active' : ''} ${isTargeted ? 'seat-targeted' : ''}`}
        >
            {reaction && (
                <ReactionBubble key={reaction.id} message={reaction} />
            )}
            {play && !reaction && <PlayBubble key={playKey} text={play} />}
            <HoverDetails
                content={
                    <div className="player-inspection">
                        <p className="label-caps">{t('table.their_board')}</p>
                        <h3>{player.name}</h3>
                        <dl>
                            <div>
                                <dt>{t('opponent.hand_title')}</dt>
                                <dd>{player.hand_count}</dd>
                            </div>
                            <div>
                                <dt>{t('board.bank')}</dt>
                                <dd>{money(t, player.bank_total)}</dd>
                            </div>
                            <div>
                                <dt>{t('opponent.sets_title')}</dt>
                                <dd>{player.complete_sets}/3</dd>
                            </div>
                            <div>
                                <dt>{t('inspect.assets')}</dt>
                                <dd>{money(t, player.asset_total)}</dd>
                            </div>
                        </dl>
                        <p className="inspection-note">
                            {t('inspect.open_board')}
                        </p>
                    </div>
                }
            >
                <button
                    type="button"
                    className="seat-profile"
                    onClick={onOpen}
                    aria-label={`${player.name}: ${t('table.their_board')}`}
                >
                    <span className="seat-avatar">
                        <Avatar
                            id={player.id}
                            name={player.name}
                            size={52}
                            active={isTurn}
                            away={!player.connected}
                        />
                        {isTurn && (
                            <span className="seat-turn">
                                {t('opponent.turn')}
                            </span>
                        )}
                    </span>
                    <span className="seat-info">
                        <strong>{player.name}</strong>
                        <span>
                            {player.bot
                                ? t('table.robot')
                                : !player.connected
                                  ? t('opponent.away')
                                  : t('table.player')}{' '}
                            <span aria-hidden="true">↗</span>
                        </span>
                    </span>
                </button>
            </HoverDetails>
            <div className="seat-assets">
                <span title={t('opponent.hand_title')}>
                    ▱ <b>{player.hand_count}</b>
                </span>
                <HoverDetails
                    content={
                        <div className="bank-inspection">
                            <p className="label-caps">{player.name}</p>
                            <h3>
                                {t('board.bank')} ·{' '}
                                {money(t, player.bank_total)}
                            </h3>
                            <p>{t('inspect.banked_rule')}</p>
                            <ul>
                                {player.bank.map((card) => (
                                    <li key={card.id}>
                                        <span>{tCard(card)}</span>
                                        <b>{money(t, card.value)}</b>
                                    </li>
                                ))}
                            </ul>
                            {!player.bank.length && (
                                <p>{t('board.bank_empty')}</p>
                            )}
                        </div>
                    }
                >
                    <button
                        type="button"
                        className="seat-bank"
                        onClick={onOpen}
                        aria-label={`${player.name}: ${t('board.bank')}, ${money(t, player.bank_total)}`}
                    >
                        {money(t, player.bank_total)}
                    </button>
                </HoverDetails>
                <span
                    title={t('opponent.sets_title')}
                    className="seat-progress"
                >
                    {[0, 1, 2].map((i) => (
                        <i
                            key={i}
                            className={
                                i < player.complete_sets ? 'complete' : ''
                            }
                        />
                    ))}
                    <b>{player.complete_sets}/3</b>
                </span>
            </div>
            <div className="seat-cards" aria-hidden="true">
                {Array.from({ length: fan }).map((_, i) => (
                    <CardBack
                        key={i}
                        size="xs"
                        style={{
                            transform: `translateY(${Math.abs(i - (fan - 1) / 2) * 2}px) rotate(${(i - (fan - 1) / 2) * 7}deg)`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
