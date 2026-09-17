import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How much of the screen the keyboard is currently covering.
 *
 * A browser has no keyboard events, so `Keyboard.addListener` is present but
 * silent and this returned 0 on the web for ever — which is why the chat
 * composer sat behind the keyboard. What a browser does instead is shrink the
 * *visual* viewport, and the gap between that and the window is the keyboard.
 *
 * Read `webInsetNote` in `Sheet` before using this on the web: the page itself
 * already resizes to the visual viewport, so this value must not be subtracted
 * from a height that came from `useWindowDimensions` — that subtracts the
 * keyboard twice.
 */
export function useKeyboardInset(): number {
    const [inset, setInset] = useState(0);

    useEffect(() => {
        if (Platform.OS === 'web') {
            const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
            if (!viewport) return;
            const measure = () => {
                // `offsetTop` counts the part scrolled out above the fold, which
                // on iOS is how a focused field is brought into view — without
                // it the inset reads short by exactly that much.
                const covered = window.innerHeight - viewport.height - viewport.offsetTop;
                // Rounded: Safari reports fractional heights that differ by a
                // hair every frame, and each one was a re-render of the sheet.
                setInset(Math.max(0, Math.round(covered)));
            };
            measure();
            viewport.addEventListener('resize', measure);
            viewport.addEventListener('scroll', measure);
            return () => {
                viewport.removeEventListener('resize', measure);
                viewport.removeEventListener('scroll', measure);
            };
        }

        const show = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow',
            (e) => setInset(e.endCoordinates?.height ?? 0),
        );
        const hide = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setInset(0),
        );
        return () => { show.remove(); hide.remove(); };
    }, []);

    return inset;
}

export default useKeyboardInset;
