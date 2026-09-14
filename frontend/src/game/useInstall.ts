import { useCallback, useEffect, useState } from 'react';

/**
 * Chrome fires this instead of showing its own install bar, and hands you the
 * prompt to raise whenever it suits the page. It is not in the DOM lib.
 */
interface InstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallKind = 'prompt' | 'ios' | 'none';

export interface Install {
    /** `prompt` can be installed here and now; `ios` has to be told how. */
    kind: InstallKind;
    /** Already running from the home screen or the dock. */
    installed: boolean;
    /** Raises the browser's install dialog. Only meaningful for `prompt`. */
    install: () => Promise<void>;
    /** Hides the offer for good on this device. */
    dismiss: () => void;
}

const DISMISSED = 'md.install.dismissed';

function standalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        // iOS predates the media query and reports it on navigator instead.
        (navigator as { standalone?: boolean }).standalone === true
    );
}

function isApplePhoneOrTablet(): boolean {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    // An iPad on desktop-class Safari claims to be a Mac, and the touch points
    // are what give it away.
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Whether this browser can add the table to a home screen, and how.
 *
 * Chrome, Edge and desktop Safari hand over a prompt. iOS never has: there the
 * only route is Share → Add to Home Screen, so all the page can do is say so.
 */
export function useInstall(): Install {
    const [event, setEvent] = useState<InstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(standalone);
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED) === 'yes');

    useEffect(() => {
        const onPrompt = (e: Event) => {
            // Without this the browser shows its own bar and never hands the
            // prompt over.
            e.preventDefault();
            setEvent(e as InstallPromptEvent);
        };
        const onInstalled = () => {
            setInstalled(true);
            setEvent(null);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const install = useCallback(async () => {
        if (!event) return;
        await event.prompt();
        await event.userChoice;
        // The prompt is single-use whatever the answer was.
        setEvent(null);
    }, [event]);

    const dismiss = useCallback(() => {
        localStorage.setItem(DISMISSED, 'yes');
        setDismissed(true);
    }, []);

    const kind: InstallKind = installed || dismissed
        ? 'none'
        : event
          ? 'prompt'
          : isApplePhoneOrTablet()
            ? 'ios'
            : 'none';

    return { kind, installed, install, dismiss };
}
