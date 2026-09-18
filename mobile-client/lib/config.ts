import { Platform } from 'react-native';

/**
 * Server address. Native has no page URL to derive it from, so it comes from
 * `.env` (`EXPO_PUBLIC_SERVER_URL`) baked in at build time — see
 * SHELL-SPEC.md §1/§9. A missing value fails loudly rather than silently
 * trying to connect nowhere.
 *
 * The web build deployed with the Go server is served from the same origin
 * as `/ws`, so with no override it follows the page — one image then works on
 * any host (Railway, a tunnel, a LAN IP) without rebuilding. The override
 * still wins so `expo start --web` on :8081 can reach the server on :8080.
 */
export const SERVER_URL: string = (() => {
    const url = process.env.EXPO_PUBLIC_SERVER_URL;
    if (url) return url;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${scheme}//${window.location.host}/ws`;
    }
    throw new Error(
        'EXPO_PUBLIC_SERVER_URL is not set. Add it to mobile-client/.env, ' +
            'e.g. EXPO_PUBLIC_SERVER_URL=ws://YOUR_LOCAL_IP:8080/ws',
    );
})();
