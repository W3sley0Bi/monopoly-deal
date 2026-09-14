import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import Avatar from './Avatar';
import type { PlayerView } from '../types';

/** Long enough to read across the table, short enough to stay out of the way.
    The last quarter of it is the fade, which the CSS animation owns. */
const HOLD_MS = 2200;

interface Props {
    player?: PlayerView;
    isYou: boolean;
    /** Changes whenever the turn passes; a repeat of the same value is ignored. */
    turn: number;
    /** Suppressed during the reveal wheel and once the game is over. */
    enabled: boolean;
}

/**
 * Says whose turn it is, once, in letters big enough that nobody has to hunt
 * for the chip in the header to find out.
 */
export default function TurnBanner({ player, isYou, turn, enabled }: Props) {
    const { t } = useI18n();
    const [shown, setShown] = useState<number | null>(null);
    // Every server push hands over a fresh player object. Watching the object
    // itself re-announced the turn on each of them — playing a card made the
    // banner reappear. The identity that matters is the seat, not the object.
    const seat = player?.id;

    useEffect(() => {
        if (!enabled || !seat) return;
        setShown(turn);
        const timer = window.setTimeout(() => setShown(null), HOLD_MS);
        return () => window.clearTimeout(timer);
    }, [turn, enabled, seat]);

    if (shown === null || !player) return null;

    return (
        <div key={shown} className={`turn-banner ${isYou ? 'turn-banner-you' : ''}`} role="status" aria-live="polite">
            <Avatar id={player.id} name={player.name} size={52} />
            <strong>{isYou ? t('table.your_turn') : t('table.turn_of', { name: player.name })}</strong>
        </div>
    );
}
