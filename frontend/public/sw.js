/**
 * The installed app's shell.
 *
 * This is a table everyone is sitting at live, so almost nothing here is worth
 * serving from a cache: the game arrives over a socket and is meaningless
 * stale. What the cache is for is the shell — the page, its script and its
 * stylesheet — so that opening the icon on a bad connection still gets you to
 * a screen that can say what is wrong, instead of the browser's error page.
 */

const VERSION = 'deal-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches
            .open(VERSION)
            // One missing file must not sink the whole install.
            .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    // Another origin, the socket, or the server's own API: never ours to hold.
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/ws') || url.pathname.startsWith('/api')) return;

    // A page always comes from the network when there is one, or a deploy
    // would keep serving yesterday's shell to anyone who installed it.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(VERSION).then(cache => cache.put('/index.html', copy));
                    return response;
                })
                .catch(() => caches.match('/index.html').then(hit => hit ?? Response.error())),
        );
        return;
    }

    // Built assets carry a hash in the name, so a hit is always the right file.
    event.respondWith(
        caches.match(request).then(hit => {
            if (hit) return hit;
            return fetch(request).then(response => {
                if (response.ok && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(VERSION).then(cache => cache.put(request, copy));
                }
                return response;
            });
        }),
    );
});
