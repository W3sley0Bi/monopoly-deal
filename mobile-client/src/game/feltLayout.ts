import type { Color } from '../types';

/** The physical mat always has five chairs, even when some are empty. */
export const TABLE_SEAT_COUNT = 5;

/** One slot for every property colour supported by the rules. */
export const PROPERTY_SLOT_COUNT = 10;

export type PropertySlot = Color | null;

const PLAYER_SEAT_SLOTS: Record<number, readonly number[]> = {
    0: [],
    1: [0],
    2: [0, 2],
    3: [0, 2, 3],
    4: [0, 1, 2, 4],
    5: [0, 1, 2, 3, 4],
};

/**
 * Maps players, ordered from the local player clockwise, onto the permanent
 * five-chair topology. Sparse games use the far chairs before the side chairs
 * so the centre stays readable without inventing a different ring.
 */
export function tableSeatSlots(playerCount: number): readonly number[] {
    const count = Math.max(0, Math.min(TABLE_SEAT_COUNT, playerCount));
    return PLAYER_SEAT_SLOTS[count];
}

/**
 * Keeps a player's property colours in the slots they first claimed.
 *
 * Missing colours vacate their cells without compacting the row. Newly seen
 * colours then claim the earliest vacancy in current server order, which is
 * the order sets were first created by the rules engine.
 */
export function reconcilePropertySlots(
    previous: readonly PropertySlot[] | undefined,
    currentColors: readonly Color[],
): PropertySlot[] {
    const current = new Set(currentColors);
    const next: PropertySlot[] = Array<PropertySlot>(PROPERTY_SLOT_COUNT).fill(null).map((_, index) => {
        const color = previous?.[index] ?? null;
        return color && current.has(color) ? color : null;
    });

    for (const color of currentColors) {
        if (next.includes(color)) continue;
        const vacancy = next.indexOf(null);
        if (vacancy < 0) break;
        next[vacancy] = color;
    }

    return next;
}
