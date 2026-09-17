import { useEffect, type RefObject } from 'react';
import { Platform, type ScrollView } from 'react-native';

/** How far a pointer travels sideways before it is a slide and not a tap. */
const SLOP = 5;

/**
 * Makes a horizontal rail slideable on the web.
 *
 * On a phone the hand is panned with a finger and the platform does it for
 * free. A desktop browser has neither half of that: dragging with a mouse pans
 * no scroll container, and a vertical wheel is not forwarded to a horizontal
 * one, so the cards past the right edge of the hand could not be reached at
 * all. This adds both, and only on the web — everywhere else it does nothing.
 *
 * Sideways movement only. An upward pull is how a card is played and belongs
 * to the drag layer, which is also why the slide starts after `SLOP`: below
 * that the pointer is still a tap, and taking it here would eat card selection.
 */
export function useRailScroll(ref: RefObject<ScrollView | null>, ready: boolean) {
    useEffect(() => {
        if (Platform.OS !== 'web' || !ready) return;
        const scroller = ref.current as unknown as { getScrollableNode?: () => HTMLElement } | null;
        const node = scroller?.getScrollableNode?.();
        if (!node) return;

        const onWheel = (e: WheelEvent) => {
            // A mouse wheel only has deltaY. A trackpad's sideways swipe
            // already arrives as deltaX and the browser handles it.
            if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
            node.scrollLeft += e.deltaY;
            e.preventDefault();
        };

        let startX = 0;
        let startLeft = 0;
        let pointer: number | null = null;
        let sliding = false;

        const onPointerDown = (e: PointerEvent) => {
            // Touch and pen keep the browser's own panning, which is better
            // than anything reimplemented here (it has momentum).
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            pointer = e.pointerId;
            startX = e.clientX;
            startLeft = node.scrollLeft;
            sliding = false;
        };

        const onPointerMove = (e: PointerEvent) => {
            if (pointer !== e.pointerId) return;
            const dx = startX - e.clientX;
            if (!sliding) {
                if (Math.abs(dx) < SLOP) return;
                sliding = true;
                // Capture keeps the slide alive when the cursor leaves the
                // rail, but a pointer the browser has already forgotten
                // throws — the slide is still worth running without it.
                try {
                    node.setPointerCapture(e.pointerId);
                } catch {
                    /* no capture; the slide still tracks while inside */
                }
            }
            node.scrollLeft = startLeft + dx;
            e.preventDefault();
        };

        const endPointer = (e: PointerEvent) => {
            if (pointer !== e.pointerId) return;
            if (sliding) {
                if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
                // The release of a slide is still a click as far as the DOM is
                // concerned, and it lands on whichever card came to rest under
                // the cursor. Swallow exactly that one.
                node.addEventListener('click', swallow, { capture: true, once: true });
            }
            pointer = null;
            sliding = false;
        };

        const swallow = (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
        };

        node.addEventListener('wheel', onWheel, { passive: false });
        node.addEventListener('pointerdown', onPointerDown);
        node.addEventListener('pointermove', onPointerMove);
        node.addEventListener('pointerup', endPointer);
        node.addEventListener('pointercancel', endPointer);
        return () => {
            node.removeEventListener('wheel', onWheel);
            node.removeEventListener('pointerdown', onPointerDown);
            node.removeEventListener('pointermove', onPointerMove);
            node.removeEventListener('pointerup', endPointer);
            node.removeEventListener('pointercancel', endPointer);
            node.removeEventListener('click', swallow, { capture: true });
        };
    }, [ref, ready]);
}

export default useRailScroll;
