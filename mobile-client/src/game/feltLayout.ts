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

/*
 * The tilted table, for screens roomy enough to afford it.
 *
 * A phone looks straight down on the mat: the width is the scarce axis and a
 * tilt would only spend it. A desktop or tablet is wide and short, so the mat
 * leans away from the player and the ring can grow into the room it has.
 *
 * The seats are still the flat five-chair ring. Only the camera moves: every
 * point on the mat goes through one projection, so the pentagon stays a
 * pentagon, seen from a chair.
 *
 * Steeper than the old web table's 24°. At 24° the far seats were barely
 * foreshortened, so their cards read as pinned to a wall above the table
 * rather than lying on it, and the ring saved almost no height — which is the
 * axis a wide screen runs out of. A longer lens keeps the near seats from
 * ballooning at the steeper angle.
 */
export const FELT_TILT_DEG = 42;
export const FELT_LENS = 1600;

export interface FeltCamera {
    /** Vertical foreshortening of the mat plane: cos(tilt). 1 is flat. */
    cos: number;
    /** How far the near edge rises towards the eye: sin(tilt). 0 is flat. */
    sin: number;
    lens: number;
}

export const FLAT_CAMERA: FeltCamera = { cos: 1, sin: 0, lens: FELT_LENS };
export const TILTED_CAMERA: FeltCamera = {
    cos: Math.cos(FELT_TILT_DEG * Math.PI / 180),
    sin: Math.sin(FELT_TILT_DEG * Math.PI / 180),
    lens: FELT_LENS,
};

/**
 * A point on the mat, relative to its centre (v grows towards the player), to
 * the screen. `k` is the perspective scale at that point. The same maths as
 * CSS `perspective(lens) rotateX(tilt)`, so a web mat drawn with those
 * transforms lands exactly under seats placed with this.
 */
export function projectFelt(u: number, v: number, camera: FeltCamera) {
    'worklet';
    const k = camera.lens / (camera.lens - v * camera.sin);
    return { x: u * k, y: v * camera.cos * k, k };
}

/** Felt left between the outermost seat and the table's edge, on the mat. */
export const TABLE_EDGE = 26;
/** A wide screen deserves an oval table, not a round one. */
export const TABLE_ASPECT = 1.6;

/**
 * The oval table top around a ring, in the mat's own units: the ring plus the
 * reach of a seat block plus a border of felt. Centred on the ring, so the
 * pentagon sits in the middle of the table instead of wherever the chips
 * happened to push its outline.
 */
export function tableRadii(radius: number, pileW: number, pileH: number, pileScale: number) {
    const ry = radius + Math.hypot(pileW, pileH) / 2 * pileScale + TABLE_EDGE;
    return { rx: ry * TABLE_ASPECT, ry };
}

/** Screen-space y back to the mat's v; the inverse of `projectFelt` along v. */
export function unprojectFeltY(y: number, camera: FeltCamera) {
    return y * camera.lens / (camera.cos * camera.lens + y * camera.sin);
}

/** The angle of a chair round the ring. Slot 0 is the local player's near edge. */
export function seatAngle(tableSlot: number) {
    'worklet';
    return Math.PI / 2 + tableSlot * 2 * Math.PI / TABLE_SEAT_COUNT;
}

/**
 * Which way a chip stands off its chair, as weights on the chair's outward
 * direction. A wide, short screen runs out of height, so chips stand level
 * beside their chairs; a portrait tablet runs out of width, so they stand
 * above the far chairs and below the side ones. `fitTiltedRing` tries each and
 * keeps whichever leaves the biggest table.
 */
export interface ChipLean { x: number; y: number }
export const CHIP_LEANS: readonly ChipLean[] = [
    { x: 1, y: 0.08 },
    { x: 1, y: 1 },
    { x: 0.15, y: 1 },
];

export interface Box { cx: number; cy: number; w: number; h: number }

/** Half of a box's extent along a unit direction. */
function reach(box: { w: number; h: number }, dx: number, dy: number) {
    return (Math.abs(dx) * box.w + Math.abs(dy) * box.h) / 2;
}

/**
 * One chair on the tilted ring, relative to the ring's centre: the seat block's
 * screen bounds, and the player chip standing just outside it — at the table's
 * edge, facing out, as the old web seats did.
 */
export function tiltedChair(tableSlot: number, radius: number, o: {
    pileW: number; pileH: number; pileScale: number; chip?: { w: number; h: number }; chipGap: number;
    chipLean?: ChipLean;
}) {
    const angle = seatAngle(tableSlot);
    const rotation = angle * 180 / Math.PI - 90;
    const turn = rotation * Math.PI / 180;
    const c = Math.abs(Math.cos(turn));
    const sn = Math.abs(Math.sin(turn));
    const p = projectFelt(Math.cos(angle) * radius, Math.sin(angle) * radius, TILTED_CAMERA);
    const scale = o.pileScale * p.k;
    const seat: Box = {
        cx: p.x,
        cy: p.y,
        w: (o.pileW * c + o.pileH * sn) * scale,
        // Rotated in the mat, then foreshortened on screen.
        h: (o.pileW * sn + o.pileH * c) * scale * TILTED_CAMERA.cos,
    };
    let chip: Box | null = null;
    if (o.chip) {
        const lean = o.chipLean ?? CHIP_LEANS[0];
        const length = Math.hypot(p.x * lean.x, p.y * lean.y) || 1;
        const dx = p.x * lean.x / length;
        const dy = p.y * lean.y / length;
        const out = reach(seat, dx, dy) + o.chipGap + reach(o.chip, dx, dy);
        chip = { cx: p.x + dx * out, cy: p.y + dy * out, w: o.chip.w, h: o.chip.h };
    }
    return { angle, rotation, k: p.k, seat, chip };
}

