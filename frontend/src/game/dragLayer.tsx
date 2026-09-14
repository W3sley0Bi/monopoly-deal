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
function scrollTowardsEdge(x: number, y: number) {
    let el: Element | null = document.elementFromPoint(x, y);
    while (el) {
        const overflow = getComputedStyle(el).overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
            const box = el.getBoundingClientRect();
            if (y - box.top < EDGE_PX) el.scrollTop -= EDGE_SPEED;
            else if (box.bottom - y < EDGE_PX) el.scrollTop += EDGE_SPEED;
            return;
        }
        el = el.parentElement;
    }
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
        const tick = () => {
            frame = requestAnimationFrame(tick);
            if (ghost) ghost.style.transform = `translate3d(${x - grabX}px, ${y - grabY}px, 0) ${GHOST_POSE}`;
            scrollTowardsEdge(x, y);
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
                e.stopPropagation();
                e.preventDefault();
            };
            window.addEventListener('click', swallow, { capture: true, once: true });
            window.setTimeout(() => window.removeEventListener('click', swallow, true), 350);
        };

        const finish = (commit: boolean) => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('keydown', onKey);
            if (frame) cancelAnimationFrame(frame);
            ghost?.remove();
            ghost = null;
            // A press that never became a drag is left alone: it is a tap, and
            // the click that follows it still belongs to the card.
            if (!started) return;
            document.body.classList.remove('is-dragging');
            setDragging(false);
            setOverId(null);
            const zone = commit && over ? zones.current.get(over) : null;
            swallowNextClick();
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
