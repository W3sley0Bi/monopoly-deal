import type { ChatMessage, PlayerView } from '../types';
import { colorMeta } from '../game/meta';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import { PlayBubble, ReactionBubble } from './Reactions';
import Avatar from './Avatar';

interface Props {
    player: PlayerView;
    isTurn: boolean;
    isTargeted?: boolean;
    stream?: MediaStream | null;
    inCall?: boolean;
    /** Fill the available width when only a couple of opponents are seated. */
    grow?: boolean;
    onOpen: () => void;
    reaction?: ChatMessage;
    /** The move this player just made, already translated. */
    play?: string;
    /** Changes with each move, so a repeat still replays the animation. */
    playKey?: number;
}

/**
 * The phone-sized view of an opponent: identity, what they are holding, and a
 * colour bar summarising their sets. Tapping opens their full board in a sheet,
 * so the table stays inside one vertical screen.
 */
export default function PlayerChip({ player, isTurn, isTargeted, stream, inCall, grow, onOpen, reaction, play, playKey }: Props) {
    const { t } = useI18n();

    return (
        <button
            type="button"
            data-player-id={player.id}
            onClick={onOpen}
            className={[
                'panel relative flex shrink-0 flex-col gap-1.5 p-2 text-left transition',
                grow ? 'min-w-[9.5rem] flex-1' : 'w-[10.5rem]',
                isTurn ? '!border-brass/70' : '',
                isTargeted ? '!border-rose-400/80' : '',
            ].join(' ')}
        >
            {reaction && <ReactionBubble key={reaction.id} message={reaction} />}
            {play && !reaction && <PlayBubble key={playKey} text={play} />}
            <div className="flex min-w-0 items-center gap-1.5">
                <Avatar id={player.id} name={player.name} size={28} active={isTurn} away={!player.connected} inCall={Boolean(stream || inCall)} inCallLabel={t('call.in_call')} />
                <span className="min-w-0 flex-1 truncate font-display text-base leading-none tracking-wide">
                    {player.name}
                </span>
                {(stream || inCall) && <span className="call-tag" title={t('call.in_call')}>{t('call.in_call')}</span>}
            </div>

            <div className="flex items-center gap-2 text-[0.7rem] text-white/70">
                <span title={t('opponent.hand_title')}>🂠 {player.hand_count}</span>
                <span className="text-emerald-300" title={t('opponent.bank_title')}>{money(t, player.bank_total)}</span>
                <span className="ml-auto flex items-center gap-0.5" title={t('opponent.sets_title')}>
                    {[0, 1, 2].map(i => (
                        <span
                            key={i}
                            className={`h-1.5 w-1.5 rounded-sm ${i < player.complete_sets ? 'bg-brass' : 'bg-white/20'}`}
                        />
                    ))}
                </span>
            </div>

            {/* Their colour groups at a glance: width shows progress. */}
            {player.sets.length === 0 ? (
                <p className="text-[0.65rem] italic text-white/30">{t('sets.empty_short')}</p>
            ) : (
                <div className="chip-sets flex gap-0.5">
                    {player.sets.map(s => (
                        <span
                            key={s.color}
                            className="rounded-full"
                            style={{
                                background: colorMeta(s.color).hex,
                                flex: s.cards.length,
                                opacity: s.complete ? 1 : 0.55,
                            }}
                        />
                    ))}
                </div>
            )}
        </button>
    );
}
