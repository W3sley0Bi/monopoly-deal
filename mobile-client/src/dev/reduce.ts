/**
 * The smallest possible stand-in for the rules engine, for dev fixtures only.
 *
 * A fixture room does not exist on the server, so its moves have nowhere to go.
 * Rather than swallow them and leave a dead table, these few messages are
 * applied locally — enough to watch a card leave your hand and land somewhere,
 * which is what the fixtures are for. It is deliberately *not* a rules engine:
 * it validates nothing, charges nothing, and the real game never reaches it.
 */
import type { Card, ClientMessage, RoomView, SetView } from '../types';

const RENT: Record<string, number[]> = {
    brown: [1, 2], lightblue: [1, 2, 3], pink: [1, 2, 4], orange: [1, 3, 5],
    red: [2, 3, 6], yellow: [2, 4, 6], green: [2, 4, 7], blue: [3, 8],
    railroad: [1, 2, 3, 4], utility: [1, 2],
};

function rentFor(set: SetView): number {
    const table = RENT[set.color] ?? [1, 2, 3];
    const base = table[Math.min(set.cards.length, table.length) - 1] ?? 0;
    const house = set.buildings.some(b => b.action === 'house') ? 3 : 0;
    const hotel = set.buildings.some(b => b.action === 'hotel') ? 4 : 0;
    return base + house + hotel;
}

function retotal(room: RoomView, playerId: string, mutate: (player: RoomView['game']['players'][number]) => void): RoomView {
    const players = room.game.players.map(p => {
        if (p.id !== playerId) return p;
        const next = { ...p, bank: [...p.bank], sets: p.sets.map(s => ({ ...s, cards: [...s.cards], buildings: [...s.buildings] })), hand: p.hand ? [...p.hand] : undefined };
        mutate(next);
        next.sets = next.sets.map(s => ({ ...s, complete: s.cards.length >= s.size, rent: rentFor(s) }));
        next.bank_total = next.bank.reduce((sum, c) => sum + c.value, 0);
        next.complete_sets = next.sets.filter(s => s.complete).length;
        next.asset_total = next.bank_total + next.sets.flatMap(s => s.cards).reduce((sum, c) => sum + c.value, 0);
        next.hand_count = next.hand?.length ?? next.hand_count;
        return next;
    });
    return { ...room, game: { ...room.game, players } };
}

/** A card off the dev deck. Money, because it needs no colour to be legal. */
let drawn = 0;
function devMoney(value: number): Card {
    return { id: `drawn${drawn++}`, key: `card.money_${value}`, type: 'money', name: `$${value}M`, value };
}

function take(player: { hand?: Card[] }, cardId?: string): Card | null {
    if (!cardId || !player.hand) return null;
    const index = player.hand.findIndex(c => c.id === cardId);
    if (index < 0) return null;
    return player.hand.splice(index, 1)[0];
}

/** Returns the room unchanged for anything it does not understand. */
export function applyDevMove(room: RoomView, msg: Omit<ClientMessage, 'player_id'>): RoomView {
    const you = room.you;

    switch (msg.type) {
        case 'play_property':
            return retotal(room, you, (p) => {
                const card = take(p, msg.card_id);
                if (!card || !msg.color) return;
                const set = p.sets.find(s => s.color === msg.color);
                if (set) set.cards.push(card);
                else p.sets.push({ color: msg.color, cards: [card], buildings: [], size: 3, complete: false, rent: 0 });
            });

        case 'play_bank':
            return retotal(room, you, (p) => {
                const card = take(p, msg.card_id);
                if (card) p.bank.push(card);
            });

        case 'move_wildcard':
            return retotal(room, you, (p) => {
                let moved: Card | null = null;
                for (const set of p.sets) {
                    const index = set.cards.findIndex(c => c.id === msg.card_id);
                    if (index >= 0) {
                        moved = set.cards.splice(index, 1)[0];
                        break;
                    }
                }
                if (!moved || !msg.color) return;
                const set = p.sets.find(s => s.color === msg.color);
                if (set) set.cards.push(moved);
            });

        case 'play_action': {
            // House and hotel are the interesting ones: they are what turns a
            // finished set into a building on the felt.
            let drew = 0;
            const next = retotal(room, you, (p) => {
                const card = take(p, msg.card_id);
                if (!card) return;
                if ((card.action === 'house' || card.action === 'hotel') && msg.color) {
                    const set = p.sets.find(s => s.color === msg.color);
                    if (set) {
                        set.buildings.push(card);
                        return;
                    }
                }
                if (card.action === 'pass_go' && p.hand) {
                    // Two cards actually arrive, because the flight animation on
                    // the felt is driven by hand counts: banking the card the
                    // way everything else here does would take one card *out*
                    // of the hand and the deck would never deal anything.
                    p.hand.push(devMoney(1), devMoney(2));
                    drew = 2;
                    return;
                }
                // Anything else just goes to the discard, below.
                p.bank.push(card);
            });
            if (!drew) return next;
            return {
                ...next,
                game: { ...next.game, deck_count: Math.max(0, next.game.deck_count - drew) },
            };
        }

        case 'end_turn':
            return {
                ...room,
                game: {
                    ...room.game,
                    current_turn: (room.game.current_turn + 1) % Math.max(1, room.game.players.length),
                    plays_left: 3,
                },
            };

        default:
            return room;
    }
}
