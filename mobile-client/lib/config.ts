/**
 * Build-time server address. There is no page URL on native to derive it
 * from, so it comes from `.env` (`EXPO_PUBLIC_SERVER_URL`) baked in at build
 * time — see SHELL-SPEC.md §1/§9. A missing value fails loudly rather than
 * silently trying to connect nowhere.
 */
export const SERVER_URL: string = (() => {
    const url = process.env.EXPO_PUBLIC_SERVER_URL;
    if (!url) {
        throw new Error(
            'EXPO_PUBLIC_SERVER_URL is not set. Add it to mobile-client/.env, ' +
                'e.g. EXPO_PUBLIC_SERVER_URL=ws://192.168.1.94:8080/ws',
        );
    }
    return url;
})();
