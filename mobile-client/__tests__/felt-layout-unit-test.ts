import { describe, expect, it } from '@jest/globals';

import {
    FLAT_CAMERA,
    PROPERTY_SLOT_COUNT,
    TILTED_CAMERA,
    fitFlatRing,
    fitTiltedRing,
    flatSeatCorners,
    projectFelt,
    reconcilePropertySlots,
    tableSeatSlots,
    tiltedChair,
    tiltedPileScale,
    unprojectFeltY,
} from '../src/game/feltLayout';

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

describe('tilted felt', () => {
    const pile = { pileW: 136, pileH: 54, pileScale: 1.25, minPileScale: 0.75 };
    const chip = { w: 150, h: 76 };
    const overlaps = (a: { cx: number; cy: number; w: number; h: number }, b: typeof a) =>
        Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2;

    it('is the identity when flat, so phones keep their ring', () => {
        expect(projectFelt(40, -70, FLAT_CAMERA)).toEqual({ x: 40, y: -70, k: 1 });
    });

    it('draws the far side smaller and flatter than the near side', () => {
        const far = projectFelt(0, -200, TILTED_CAMERA);
        const near = projectFelt(0, 200, TILTED_CAMERA);
        expect(far.k).toBeLessThan(1);
        expect(near.k).toBeGreaterThan(1);
        expect(Math.abs(far.y)).toBeLessThan(near.y);
        expect(unprojectFeltY(near.y, TILTED_CAMERA)).toBeCloseTo(200);
        expect(unprojectFeltY(far.y, TILTED_CAMERA)).toBeCloseTo(-200);
    });

    it('keeps the ring a mirror-symmetric pentagon', () => {
        const left = tiltedChair(1, 250, { ...pile, chipGap: 10 });
        const right = tiltedChair(4, 250, { ...pile, chipGap: 10 });
        expect(left.seat.cx).toBeCloseTo(-right.seat.cx);
        expect(left.seat.cy).toBeCloseTo(right.seat.cy);
        expect(tiltedChair(0, 250, { ...pile, chipGap: 10 }).seat.cx).toBeCloseTo(0);
    });

    it('fits seats and chips inside a wide, short field', () => {
        const width = 1676;
        const height = 470;
        const fit = fitTiltedRing({ width, height, margin: 10, minRadius: () => 150, ...pile, chip, chipGap: 10, chipSlots: [1, 2, 3, 4] });
        expect(fit.radius).toBeGreaterThan(150);
        expect(fit.centre.x + fit.bounds.minX).toBeGreaterThanOrEqual(9.5);
        expect(fit.centre.x + fit.bounds.maxX).toBeLessThanOrEqual(width - 9.5);
        expect(fit.centre.y + fit.bounds.minY).toBeGreaterThanOrEqual(9.5);
        expect(fit.centre.y + fit.bounds.maxY).toBeLessThanOrEqual(height - 9.5);
    });

    it('stands every chip clear of every seat', () => {
        const fit = fitTiltedRing({ width: 1180, height: 520, margin: 10, minRadius: () => 150, ...pile, chip, chipGap: 10, chipSlots: [1, 2, 3, 4] });
        const chairs = [0, 1, 2, 3, 4].map(slot => tiltedChair(slot, fit.radius, { ...pile, chip, chipGap: 10 }));
        for (const chair of chairs.slice(1)) {
            for (const other of chairs) expect(overlaps(chair.chip!, other.seat)).toBe(false);
        }
    });

    it('keeps the collision radius even when nothing fits', () => {
        const fit = fitTiltedRing({ width: 300, height: 200, margin: 10, minRadius: (scale: number) => 144 * scale, ...pile, chip, chipGap: 10, chipSlots: [1, 2, 3, 4] });
        expect(fit.pileScale).toBeCloseTo(pile.minPileScale);
        expect(fit.radius).toBeCloseTo(144 * pile.minPileScale);
        expect(fit.fits).toBe(false);
    });

    it('shrinks the piles before overflowing a short window', () => {
        const fit = fitTiltedRing({ width: 1600, height: 330, margin: 10, minRadius: (scale: number) => 120 * scale, ...pile, chip, chipGap: 10, chipSlots: [1, 2, 3, 4] });
        expect(fit.fits).toBe(true);
        expect(fit.pileScale).toBeLessThan(pile.pileScale);
        expect(fit.bounds.maxY - fit.bounds.minY).toBeLessThanOrEqual(310);
    });

    it('starts big on big screens and keeps as much of it as fits', () => {
        expect(tiltedPileScale(390, 844)).toBe(1.25);
        expect(tiltedPileScale(1920, 1080)).toBeGreaterThan(2.5);
        const fit = fitTiltedRing({ width: 1920, height: 560, margin: 10, minRadius: (scale: number) => 120 * scale, ...pile, pileScale: 2.6, chip, chipGap: 10, chipSlots: [1, 2, 3, 4] });
        expect(fit.fits).toBe(true);
        expect(fit.pileScale).toBeGreaterThan(1.25);
        expect(fit.bounds.maxY - fit.bounds.minY).toBeLessThanOrEqual(540);
    });

    it('stands chips beside far chairs when short, above them when narrow', () => {
        const base = { margin: 10, minRadius: (scale: number) => 120 * scale, ...pile, pileScale: 2.6, chip, chipGap: 10, chipSlots: [1, 2, 3, 4] };
        expect(fitTiltedRing({ ...base, width: 1920, height: 560 }).chipLean.y).toBeLessThan(0.5);
        expect(fitTiltedRing({ ...base, width: 800, height: 760 }).chipLean.x).toBeLessThan(0.5);
    });
});

describe('flat ring fit', () => {
    const PILE = { pileW: 104, pileH: 66 };
    const ringFor = (width: number, height: number) => {
        const centre = { x: width / 2, y: height * 0.54 };
        const mat = { left: -width * 0.15, top: 4, width: width * 1.3, height: Math.max(150, height * 1.62), radius: width * 0.65 };
        const seat = Math.hypot(PILE.pileW, PILE.pileH);
        const fit = fitFlatRing({
            width, height, centre, mat, margin: 6, ...PILE,
            pileScale: 1.2,
            minPileScale: 0.72,
            minRadius: (s) => (seat * s + 22) / (2 * Math.sin(Math.PI / 5)) * 0.85,
            maxRadius: (s) => Math.min((width - seat * s) / 2 - 6, centre.y - seat * s / 2 - 4, height - centre.y - seat * s / 2 - 4),
        });
        return { fit, centre, mat };
    };

    it('keeps every seat corner inside the field on phone-sized felts', () => {
        for (const [width, height] of [[360, 320], [390, 360], [435, 400], [320, 300]]) {
            const { fit, centre } = ringFor(width, height);
            expect(fit.fits).toBe(true);
            for (let slot = 0; slot < 5; slot++) {
                for (const p of flatSeatCorners(slot, fit.radius, centre, { ...PILE, pileScale: fit.pileScale })) {
                    expect(p.x).toBeGreaterThanOrEqual(6);
                    expect(p.x).toBeLessThanOrEqual(width - 6);
                    expect(p.y).toBeGreaterThanOrEqual(6);
                    expect(p.y).toBeLessThanOrEqual(height - 6);
                }
            }
        }
    });

    it('shrinks the piles on a short field instead of spilling past it', () => {
        const roomy = ringFor(390, 420).fit;
        const short = ringFor(390, 280).fit;
        expect(short.pileScale).toBeLessThan(roomy.pileScale);
        expect(short.fits).toBe(true);
    });
});
