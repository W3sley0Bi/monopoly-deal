import type { PlayerView } from '../types';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import PlayingCard from './PlayingCard';
import PropertySets from './PropertySets';

interface Props {
    player: PlayerView;
    isTurn?: boolean;
}

/** A player's whole board. Used in the sheet on phones. */
export default function PlayerBoard({ player, isTurn }: Props) {
    const { t } = useI18n();

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-black/30 px-2 py-1">🂠 {t('board.in_hand', { count: player.hand_count })}</span>
                <span className="rounded-md bg-black/30 px-2 py-1 text-emerald-300">{t('board.banked', { amount: money(t, player.bank_total) })}</span>
                <span className="rounded-md bg-black/30 px-2 py-1 text-brass">{t('board.sets', { count: player.complete_sets })}</span>
                <span className="rounded-md bg-black/30 px-2 py-1">{t('board.in_play', { amount: money(t, player.asset_total) })}</span>
                {isTurn && <span className="rounded-full bg-brass px-2 py-0.5 font-bold text-ink">{t('board.their_turn')}</span>}
                {!player.connected && <span className="text-white/40">{t('opponent.away')}</span>}
            </div>

            <div>
                <p className="label-caps mb-1.5">{t('board.properties')}</p>
                <div className="flex flex-wrap gap-3 pb-1">
                    <PropertySets sets={player.sets} size="sm" />
                </div>
            </div>

            <div>
                <p className="label-caps mb-1.5">{t('board.bank')}</p>
                {player.bank.length === 0 ? (
                    <p className="text-xs italic text-white/35">{t('board.bank_empty')}</p>
                ) : (
                    <div className="flex flex-wrap gap-1 pb-1">
                        {player.bank.map(c => <PlayingCard key={c.id} card={c} size="xs" banked />)}
                    </div>
                )}
            </div>
        </div>
    );
}
