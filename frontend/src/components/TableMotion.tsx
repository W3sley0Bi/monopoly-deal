import { useLayoutEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import type { GameView } from '../types';
import { wasPlacedByHand } from '../game/dragLayer';

type Position = { x: number; y: number; width: number; height: number };

/**
 * A card thrown across a table travels on a bow, not a ruler line. The bow is
 * perpendicular to the path and capped, so a short hop stays a hop while a
 * cross-table steal arcs. `side` flips it, which is what makes two cards in a
 * swap pass around each other instead of through each other.
 */
function bow(dx: number, dy: number, side: number): { x: number; y: number } {
    const distance = Math.hypot(dx, dy) || 1;
    const lift = Math.min(90, distance * 0.18);
    return { x: (-dy / distance) * lift * side, y: (dx / distance) * lift * side };
}
function position(el: Element): Position {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
}

/** Animate authoritative state changes, including draws, plays and asset transfers.
 * Only public cards and our own hand exist in the DOM; no opponent hand is inferred. */
export default function TableMotion({
    game,
    enabled,
}: {
    game: GameView;
    enabled: boolean;
}) {
    const { tCard } = useI18n();
    const previous = useRef(new Map<string, Position>());
    const previousZones = useRef(new Map<string, string>());
    const previousGame = useRef(game);
    useLayoutEffect(() => {
        const elements = Array.from(
            document.querySelectorAll<HTMLElement>(
                '.table-stage [data-card-id]',
            ),
        );
        const next = new Map(
            elements.map((el) => [el.dataset.cardId!, position(el)]),
        );
        const zone = (el: Element) => {
            const owner = el.closest('[data-player-id]')?.getAttribute('data-player-id') ?? game.you;
            const color = el.getAttribute('data-active-color') ?? '';
            if (el.closest('.hand-zone')) return `${owner}:hand`;
            if (el.closest('.property-zone, .opponent-properties')) return `${owner}:properties:${color}`;
            return el.closest('.bank-zone') ? `${owner}:bank` : 'discard';
        };
        const zones = new Map(
            elements.map((el) => [el.dataset.cardId!, zone(el)]),
        );
        const oldGame = previousGame.current;
        const reduced = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        const animations: Animation[] = [];
        const ghosts: HTMLElement[] = [];
        if (enabled && !reduced) {
            const deck = document.querySelector(
                '.table-center .card-back, .opponent-seats .card-back',
            );
            const deckPosition = deck
                ? position(deck)
                : {
                      x: innerWidth / 2,
                      y: innerHeight / 3,
                      width: 70,
                      height: 100,
                  };
            const actor = oldGame.players[oldGame.current_turn];
            const seat = Array.from(
                document.querySelectorAll('[data-player-id]'),
            ).find((el) => el.getAttribute('data-player-id') === actor?.id);
            const actorPosition = seat ? position(seat) : deckPosition;
            // Cards arriving in the same beat deal out one after another,
            // the way a dealer's hand works, instead of landing as one block.
            let arrivals = 0;
            // Alternating bow direction makes a two-card swap cross.
            let side = 1;
            elements.forEach((el) => {
                const id = el.dataset.cardId!;
                const to = next.get(id)!;
                const old = previous.current.get(id);
                if (old && previousZones.current.get(id) === zones.get(id))
                    return;
                // A card the player just carried here by hand is already where
                // they put it. Flying it again reads as a second drop nobody
                // made, which is the one move on the table that does not need
                // explaining.
                if (wasPlacedByHand(id)) return;
                const inHand = !!el.closest('.hand-zone');
                const from = old ?? (inHand ? deckPosition : actorPosition);
                if (!old && !inHand && previous.current.size === 0) return;
                const dx = from.x - to.x,
                    dy = from.y - to.y;
                if (Math.abs(dx) + Math.abs(dy) < 10) return;
                const curve = bow(-dx, -dy, side);
                side = -side;
                const delay = Math.min(4, arrivals) * 75;
                arrivals += 1;
                // Fly an inert copy above scrolling rails; animating the actual
                // destination would clip its travel inside the property strip.
                const ghost = el.cloneNode(true) as HTMLElement;
                ghost.removeAttribute('data-card-id');
                ghost.removeAttribute('data-selected');
                ghost.classList.remove('hand-card');
                ghost.classList.add('flight-card');
                ghost.setAttribute('aria-hidden', 'true');
                ghost.inert = true;
                Object.assign(ghost.style, {
                    left: `${to.x}px`,
                    top: `${to.y}px`,
                    width: `${el.offsetWidth}px`,
                    height: `${el.offsetHeight}px`,
                    margin: '0',
                    transform: 'none',
                });
                document.body.append(ghost);
                ghosts.push(ghost);
                const flight = ghost.animate(
                    [
                        {
                            transform: `translate(${dx}px, ${dy}px) rotate(-12deg) scale(${Math.min(1.7, from.width / to.width)})`,
                            opacity: old ? 1 : 0.2,
                        },
                        {
                            transform: `translate(${dx / 2 + curve.x}px, ${dy / 2 + curve.y}px) rotate(${-5 * side}deg) scale(1.06)`,
                            opacity: 1,
                            offset: 0.55,
                        },
                        {
                            transform: 'translate(0, 0) rotate(0) scale(1)',
                            opacity: 1,
                        },
                    ],
                    {
                        duration: 560,
                        delay,
                        fill: 'both',
                        easing: 'cubic-bezier(.16,1,.3,1)',
                    },
                );
                flight.onfinish = () => ghost.remove();
                animations.push(
                    flight,
                    // The real card stays invisible until its copy lands on it.
                    el.animate(
                        [
                            { opacity: 0 },
                            { opacity: 0, offset: 0.82 },
                            { opacity: 1 },
                        ],
                        { duration: 560, delay, fill: 'both' },
                    ),
                );
            });
            let publicSide = 1;
            const assets = (p: GameView['players'][number]) => [
                ...p.bank,
                ...p.sets.flatMap((set) => [...set.cards, ...set.buildings]),
            ];
            game.players
                .filter((p) => p.id !== game.you)
                .forEach((p) => {
                    const before = oldGame.players.find(
                        (old) => old.id === p.id,
                    );
                    if (!before) return;
                    const owned = new Set(assets(before).map((c) => c.id));
                    const target = Array.from(
                        document.querySelectorAll('[data-player-id]'),
                    ).find((el) => el.getAttribute('data-player-id') === p.id);
                    if (!target) return;
                    const to = position(target);
                    assets(p)
                        .filter((c) => !owned.has(c.id) && !next.has(c.id))
                        .forEach((card) => {
                            const oldOwner = oldGame.players.find((owner) =>
                                assets(owner).some((c) => c.id === card.id),
                            );
                            const source =
                                oldOwner &&
                                Array.from(
                                    document.querySelectorAll(
                                        '[data-player-id]',
                                    ),
                                ).find(
                                    (el) =>
                                        el.getAttribute('data-player-id') ===
                                        oldOwner.id,
                                );
                            const from =
                                previous.current.get(card.id) ??
                                (source ? position(source) : to);
                            const ghost = document.createElement('div');
                            ghost.className =
                                'card-face flight-card public-play';
                            ghost.setAttribute('aria-hidden', 'true');
                            ghost.textContent = tCard(card);
                            Object.assign(ghost.style, {
                                left: `${from.x + from.width / 2}px`,
                                top: `${from.y + from.height / 2}px`,
                            });
                            document.body.append(ghost);
                            ghosts.push(ghost);
                            // Straight from the old owner to the new one, on a
                            // bow. A swap animates as two of these with
                            // opposite bows, so the cards pass side by side.
                            const travelX = to.x - from.x;
                            const travelY = to.y + to.height - from.y;
                            const curve = bow(travelX, travelY, publicSide);
                            publicSide = -publicSide;
                            const flight = ghost.animate(
                                [
                                    {
                                        transform: 'scale(.5) rotate(-12deg)',
                                        opacity: 0,
                                    },
                                    {
                                        transform: `translate(${travelX * 0.18}px, ${travelY * 0.18}px) scale(1.12) rotate(4deg)`,
                                        opacity: 1,
                                        offset: 0.22,
                                    },
                                    {
                                        transform: `translate(${travelX * 0.55 + curve.x}px, ${travelY * 0.55 + curve.y}px) scale(1) rotate(${-7 * publicSide}deg)`,
                                        opacity: 1,
                                        offset: 0.62,
                                    },
                                    {
                                        transform: `translate(${travelX}px, ${travelY}px) scale(.45) rotate(0)`,
                                        opacity: 0,
                                    },
                                ],
                                {
                                    duration: 880,
                                    easing: 'cubic-bezier(.25,.7,.3,1)',
                                },
                            );
                            flight.onfinish = () => ghost.remove();
                            animations.push(flight);
                        });
                });
            // Opponent draws remain face-down, but travel from the shared deck.
            game.players
                .filter((p) => p.id !== game.you)
                .forEach((p) => {
                    const before = oldGame.players.find(
                        (old) => old.id === p.id,
                    );
                    if (!before || p.hand_count <= before.hand_count) return;
                    const target = Array.from(
                        document.querySelectorAll('[data-player-id]'),
                    ).find((el) => el.getAttribute('data-player-id') === p.id);
                    if (!target) return;
                    const to = position(target);
                    for (
                        let i = 0;
                        i < Math.min(5, p.hand_count - before.hand_count);
                        i++
                    ) {
                        const ghost = document.createElement('div');
                        ghost.className = 'card-back flight-card';
                        ghost.setAttribute('aria-hidden', 'true');
                        ghost.style.left = `${deckPosition.x}px`;
                        ghost.style.top = `${deckPosition.y}px`;
                        document.body.append(ghost);
                        ghosts.push(ghost);
                        const animation = ghost.animate(
                            [
                                { transform: 'rotate(-8deg)', opacity: 1 },
                                {
                                    transform: `translate(${to.x + to.width / 2 - deckPosition.x}px, ${to.y - deckPosition.y}px) rotate(12deg) scale(.5)`,
                                    opacity: 0,
                                },
                            ],
                            {
                                duration: 650,
                                delay: i * 85,
                                fill: 'both',
                                easing: 'cubic-bezier(.16,1,.3,1)',
                            },
                        );
                        animation.onfinish = () => ghost.remove();
                        animations.push(animation);
                    }
                });
        }
        previous.current = next;
        previousZones.current = zones;
        previousGame.current = game;
        return () => {
            animations.forEach((a) => a.cancel());
            ghosts.forEach((el) => el.remove());
        };
    }, [game, enabled, tCard]);
    return null;
}
