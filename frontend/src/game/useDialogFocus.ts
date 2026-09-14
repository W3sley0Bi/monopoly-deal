import { useEffect, useRef } from 'react';

/** Keep keyboard navigation inside an open dialog and return to its trigger. */
export function useDialogFocus() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const root = ref.current;
        if (!root) return;
        const focusable = () =>
            Array.from(
                root.querySelectorAll<HTMLElement>(
                    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
                ),
            ).filter((el) => el.getClientRects().length > 0);
        (focusable()[0] ?? root).focus();
        const trap = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;
            const items = focusable();
            const first = items[0],
                last = items[items.length - 1];
            if (!first) {
                event.preventDefault();
                root.focus();
            } else if (
                event.shiftKey &&
                (document.activeElement === first ||
                    document.activeElement === root)
            ) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        root.addEventListener('keydown', trap);
        return () => {
            root.removeEventListener('keydown', trap);
            if (previous?.isConnected) previous.focus({ preventScroll: true });
        };
    }, []);
    return ref;
}
