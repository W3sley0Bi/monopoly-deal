import { describe, expect, it } from '@jest/globals';

import {
    FAN_HEADROOM,
    FAN_NUDGE,
    HAND_CARD_HEIGHT,
    HAND_CARD_WIDTH,
    fanLayout,
    fanNudge,
    fanRowMetrics,
    fanTilt,
} from '../src/game/handFan';

/** A phone's hand panel, free of its padding. */
const PHONE = 359;
const ids = (count: number) => Array.from({ length: count }, (_, i) => `c${i}`);

describe('fan geometry', () => {
    it('keeps a small hand at the natural overlap rather than spreading it', () => {
        const [row] = fanLayout(ids(3), PHONE);
        expect(row.step).toBe(HAND_CARD_WIDTH - 12);
        expect(row.width).toBeLessThan(PHONE);
    });

    it('tightens the overlap as the hand grows, and never past the card', () => {
        const three = fanLayout(ids(3), PHONE)[0].step;
        const nine = fanLayout(ids(9), PHONE)[0].step;
        expect(nine).toBeLessThan(three);
        expect(nine).toBeGreaterThan(0);
    });

    it('fits the row inside the width it was given', () => {
        for (const count of [1, 2, 5, 7, 9, 12]) {
            for (const row of fanLayout(ids(count), PHONE)) {
                expect(row.width).toBeLessThanOrEqual(PHONE);
            }
        }
    });

    it('leaves room on both sides for a neighbour to lean away', () => {
        const [row] = fanLayout(ids(9), PHONE);
        const lastCardRight = row.left[row.left.length - 1] + FAN_NUDGE + HAND_CARD_WIDTH;
        expect(row.left[0] + FAN_NUDGE).toBeGreaterThanOrEqual(FAN_NUDGE);
        expect(lastCardRight + FAN_NUDGE).toBeLessThanOrEqual(row.width);
    });

    it('reserves the pop headroom above the cards', () => {
        const [row] = fanLayout(ids(5), PHONE);
        expect(row.height).toBeGreaterThanOrEqual(HAND_CARD_HEIGHT + FAN_HEADROOM);
    });

    it('scales a roomy hand without shrinking its touch geometry', () => {
        const scale = 1.18;
        const [row] = fanLayout(ids(3), PHONE, scale);
        expect(row.strip[row.strip.length - 1]).toBeCloseTo(HAND_CARD_WIDTH * scale);
        expect(row.height).toBeGreaterThanOrEqual((HAND_CARD_HEIGHT + FAN_HEADROOM) * scale);
        expect(row.width).toBeLessThanOrEqual(PHONE);
    });

    it('wraps a hand too wide to keep its cards readable', () => {
        const wide = fanLayout(ids(9), PHONE);
        const narrow = fanLayout(ids(9), 240);
        expect(wide).toHaveLength(1);
        expect(narrow.length).toBeGreaterThan(1);
        expect(narrow.flatMap((row) => row.cards)).toEqual(ids(9));
    });

    it('balances wrapped rows instead of leaving a stub', () => {
        const rows = fanLayout(ids(9), 240);
        const sizes = rows.map((row) => row.cards.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    });

    it('places one card flat, with no tilt to divide', () => {
        const [row] = fanLayout(ids(1), PHONE);
        expect(row.left).toEqual([0]);
        expect(row.strip).toEqual([HAND_CARD_WIDTH]);
        expect(fanTilt(0, 1)).toEqual({ lift: 0, rotate: 0 });
    });

    it('tilts the fan symmetrically about its middle', () => {
        const left = fanTilt(0, 9);
        const right = fanTilt(8, 9);
        expect(left.rotate).toBeCloseTo(-right.rotate);
        expect(left.lift).toBeCloseTo(right.lift);
        expect(fanTilt(4, 9).rotate).toBeCloseTo(0);
    });

    it('leans neighbours away from the popped card, and moves the card itself sideways not at all', () => {
        expect(fanNudge(0, 4)).toBe(-FAN_NUDGE);
        expect(fanNudge(8, 4)).toBe(FAN_NUDGE);
        expect(fanNudge(4, 4)).toBe(0);
        expect(fanNudge(4, null)).toBe(0);
    });
});

/**
 * The strips are what a finger actually hits. Overlapping card boxes left it to
 * the platform to decide which card a touch belonged to, and it did not decide
 * it the way the fan looks — so these are the invariants that keep the decision
 * out of its hands.
 */
describe('touch strips', () => {
    it('gives every card a strip', () => {
        for (const count of [1, 3, 7, 9, 12]) {
            for (const row of fanLayout(ids(count), PHONE)) {
                expect(row.strip).toHaveLength(row.cards.length);
            }
        }
    });

    it('never overlaps two strips', () => {
        for (const count of [2, 5, 9, 12]) {
            for (const row of fanLayout(ids(count), PHONE)) {
                let edge = 0;
                for (const width of row.strip) {
                    expect(width).toBeGreaterThan(0);
                    edge += width;
                }
                expect(edge).toBeCloseTo(row.width - FAN_NUDGE * 2);
            }
        }
    });

    it('starts each strip where its card starts', () => {
        const [row] = fanLayout(ids(9), PHONE);
        let edge = 0;
        row.cards.forEach((_, index) => {
            expect(edge).toBeCloseTo(row.left[index]);
            edge += row.strip[index];
        });
    });

    it('covers a card only as far as the next card hides it', () => {
        const [row] = fanLayout(ids(9), PHONE);
        row.cards.forEach((_, index) => {
            if (index === row.cards.length - 1) {
                // Nothing in front of the last card, so all of it is its own.
                expect(row.strip[index]).toBe(HAND_CARD_WIDTH);
                return;
            }
            expect(row.strip[index]).toBeCloseTo(row.left[index + 1] - row.left[index]);
        });
    });

    it('keeps the last strip at the full card so the hand ends where it looks like it ends', () => {
        for (const count of [1, 4, 9]) {
            const [row] = fanLayout(ids(count), PHONE);
            expect(row.strip[row.cards.length - 1]).toBe(HAND_CARD_WIDTH);
        }
    });
});

describe('fanRowMetrics', () => {
    it('survives a width narrower than one card', () => {
        const metrics = fanRowMetrics(5, 10);
        expect(metrics.step).toBeGreaterThan(0);
        expect(Number.isFinite(metrics.width)).toBe(true);
    });
});