function overlaps(a: Box, b: Box) {
    return Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 && Math.abs(a.cy - b.cy) < (a.h + b.h) / 2;
}

function bounds(boxes: Box[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boxes) {
        minX = Math.min(minX, b.cx - b.w / 2);
        maxX = Math.max(maxX, b.cx + b.w / 2);
        minY = Math.min(minY, b.cy - b.h / 2);
        maxY = Math.max(maxY, b.cy + b.h / 2);
    }
    return { minX, minY, maxX, maxY };
}

/**
 * How big the piles start on a tilted table: a phone's cards scaled up with the
 * screen's short side, so a desktop or tablet reads its opponents' sets from
 * the chair instead of squinting at a phone layout in the middle of a monitor.
 * The short side, because a wide window is usually short, and it is height the
 * ring runs out of first.
 */
export function tiltedPileScale(width: number, height: number) {
    return Math.min(2.6, Math.max(1.25, Math.min(width, height) / 420));
}

/**
 * The chips are drawn below their layout size: they are labels, not the game,
 * and at full size they crowded the very seats they name. A little bigger on
 * big screens, still well under the piles' growth.
 */
export function tiltedChipScale(width: number, height: number) {
    return Math.min(0.85, Math.max(0.72, Math.min(width, height) / 1270));
}

/**
 * The largest tilted ring whose seats and chips fit the field, and where its
 * centre goes. Never smaller than `minRadius`, the radius at which neighbouring
 * seats stop overlapping.
 *
 * Big piles come first: `pileScale` is what the screen deserves, and the piles
 * only shrink — towards `minPileScale` — while the ring cannot fit at all.
 * Past that floor the ring overflows rather than stacks, the same trade the
 * flat ring makes.
 */
export function fitTiltedRing(o: {
    width: number;
    height: number;
    margin: number;
    /** Where neighbouring seats stop overlapping, at a given pile scale. */
    minRadius: (pileScale: number) => number;
    pileW: number;
    pileH: number;
    pileScale: number;
    minPileScale: number;
    chip?: { w: number; h: number };
    chipGap: number;
    chipSlots: readonly number[];
}) {
    const fitWith = (chipLean: ChipLean) => {
        let pileScale = o.pileScale;
        let fit = fitTiltedRingAt({ ...o, chipLean, minRadius: o.minRadius(pileScale) });
        while (!fit.fits && pileScale > o.minPileScale) {
            pileScale = Math.max(o.minPileScale, pileScale * 0.95);
            fit = fitTiltedRingAt({ ...o, chipLean, pileScale, minRadius: o.minRadius(pileScale) });
        }
        return { ...fit, chipLean };
    };
    // Bigger piles win; at equal piles, the roomier ring.
    const better = (next: ReturnType<typeof fitWith>, best: typeof next) => {
        if (next.fits !== best.fits) return next.fits;
        if (Math.abs(next.pileScale - best.pileScale) > 1e-6) return next.pileScale > best.pileScale;
        return next.radius > best.radius + 0.5;
    };
    return CHIP_LEANS.map(fitWith).reduce((best, next) => better(next, best) ? next : best);
}

function fitTiltedRingAt(o: {
    width: number;
    height: number;
    margin: number;
    minRadius: number;
    pileW: number;
    pileH: number;
    pileScale: number;
    chip?: { w: number; h: number };
    chipGap: number;
    chipLean: ChipLean;
    /** Chairs that carry a chip: the occupied remote ones. */
    chipSlots: readonly number[];
}) {
    const place = (radius: number) => {
        const seats: Box[] = [];
        const chips: Box[] = [];
        for (let slot = 0; slot < TABLE_SEAT_COUNT; slot++) {
            const chair = tiltedChair(slot, radius, o);
            seats.push(chair.seat);
            if (chair.chip && o.chipSlots.includes(slot)) chips.push(chair.chip);
        }
        return { seats, chips };
    };
    const measure = (radius: number) => {
        const { seats, chips } = place(radius);
        // The far edge of the table has to be on screen: cut off, the far
        // seats had nothing behind them and hung from the top of the screen.
        // The sides and the near edge may run off — that is just a big table.
        const { ry } = tableRadii(radius, o.pileW, o.pileH, o.pileScale);
        const farEdge: Box = { cx: 0, cy: projectFelt(0, -ry, TILTED_CAMERA).y, w: 0, h: 0 };
        return bounds([...seats, ...chips, farEdge]);
    };
    const fits = (radius: number) => {
        const b = measure(radius);
        if (b.maxX - b.minX > o.width - o.margin * 2 || b.maxY - b.minY > o.height - o.margin * 2) return false;
        // A chip may not stand on anybody's cards, or on another chip.
        const { seats, chips } = place(radius);
        return chips.every((chip, i) =>
            seats.every(seat => !overlaps(chip, seat)) &&
            chips.every((other, j) => i === j || !overlaps(chip, other)));
    };

    // The lens caps how near the camera the near edge may come; past it the
    // projection folds over.
    let lo = o.minRadius;
    let hi = Math.max(lo, FELT_LENS * 0.8);
    const fitsAtAll = fits(lo);
    if (!fitsAtAll) hi = lo;
    for (let i = 0; i < 24 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid;
        else hi = mid;
    }
    const radius = lo;
    const b = measure(radius);
    return {
        radius,
        pileScale: o.pileScale,
        fits: fitsAtAll,
        // Centred in the field on both axes. The far side projects smaller
        // than the near one, so the ring's centre is not the field's.
        centre: {
            x: o.width / 2 - (b.minX + b.maxX) / 2,
            y: o.height / 2 - (b.minY + b.maxY) / 2,
        },
        bounds: b,
    };
}
