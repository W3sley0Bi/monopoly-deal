import { useEffect, useRef } from 'react';
import type { PlayBubble } from '../game/usePlayBubbles';
import type { GameView } from '../types';

const PARTICLES = 6;
const DUST = ['🍂', '🍃'];

/** Scatters a few leaves out from `el`'s centre, drifting on the wind and
 *  fading — the visible half of a discard nobody chose. */
function burstAt(el: Element) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < PARTICLES; i += 1) {
        const chip = document.createElement('div');
        chip.className = 'discard-dust';
        chip.textContent = DUST[i % DUST.length];
        chip.style.left = `${cx}px`;
        chip.style.top = `${cy}px`;
        document.body.append(chip);
        const angle = (Math.PI * 2 * i) / PARTICLES + Math.random() * 0.6;
        const dist = 60 + Math.random() * 70;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 50;
        const spin = (Math.random() > 0.5 ? 1 : -1) * (160 + Math.random() * 120);
        const anim = chip.animate(
            [
                { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin}deg) scale(0.4)`, opacity: 0 },
            ],
            { duration: 850 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' },
        );
        anim.onfinish = () => chip.remove();
    }
}

/**
 * The wind that carries an over-limit hand's discards away, for every
 * player at the table — not only the one it happened to. The log entry
 * already says who and how many; this is just the half a line of text
 * cannot show.
 */
export default function DiscardBurst({
    plays,
    you,
    players,
}: {
    plays: Record<string, PlayBubble>;
    you: string;
    players: GameView['players'];
}) {
    const seen = useRef(new Set<number>());
    useEffect(() => {
        for (const [name, bubble] of Object.entries(plays)) {
            if (bubble.entry.key !== 'log.discarded_excess') continue;
            if (seen.current.has(bubble.id)) continue;
            seen.current.add(bubble.id);
            const player = players.find(p => p.name === name);
            if (!player) continue;
            const el = player.id === you
                ? document.querySelector('.hand-zone')
                : document.querySelector(`[data-player-id="${player.id}"]`);
            if (el) burstAt(el);
        }
    }, [plays, you, players]);
    return null;
}
