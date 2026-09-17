import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

/**
 * Pointer-driven card dragging.
 *
 * The table used to drag with the HTML5 drag-and-drop API, which never fires on
 * a touch screen and gives no control over the card that follows the cursor.
 * One pointer pipeline serves mouse, pen and finger alike: the dragged card is
 * cloned into a floating ghost, and drop targets are found by hit-testing the
 * point under the pointer rather than by trusting browser drag events.
 */

/** A registered drop target. Inactive zones are invisible to hit-testing. */
interface Zone {
    active: boolean;
    onDrop: () => void;
}

/**
 * Which way a card has to travel before the pull counts as a drag.
 *
 * `vertical` belongs to the hand, which is a sideways-scrolling rail on a
 * phone: only an upward pull lifts a card, so a sideways swipe still scrolls.
 * `free` belongs to cards already on the board, where no gesture competes.
 */
type DragAxis = 'vertical' | 'free';

interface BeginOptions {
    axis?: DragAxis;
    onStart: () => void;
    onEnd: () => void;
}

interface DragApi {
    /** Registers a drop target, or clears it with `null`. */
    setZone: (id: string, zone: Zone | null) => void;
    /** The zone under the pointer that accepts the card in hand, if any. */
    overId: string | null;
    /** True from the moment a pull becomes a drag until it is released. */
    dragging: boolean;
    begin: (event: ReactPointerEvent<HTMLElement>, options: BeginOptions) => void;
}

const DragContext = createContext<DragApi | null>(null);

/** Null outside a `DragProvider`, so cards render fine on the home screen. */
export function useOptionalDragLayer(): DragApi | null {
    return useContext(DragContext);
}

/** How far a pointer travels before a press turns into a drag. */
const START_PX = 8;
/** How long a card stays marked as hand-placed, for TableMotion to skip. */
const PLACED_MS = 900;
/** How long a refused card takes to fall back into the hand. */
const SNAP_MS = 260;

/**
 * Cards the player has just put down with their own hand.
 *
 * The table animates every card that changes place, which is right when
 * somebody else moves one and wrong for the card you are still holding: your
 * finger already carried it there, and flying it again reads as a second drop
 * you did not make. TableMotion asks here and leaves those alone.
 */
const placed = new Map<string, number>();

export function wasPlacedByHand(cardId: string): boolean {
    const at = placed.get(cardId);
    if (at === undefined) return false;
    if (performance.now() - at > PLACED_MS) {
        placed.delete(cardId);
        return false;
    }
    return true;
}
/** The ghost sits slightly larger and tilted, so it reads as "in hand". */
const GHOST_POSE = 'rotate(3deg) scale(1.05)';
/** How close to a scrolling panel's edge the card has to be to pull it along. */
const EDGE_PX = 46;
/** Pixels per frame the panel moves while the card rests against its edge. */
const EDGE_SPEED = 13;

/**
 * Nudges the scrolling panel under the pointer when the card is held against
 * its top or bottom edge. Property groups and a rival's sets scroll inside
 * their own panel, so without this the target under them is unreachable.
 */
