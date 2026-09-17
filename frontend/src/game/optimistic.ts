import type { Card, Color, PlayerView, RoomView, SetView } from '../types';

/**
 * The deterministic slice of a turn: moves whose result the client already
 * knows before the server answers, because nothing about them depends on
 * hidden information (another player's hand, a shuffled deck) or another
 * player's response. Placing a property, moving a wildcard and banking a
 * card all resolve from what is already on screen.
 *
 * Rent cards, `pass_go` and every targeted action are left out on purpose:
 * their result depends on the deck, another player's cards, or another
 * player's answer, so there is nothing honest to predict. Discarding is
 * not a player move at all any more — the server drops excess cards itself
 * at the end of a turn.
 */
export type PendingMove =
    | { type: 'play_property'; cardId: string; color: Color }
    | { type: 'move_wildcard'; cardId: string; color: Color }
    | { type: 'play_bank'; cardId: string };

const withoutEmpty = (sets: SetView[]): SetView[] =>
    sets.filter(s => s.cards.length > 0 || s.buildings.length > 0);

/** Adds `card` to `color`'s set among `sets`, creating the set if this is its first card. */
function addToSet(sets: SetView[], color: Color, card: Card, size: number): SetView[] {
    const existing = sets.find(s => s.color === color);
    if (existing) {
        const cards = [...existing.cards, card];
        return sets.map(s => (s === existing ? { ...s, cards, complete: cards.length >= s.size } : s));
    }
    const fresh: SetView = { color, cards: [card], buildings: [], size, complete: size <= 1, rent: 0 };
    return [...sets, fresh];
}

/**
 * Applies one predicted move on top of the latest room the server sent.
 * Only the acting player's own view changes — nothing about an opponent is
 * guessed at. Falls back to `room` unchanged if the card the move names has
 * already left the hand (or set) it expects, which means the real answer
 * already arrived and there is nothing left to predict.
 */
export function applyOptimistic(room: RoomView, move: PendingMove): RoomView {
    const g = room.game;
    const meIndex = g.players.findIndex(p => p.id === g.you);
    const me = g.players[meIndex];
    if (!me?.hand) return room;

    let nextMe: PlayerView = me;
    let playsLeft = g.plays_left;

    if (move.type === 'play_property' || move.type === 'play_bank') {
        const card = me.hand.find(c => c.id === move.cardId);
        if (!card) return room;
        const hand = me.hand.filter(c => c.id !== move.cardId);

        if (move.type === 'play_property') {
            const size = g.set_sizes[move.color] ?? 3;
            const sets = withoutEmpty(addToSet(me.sets, move.color, card, size));
            nextMe = { ...me, hand, sets, complete_sets: sets.filter(s => s.complete).length };
        } else {
            nextMe = { ...me, hand, bank: [...me.bank, card], bank_total: me.bank_total + card.value };
        }
        playsLeft = Math.max(0, g.plays_left - 1);
    } else {
        // move_wildcard: the card is already on the board, in some other set.
        const from = me.sets.find(s => s.cards.some(c => c.id === move.cardId));
        const card = from?.cards.find(c => c.id === move.cardId);
        if (!from || !card) return room;
        const size = g.set_sizes[move.color] ?? 3;
        const left = { ...from, cards: from.cards.filter(c => c.id !== move.cardId) };
        const withoutOld = me.sets.map(s => (s === from ? left : s));
        const sets = withoutEmpty(addToSet(withoutOld, move.color, card, size));
        nextMe = { ...me, sets, complete_sets: sets.filter(s => s.complete).length };
        playsLeft = Math.max(0, g.plays_left - 1);
    }

    const players = g.players.map((p, i) => (i === meIndex ? nextMe : p));
    return { ...room, game: { ...g, players, plays_left: playsLeft } };
}

/** Whether the real state from the server already reflects this move — win
 *  or refusal, either way the round trip is over and the guess can retire. */
export function moveSettled(room: RoomView, move: PendingMove): boolean {
    const me = room.game.players.find(p => p.id === room.game.you);
    if (!me?.hand) return true;
    if (move.type === 'move_wildcard') {
        // The card never leaves the board on this move, only its colour does,
        // so "settled" means it has actually arrived in the set predicted —
        // a refusal leaves it where it started, which this never satisfies,
        // and the timeout in Table.tsx is what retires the guess then.
        return me.sets.some(s => s.color === move.color && s.cards.some(c => c.id === move.cardId));
    }
    return !me.hand.some(c => c.id === move.cardId);
}
