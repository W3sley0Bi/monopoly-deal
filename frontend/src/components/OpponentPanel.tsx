import type { PlayerView } from '../types';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import Avatar from './Avatar';
import { CardBack } from './PlayingCard';
import PropertySets from './PropertySets';
import VideoTile from './VideoTile';

interface Props {
    player: PlayerView;
    isTurn: boolean;
    /** Highlights a player currently being acted upon. */
    isTargeted?: boolean;
    /** This player's camera, once their stream arrives. */
    stream?: MediaStream | null;
    /** They are in the call, even if their video has not connected yet. */
    inCall?: boolean;
}

export default function OpponentPanel({ player, isTurn, isTargeted, stream, inCall }: Props) {
    const { t } = useI18n();
    const fan = Math.min(player.hand_count, 6);

    return (
        <div
            className={[
                'panel w-[19rem] shrink-0 p-3 transition-shadow',
                isTurn ? 'animate-pulse-ring !border-brass/70' : '',
                isTargeted ? '!border-rose-400/70' : '',
            ].join(' ')}
        >
            {(stream || inCall) && (
                <VideoTile
                    stream={stream ?? null}
                    label={player.name}
                    camOff={!stream}
                    className="float-right ml-2 h-[3.25rem] w-[4.5rem]"
                />
            )}

            <div className="mb-2 flex items-center gap-2">
                <Avatar id={player.id} name={player.name} size={34} active={isTurn} away={!player.connected} />
                <h3 className="truncate font-display text-xl tracking-wide">{player.name}</h3>
                {!player.connected && <span className="text-[0.6rem] uppercase tracking-wide text-white/40">{t('opponent.away')}</span>}
                {isTurn && <span className="ml-auto rounded-full bg-brass px-2 py-0.5 text-[0.6rem] font-black uppercase text-ink">{t('opponent.turn')}</span>}
            </div>

            <div className="mb-2 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 rounded-md bg-black/30 px-2 py-1" title={t('opponent.hand_title')}>
                    🂠 <span className="font-bold">{player.hand_count}</span>
                </span>
                <span className="flex items-center gap-1 rounded-md bg-black/30 px-2 py-1 text-emerald-300" title={t('opponent.bank_title')}>
                    💵 <span className="font-bold">{money(t, player.bank_total)}</span>
                </span>
                <span className="flex items-center gap-1 rounded-md bg-black/30 px-2 py-1">
                    {[0, 1, 2].map(i => (
                        <span
                            key={i}
                            className={`h-2 w-2 rounded-sm ${i < player.complete_sets ? 'bg-brass' : 'bg-white/15'}`}
                        />
                    ))}
                    <span className="ml-1 font-bold">{player.complete_sets}/3</span>
                </span>
            </div>

            <div className="mb-2 flex h-10 items-start">
                {Array.from({ length: fan }).map((_, i) => (
                    <CardBack
                        key={i}
                        size="xs"
                        className={`!h-10 !w-7 origin-bottom ${i > 0 ? '-ml-3' : ''}`}
                        style={{ transform: `rotate(${(i - (fan - 1) / 2) * 5}deg)` }}
                    />
                ))}
                {player.hand_count > fan && (
                    <span className="ml-2 self-center text-xs text-white/45">+{player.hand_count - fan}</span>
                )}
            </div>

            <div className="max-h-36 overflow-y-auto">
                <PropertySets sets={player.sets} size="xs" emptyLabel={t('sets.empty_short')} />
            </div>
        </div>
    );
}