function findScroller(x: number, y: number): Element | null {
    let el: Element | null = document.elementFromPoint(x, y);
    while (el) {
        const overflow = getComputedStyle(el).overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
}

/**
 * Whether the card is resting against the edge of `el`, and which way that
 * should move it. Zero means it is not near an edge.
 */
function edgeStep(el: Element, y: number): number {
    const box = el.getBoundingClientRect();
    if (y - box.top < EDGE_PX) return -EDGE_SPEED;
    if (box.bottom - y < EDGE_PX) return EDGE_SPEED;
    return 0;
}

export function DragProvider({ children }: { children: ReactNode }) {
    const zones = useRef(new Map<string, Zone>());
    const [overId, setOverId] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);

    const setZone = useCallback((id: string, zone: Zone | null) => {
        if (zone) zones.current.set(id, zone);
        else zones.current.delete(id);
    }, []);

    const begin = useCallback((event: ReactPointerEvent<HTMLElement>, { axis = 'free', onStart, onEnd }: BeginOptions) => {
        // A right-click is a context menu, never a drag.
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const source = event.currentTarget;
        const rect = source.getBoundingClientRect();
        // Where inside the card the pointer grabbed it, so the ghost keeps the
        // same spot under the finger instead of snapping its corner there.
        const grabX = event.clientX - rect.left;
        const grabY = event.clientY - rect.top;
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;
        const coarse = event.pointerType !== 'mouse';

        let ghost: HTMLElement | null = null;
        let started = false;
        let over: string | null = null;
        let frame = 0;
        let x = startX;
        let y = startY;

        // One frame loop runs for the life of the drag: the card has to keep
        // pulling a panel along even when the finger is holding perfectly
        // still against its edge.
        // Everything in here runs sixty times a second on a phone, so each
        // step asks whether it has anything to do first. Re-probing the DOM
        // under a finger that has not moved was costing a forced style recalc
        // and a layout every frame, for an answer that could not have changed.
        let drawnX = Number.NaN;
        let drawnY = Number.NaN;
        let probedX = Number.NaN;
        let probedY = Number.NaN;
        let scroller: Element | null = null;

        const tick = () => {
            frame = requestAnimationFrame(tick);
            const moved = x !== drawnX || y !== drawnY;
            if (ghost && moved) {
                ghost.style.transform = `translate3d(${x - grabX}px, ${y - grabY}px, 0) ${GHOST_POSE}`;
                drawnX = x;
                drawnY = y;
            }
            // The panel under the pointer only changes when the pointer does.
            if (x !== probedX || y !== probedY) {
                scroller = findScroller(x, y);
                probedX = x;
                probedY = y;
            }
            const step = scroller ? edgeStep(scroller, y) : 0;
            if (step !== 0 && scroller) scroller.scrollTop += step;
            // Every frame, whether the finger moved or not. The page moves
            // under a still finger too: zones grow as they light up, the hand
            // gives up its height when a card leaves it, panels settle. This
            // used to run only on movement, so a card carried straight to a
            // zone and held there was judged against where that zone had been
            // mid-animation — and the only way to get an answer out of it was
            // to jiggle the card until a frame happened to land. One
            // `elementFromPoint` is what the browser does for `:hover`
            // anyway, and `hitTest` re-renders nothing unless the answer
            // actually changed.
            hitTest();
        };

        const hitTest = () => {
            const under = document.elementFromPoint(x, y);
            const zoneEl = under instanceof Element ? under.closest<HTMLElement>('[data-drop-id]') : null;
            const id = zoneEl?.dataset.dropId ?? null;
            const next = id && zones.current.get(id)?.active ? id : null;
            if (next === over) return;
            over = next;
            setOverId(next);
        };

        const lift = () => {
            started = true;
            ghost = source.cloneNode(true) as HTMLElement;
            ghost.className = `${ghost.className} drag-ghost`;
            ghost.removeAttribute('id');
            // The carried copy is scenery. Anything that made the original
            // answer to a pointer has to come off it, or the ghost sits
            // between the finger and the drop zone it is being carried to.
            ghost.removeAttribute('data-tour-live');
            ghost.removeAttribute('data-drop-id');
            ghost.style.width = `${rect.width}px`;
            ghost.style.height = `${rect.height}px`;
            document.body.appendChild(ghost);
            document.body.classList.add('is-dragging');
            tick();
            setDragging(true);
            onStart();
        };

        // A drop that lands must not also read as a tap on the card, which
        // would leave the action tray open over the board it just changed.
        const swallowNextClick = () => {
            const swallow = (e: Event) => {
                // Only the card that was dragged. This used to swallow the
                // first click anywhere, so a button tapped straight after a
                // drag did nothing and had to be pressed twice — which is what
                // a delay feels like from the other side of the screen.
                const target = e.target as Node | null;
                if (!target || !source.contains(target)) return;
                e.stopPropagation();
                e.preventDefault();
                window.removeEventListener('click', swallow, true);
            };
            window.addEventListener('click', swallow, { capture: true });
            window.setTimeout(() => window.removeEventListener('click', swallow, true), 350);
        };

        // A card that finds nowhere to go falls back to where it came from.
        // Vanishing from under the finger gives no answer at all; watching it
        // drop back into the hand says plainly that the table refused it.
        const snapBack = (node: HTMLElement) => {
            const home = source.getBoundingClientRect();
            node.style.transition = `transform ${SNAP_MS}ms cubic-bezier(0.32, 0, 0.35, 1), opacity ${SNAP_MS}ms ease-in`;
            node.style.transform = `translate3d(${home.left}px, ${home.top}px, 0) scale(0.96)`;
            node.style.opacity = '0';
            window.setTimeout(() => node.remove(), SNAP_MS + 40);
        };

        const finish = (commit: boolean) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('keydown', onKey);
            if (frame) cancelAnimationFrame(frame);
            // A press that never became a drag is left alone: it is a tap, and
            // the click that follows it still belongs to the card.
            if (!started) {
                ghost?.remove();
                ghost = null;
                return;
            }
            document.body.classList.remove('is-dragging');
            setDragging(false);
            setOverId(null);
            const zone = commit && over ? zones.current.get(over) : null;
            const landed = Boolean(zone?.active);

            if (ghost) {
                if (landed) {
                    // It arrived. The board is about to draw it in place, so
                    // the carried copy just goes.
                    ghost.remove();
                } else {
                    snapBack(ghost);
                }
                ghost = null;
            }

            swallowNextClick();
            if (landed) {
                const id = source.dataset.cardId;
                if (id) placed.set(id, performance.now());
            }
            // The drop runs against the state the drag was read from; clearing
            // the carried card first would pull it out from under the handler.
            if (zone?.active) zone.onDrop();
            onEnd();
        };

        const onMove = (e: PointerEvent) => {
            if (e.pointerId !== pointerId) return;
            x = e.clientX;
            y = e.clientY;
            if (!started) {
                const dx = x - startX;
                const dy = y - startY;
                if (axis === 'vertical' && coarse) {
                    // Sideways first means the player is scrolling the hand,
                    // so this pointer is no longer a candidate for a drag.
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > START_PX) {
                        finish(false);
                        return;
                    }
                    if (dy > -START_PX) return;
                } else if (Math.hypot(dx, dy) < START_PX) {
                    return;
                }
                lift();
            }
            if (e.cancelable) e.preventDefault();
        };

        const onUp = (e: PointerEvent) => {
            if (e.pointerId !== pointerId) return;
            finish(true);
        };

        const onCancel = (e: PointerEvent) => {
            if (e.pointerId !== pointerId) return;
            finish(false);
        };

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') finish(false);
        };

        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        window.addEventListener('keydown', onKey);
    }, []);

    const api = useMemo<DragApi>(() => ({ setZone, overId, dragging, begin }), [setZone, overId, dragging, begin]);

    return <DragContext.Provider value={api}>{children}</DragContext.Provider>;
}

export type { DragAxis };
