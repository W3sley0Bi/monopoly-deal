import { CARD_SIZES } from '../../lib/theme';

export const HAND_CARD_WIDTH = CARD_SIZES.hand.w;
export const HAND_CARD_HEIGHT = CARD_SIZES.hand.h;
/** The most a card is allowed to hide of the one behind it. */
const NATURAL_STEP = HAND_CARD_WIDTH - 12;
/** Below this, a card's visible edge stops being worth touching: wrap instead. */
const MIN_VISIBLE = 30;

/** How far the popped card rises, and the room the row keeps above for it. */
export const FAN_HEADROOM = 14;
/** How far a neighbour leans away from the popped card. */
export const FAN_NUDGE = 7;
/** Slack under the cards, so the fan's tilt has somewhere to go. */
const FAN_FOOT = 10;

export interface FanRow<T> {
    cards: T[];
    /** Left edge of each card's box, in row coordinates. */
    left: number[];
    /**
     * Width of each card's touch strip: exactly the part of that card the row
     * leaves visible, so the strips tile the row without overlapping. Which
     * card a touch belongs to is then a question of where the strips are, not
     * of how a stack of overlapping cards resolves.
     */
    strip: number[];
    step: number;
    width: number;
    height: number;
}

export function fanRowHeight() {
    return HAND_CARD_HEIGHT + FAN_HEADROOM + FAN_FOOT;
}

export function fanRowMetrics(count: number, availableWidth: number) {
    const usable = Math.max(HAND_CARD_WIDTH, availableWidth - FAN_NUDGE * 2);
    const step = count <= 1
        ? 0
        : Math.max(1, Math.min(NATURAL_STEP, (usable - HAND_CARD_WIDTH) / (count - 1)));
    return {
        step,
        width: step * Math.max(0, count - 1) + HAND_CARD_WIDTH + FAN_NUDGE * 2,
        height: fanRowHeight(),
    };
}

/**
 * Splits a hand into rows and places every card in them.
 *
 * One row for a normal hand. A hand that would squeeze its cards past
 * `MIN_VISIBLE` wraps into balanced rows instead, because a sliver too narrow
 * to read is also too narrow to hit.
 */
export function fanLayout<T>(cards: T[], availableWidth: number): FanRow<T>[] {
    const width = Math.max(240, availableWidth);
    const perRow = Math.max(1, Math.floor((width - HAND_CARD_WIDTH) / MIN_VISIBLE) + 1);
    const rowCount = Math.max(1, Math.ceil(cards.length / perRow));
    const rowSize = Math.max(1, Math.ceil(cards.length / rowCount));

    const rows: FanRow<T>[] = [];
    for (let index = 0; index < cards.length; index += rowSize) {
        const slice = cards.slice(index, index + rowSize);
        const metrics = fanRowMetrics(slice.length, width);
        rows.push({
            cards: slice,
            left: slice.map((_, i) => i * metrics.step),
            // The last card has nothing in front of it, so all of it shows.
            strip: slice.map((_, i) => (i === slice.length - 1 ? HAND_CARD_WIDTH : metrics.step)),
            step: metrics.step,
            width: metrics.width,
            height: metrics.height,
        });
    }
    return rows;
}

/** The tilt that makes the row read as a held hand rather than a shelf. */
export function fanTilt(index: number, count: number) {
    const middle = (count - 1) / 2;
    const normalized = middle > 0 ? (index - middle) / middle : 0;
    return { lift: Math.abs(normalized) * 5, rotate: normalized * 4 };
}

/** Where a neighbour leans when `popped` is out of the fan. */
export function fanNudge(index: number, popped: number | null) {
    if (popped === null || popped === index) return 0;
    return index < popped ? -FAN_NUDGE : FAN_NUDGE;
}
