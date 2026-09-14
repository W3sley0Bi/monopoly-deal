const COMMONS_HOSTS = new Set([
    'commons.wikimedia.org',
    'upload.wikimedia.org',
    'thumb.wikimedia.org',
]);

export const GIF_MESSAGE_PREFIX = 'gif:';

export interface GifMessageInfo {
    url: string;
    sourceUrl: string;
}

function sourcePageForImage(url: URL): string {
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? 'GIF');
    return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename).replace(/%20/g, '_')}`;
}

/** Only render GIF markers that point to the provider we query. */
export function gifMessageInfo(
    text: string | undefined,
): GifMessageInfo | null {
    if (!text?.startsWith(GIF_MESSAGE_PREFIX)) return null;
    try {
        const url = new URL(text.slice(GIF_MESSAGE_PREFIX.length));
        if (url.protocol !== 'https:' || !COMMONS_HOSTS.has(url.hostname))
            return null;
        return { url: url.href, sourceUrl: sourcePageForImage(url) };
    } catch {
        return null;
    }
}
