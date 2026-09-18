import { describe, expect, it } from '@jest/globals';

import { PROPERTY_SLOT_COUNT, reconcilePropertySlots, tableSeatSlots } from '../src/game/feltLayout';

describe('fixed felt layout', () => {
    it('always assigns players to the permanent five-seat topology', () => {
        expect(tableSeatSlots(2)).toEqual([0, 2]);
        expect(tableSeatSlots(3)).toEqual([0, 2, 3]);
        expect(tableSeatSlots(5)).toEqual([0, 1, 2, 3, 4]);
    });

    it('allocates new colours in first-seen order', () => {
        const slots = reconcilePropertySlots(undefined, ['orange', 'blue', 'brown']);

        expect(slots).toHaveLength(PROPERTY_SLOT_COUNT);
        expect(slots.slice(0, 4)).toEqual(['orange', 'blue', 'brown', null]);
    });

    it('does not move surviving colours when a middle set disappears', () => {
        const before = reconcilePropertySlots(undefined, ['orange', 'blue', 'brown']);
        const after = reconcilePropertySlots(before, ['orange', 'brown']);

        expect(after.slice(0, 4)).toEqual(['orange', null, 'brown', null]);
    });

    it('puts a newly acquired colour into the earliest vacant slot', () => {
        const before = reconcilePropertySlots(undefined, ['orange', 'blue', 'brown']);
        const vacancy = reconcilePropertySlots(before, ['orange', 'brown']);
        const after = reconcilePropertySlots(vacancy, ['orange', 'brown', 'green']);

        expect(after.slice(0, 4)).toEqual(['orange', 'green', 'brown', null]);
    });

    it('ignores snapshot reordering for colours that already own slots', () => {
        const before = reconcilePropertySlots(undefined, ['orange', 'blue', 'brown']);
        const after = reconcilePropertySlots(before, ['brown', 'orange', 'blue']);

        expect(after).toEqual(before);
    });
});
