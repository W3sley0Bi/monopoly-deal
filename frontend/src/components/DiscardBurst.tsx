import { useEffect, useRef } from 'react';
import type { PlayBubble } from '../game/usePlayBubbles';
import type { Card, GameView } from '../types';
import { colorMeta, moneyMeta } from '../game/meta';

const DUST = ['🍂', '🍃'];
/** How long a card spends flying clear of the hand before it comes apart. */
const FLY_MS = 620;
/** How long the coming-apart itself takes. */
const DESTROY_MS = 340;

function cardTint(card: Card): string {
    if (card.type === 'money') return moneyMeta(card.value).hex;
    if (card.type === 'property' || card.type === 'property_wildcard') {
        return colorMeta(card.colors?.[0]).hex;
    }
    return '#c084fc';
}

function cardLabel(card: Card): string {
    return card.type === 'money' ? `$${card.value}M` : card.name;
}

/** A short-lived puff of leaves at one exact point — the moment a card that
 *  just flew clear of the hand comes apart, rather than one burst standing
 *  in for the whole handful. */
function puffAt(cx: number, cy: number, count: number) {
    for (let i = 0; i < count; i += 1) {
        const chip = document.createElement('div');
        chip.className = 'discard-dust';
        chip.textContent = DUST[i % DUST.length];
        chip.style.left = `${cx}px`;
        chip.style.top = `${cy}px`;
        document.body.append(chip);

        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const dist = 40 + Math.random() * 55;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 30;
        const spin = (Math.random() > 0.5 ? 1 : -1) * (160 + Math.random() * 140);

        const anim = chip.animate(
            [
                { transform: 'translate(-50%, -50%) rotate(0deg) scale(0.9)', opacity: 1, offset: 0 },
                {
                    transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) rotate(${spin * 0.6}deg) scale(0.8)`,
                    opacity: 0.9,
                    offset: 0.55,
                },
                {
                    transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 30}px)) rotate(${spin}deg) scale(0.3)`,
                    opacity: 0,
                    offset: 1,
                },
            ],
            { duration: 1000 + Math.random() * 400, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
        );
        anim.onfinish = () => chip.remove();
    }
}

/** One card, thrown clear of the hand and then gone — flown out first, so
 *  it reads as leaving from somewhere in particular, and only then broken
 *  apart into the leaves that `puffAt` scatters at the exact spot it lands. */
function flyAndDestroy(card: Card | null, origin: DOMRect, delay: number) {
    const startX = origin.left + origin.width * (0.2 + Math.random() * 0.6);
    const startY = origin.top + origin.height * (0.3 + Math.random() * 0.4);
    const dx = (Math.random() - 0.5) * 100;
    const dy = -100 - Math.random() * 70;
    const spin = (Math.random() - 0.5) * 40;

    const ghost = document.createElement('div');
    ghost.className = `discard-ghost ${card ? '' : 'discard-ghost-blank'}`;
    if (card) {
        ghost.style.setProperty('--ghost-tint', cardTint(card));
        ghost.textContent = cardLabel(card);
    } else {
        ghost.textContent = DUST[0];
    }
    ghost.style.left = `${startX}px`;
    ghost.style.top = `${startY}px`;
    document.body.append(ghost);

    const total = FLY_MS + DESTROY_MS;
    const anim = ghost.animate(
        [
            { transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1, filter: 'blur(0px)', offset: 0 },
            {
                transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin}deg) scale(1.05)`,
                opacity: 1,
                filter: 'blur(0px)',
                offset: FLY_MS / total,
            },
            {
                transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin * 1.6}deg) scale(1.4)`,
                opacity: 0,
                filter: 'blur(6px)',
                offset: 1,
            },
        ],
        { duration: total, delay, easing: 'cubic-bezier(.3,.68,.4,1)', fill: 'both' },
    );
    window.setTimeout(() => puffAt(startX + dx, startY + dy, 3), delay + FLY_MS);
    anim.onfinish = () => ghost.remove();
}

/** A beat of reaction over the hand it happened to — a card just got tossed
 *  without anyone choosing it, and that deserves a face, not just leaves. */
function spawnCry(cx: number, cy: number) {
    const img = document.createElement('img');
    img.className = 'discard-cry';
    img.src = '/discard-cry.gif';
    img.alt = '';
    img.style.left = `${cx}px`;
    img.style.top = `${cy}px`;
    document.body.append(img);
    const anim = img.animate(
        [
            { transform: 'translate(-50%, -55%) scale(0.4)', opacity: 0, offset: 0 },
            { transform: 'translate(-50%, -70%) scale(1.05)', opacity: 1, offset: 0.18 },
            { transform: 'translate(-50%, -70%) scale(1)', opacity: 1, offset: 0.72 },
            { transform: 'translate(-50%, -85%) scale(0.85)', opacity: 0, offset: 1 },
        ],
        { duration: 2100, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' },
    );
    anim.onfinish = () => img.remove();
}

/**
 * The wind that carries an over-limit hand's discards away, for every
 * player at the table — not only the one it happened to.
 *
 * For your own hand the exact cards are known (they were just in it, a beat
 * ago), so this shows the real cards flying clear before they come apart.
 * An opponent's hand is never visible to begin with, so theirs falls back
 * to an unlabelled puff sized to how many the log says went — the honest
 * amount of detail the server actually reveals about somebody else's hand.
 */
export default function DiscardBurst({
    plays,
    you,
    players,
    myHand,
    cryEnabled,
}: {
    plays: Record<string, PlayBubble>;
    you: string;
    players: GameView['players'];
    myHand: Card[] | undefined;
    cryEnabled: boolean;
}) {
    const seen = useRef(new Set<number>());
    // What your hand looked like as of the last render — read before this
    // effect updates it, so it always lags one render behind `myHand`.
    const previousHand = useRef<Card[]>(myHand ?? []);

    useEffect(() => {
        for (const [name, bubble] of Object.entries(plays)) {
            if (bubble.entry.key !== 'log.discarded_excess') continue;
            if (seen.current.has(bubble.id)) continue;
            seen.current.add(bubble.id);
            const player = players.find(p => p.name === name);
            if (!player) continue;
            const isMe = player.id === you;
            const el = isMe
                ? document.querySelector('.hand-zone')
                : document.querySelector(`[data-player-id="${player.id}"]`);
            if (!el) continue;
            const origin = el.getBoundingClientRect();

            const lost = isMe
                ? previousHand.current.filter(c => !(myHand ?? []).some(h => h.id === c.id))
                : [];
            const count = lost.length || Number(bubble.entry.args?.count ?? 1) || 1;

            if (lost.length > 0) {
                lost.forEach((card, i) => flyAndDestroy(card, origin, i * 90));
            } else {
                for (let i = 0; i < count; i += 1) flyAndDestroy(null, origin, i * 90);
            }

            if (cryEnabled) {
                window.setTimeout(
                    () => spawnCry(origin.left + origin.width / 2, origin.top + origin.height / 2),
                    FLY_MS * 0.6,
                );
            }
        }
        previousHand.current = myHand ?? previousHand.current;
    }, [plays, you, players, myHand, cryEnabled]);
    return null;
}
