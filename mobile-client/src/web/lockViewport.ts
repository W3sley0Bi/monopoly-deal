/**
 * Makes the browser page behave like the app it is hosting.
 *
 * Expo's web shell already stops the body scrolling. What it does not stop is
 * the *page* behaving like a page: it can be pinched to a new zoom level,
 * dragged past its own edges, and double-tapped to zoom a card. Each of those
 * moves the table under a finger that was aiming at it, and the app cannot
 * correct for any of them, because it never hears about them — the browser
 * handles them above the document.
 *
 * This runs from the root layout rather than from an HTML shell because
 * `app/+html.tsx` is only consulted when the web output is `static`; with
 * `single` the shell is a fixed template, so the page has to lock itself.
 *
 * Safe to call more than once, and a no-op off the web.
 */
export function lockViewport(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;

    // `viewport-fit=cover` puts the page under the notch and the home
    // indicator, which is what makes the safe-area insets the layout already
    // reads non-zero in a phone browser. The scale locks are what stop a pinch.
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        document.head.appendChild(viewport);
    }
    viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, shrink-to-fit=no',
    );

    // Safari tints its own top and bottom bars from this, and paints them white
    // without it — two bright bands clamped onto a near-black table. Set on the
    // document rather than in the shell because the shell is Expo's, not ours.
    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
        theme = document.createElement('meta');
        theme.setAttribute('name', 'theme-color');
        document.head.appendChild(theme);
    }
    theme.setAttribute('content', BAND_COLOR);
    // The page behind the app, which is what shows through in the overscroll
    // gutter and under a translucent bar.
    document.documentElement.style.backgroundColor = BAND_COLOR;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = SHELL_CSS;
    document.head.appendChild(style);

    // Keep the page the size of the part of it you can actually see.
    //
    // A browser does not tell an app that the keyboard opened; it shrinks the
    // *visual* viewport and leaves the layout viewport the size it was. So the
    // page stayed full height with its bottom — the chat composer — behind the
    // keyboard and Safari's toolbar.
    //
    // This is fixed here rather than in the sheet because react-native-web
    // already measures `Dimensions` from the visual viewport: RN layout knew
    // the screen had shrunk while the document did not, and the two disagreed
    // about where the bottom of the screen was. Resizing the page to match
    // settles it for every screen at once, and means no component needs a
    // keyboard inset of its own — adding one on top of this would subtract the
    // keyboard twice and collapse the sheet.
    //
    // `offsetTop` follows iOS scrolling the focused field into view: the page
    // is fixed, so it has to be moved deliberately or it stays behind.
    const viewportSize = window.visualViewport;
    if (viewportSize) {
        const follow = () => {
            const root = document.documentElement;
            root.style.setProperty('--app-height', `${Math.round(viewportSize.height)}px`);
            root.style.setProperty('--app-top', `${Math.round(viewportSize.offsetTop)}px`);
        };
        follow();
        viewportSize.addEventListener('resize', follow);
        viewportSize.addEventListener('scroll', follow);
    }

    // Safari on iOS honours neither `user-scalable=no` nor `touch-action` for
    // a two-finger pinch on the page — it only offers the non-standard gesture
    // events, and refusing those is the one thing that stops the zoom.
    const refuse = (e: Event) => e.preventDefault();
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
        document.addEventListener(type, refuse, { passive: false });
    }

    // A second finger is never part of a move this game understands, so a
    // multi-touch drag is refused outright rather than left to zoom.
    document.addEventListener(
        'touchmove',
        (e) => {
            if (e.touches.length > 1) e.preventDefault();
        },
        { passive: false },
    );

    // Double-tap zoom is already refused by the `touch-action` above, and the
    // obvious belt-and-braces — cancelling a second `touchend` inside the
    // double-tap window — must not be added: preventing that event also
    // cancels the click the browser would have synthesised from it, so every
    // quick second tap anywhere in the app was silently dropped. Two taps in a
    // row on the same button is ordinary play, not a gesture to refuse.
}

const STYLE_ID = 'deal-viewport-lock';
/** `surface.room` — the near-black teal the table itself sits in. */
const BAND_COLOR = '#00181d';

const SHELL_CSS = `
html, body {
    /* The viewport a phone browser actually leaves you once its toolbars are
       out, and the reason a bottom bar could sit under Safari's own. The
       percentage stays first as the fallback. */
    height: 100%;
    height: 100dvh;
    /* Set from the visual viewport above, so the page shrinks out from under
       the keyboard. The two lines before it are the fallback until the first
       measurement, and for anything without a visual viewport. */
    height: var(--app-height, 100dvh);
    margin: 0;
    overflow: hidden;
    /* No rubber-banding, and no pull-to-refresh on a downward swipe that was
       meant for a card. */
    overscroll-behavior: none;
    /* Everything is drawn inside the viewport, so the document itself never
       needs to move. Fixing it is what makes a stray drag do nothing at all.
       Pinned by the top edge only: an inset of 0 would resolve the height
       against the *large* viewport — the one that runs on underneath Safari's
       bars — and quietly beat the 100dvh above it, which is how the bottom of
       the app ended up behind the browser's own toolbar. */
    position: fixed;
    top: var(--app-top, 0px);
    left: 0;
    width: 100%;
    /* Allows panning — the hand rail needs it — while refusing pinch-zoom and
       double-tap zoom. Touch-action intersects down the ancestor chain, so
       this must not be 'none': that would take the rail's pan with it. */
    touch-action: pan-x pan-y;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
}
body {
    /* A tap on a card is a game move, not a link press. */
    -webkit-tap-highlight-color: transparent;
}
#root {
    display: flex;
    height: 100%;
    flex: 1;
    overflow: hidden;
}
`;

export default lockViewport;
