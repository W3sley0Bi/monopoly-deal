/**
 * Shared hover intent for the table's inspection popups.
 *
 * Two things make a tooltip feel wrong. It opens while the pointer is only
 * passing over a card, and it makes you wait again for every neighbour once
 * you are clearly reading the hand. So: a pending popup is held back while the
 * pointer is still moving quickly, and a short warm window after one closes
 * lets the next one open almost at once.
 */

/** Cold start: the pointer has to settle on one card first. */
export const OPEN_DELAY = 380;
/** A popup was just open, so the next one is a continuation, not a surprise. */
export const WARM_DELAY = 80;
/** How long the warm window lasts after a popup closes. */
export const WARM_WINDOW = 420;
/** Grace before closing, so crossing a 2px gap does not flicker. */
export const CLOSE_DELAY = 140;
/** Pointer speed, in px/ms, above which nothing may open yet. */
export const SWEEP_SPEED = 0.65;
/** How often a held-back popup re-checks whether the pointer settled. */
export const SETTLE_POLL = 110;

let speed = 0;
let lastX = 0;
let lastY = 0;
let lastAt = 0;
let warmUntil = 0;
let openCount = 0;

if (typeof window !== 'undefined') {
    window.addEventListener(
        'pointermove',
        event => {
            const now = event.timeStamp || performance.now();
            const elapsed = now - lastAt;
            if (lastAt && elapsed > 0) {
                const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
                // Smoothed, so one jittery sample cannot gate a popup on its own.
                const sample = distance / elapsed;
                speed = speed * 0.6 + sample * 0.4;
                // A pointer that stopped reports nothing at all, so decay old
                // speed once the last move is stale.
                if (elapsed > 90) speed = sample;
            }
            lastX = event.clientX;
            lastY = event.clientY;
            lastAt = now;
        },
        { passive: true },
    );
}

/** px/ms, decayed while the pointer rests. */
export function pointerSpeed(): number {
    if (!lastAt) return 0;
    const idle = performance.now() - lastAt;
    if (idle > 90) return 0;
    return speed;
}

/** True while another popup was open recently enough to keep the flow going. */
export function hoverIsWarm(): boolean {
    return openCount > 0 || performance.now() < warmUntil;
}

export function hoverOpenDelay(): number {
    return hoverIsWarm() ? WARM_DELAY : OPEN_DELAY;
}

export function markHoverOpen(): void {
    openCount += 1;
}

export function markHoverClosed(): void {
    openCount = Math.max(0, openCount - 1);
    warmUntil = performance.now() + WARM_WINDOW;
}
