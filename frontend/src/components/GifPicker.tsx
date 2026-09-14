import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/** A GIF result is deliberately small: the chat protocol only needs its URL. */
export interface GifResult {
    id: string;
    title: string;
    previewUrl: string;
    gifUrl: string;
    sourceUrl: string;
}

interface Props {
    onSelect: (gif: GifResult) => void;
    onClose: () => void;
    /** Inside a dialog that already draws its own frame and close button. */
    embedded?: boolean;
}

interface CommonsPage {
    pageid?: number;
    index?: number;
    title?: string;
    imageinfo?: Array<{
        mime?: string;
        url?: string;
        thumburl?: string;
    }>;
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const COMMONS_HOSTS = new Set([
    'commons.wikimedia.org',
    'upload.wikimedia.org',
    'thumb.wikimedia.org',
]);
function safeHttpsUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !COMMONS_HOSTS.has(url.hostname))
            return null;
        [...url.searchParams.keys()]
            .filter((key) => key.startsWith('utm_'))
            .forEach((key) => url.searchParams.delete(key));
        return url.href;
    } catch {
        return null;
    }
}

async function searchCommons(
    query: string,
    signal: AbortSignal,
): Promise<GifResult[]> {
    const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        // Filter in the search index so relevant GIFs are not crowded out by still images.
        gsrsearch: `filemime:image/gif ${query}`,
        gsrnamespace: '6',
        gsrlimit: '50',
        prop: 'imageinfo',
        iiprop: 'url|mime',
        iiurlwidth: '320',
        format: 'json',
        origin: '*',
    });
    const response = await fetch(`${COMMONS_API}?${params}`, { signal });
    if (!response.ok) throw new Error(`GIF search failed (${response.status})`);
    const payload = (await response.json()) as {
        query?: { pages?: Record<string, CommonsPage> };
    };
    return Object.values(payload.query?.pages ?? []).sort((a, b) => (a.index ?? 100) - (b.index ?? 100)).flatMap((page, index) => {
        const info = page.imageinfo?.[0];
        if (info?.mime !== 'image/gif') return [];
        const gifUrl = safeHttpsUrl(info.url);
        const previewUrl = safeHttpsUrl(info.thumburl) ?? gifUrl;
        if (!gifUrl || !previewUrl) return [];
        // The existing server trims chat text at 400 characters. Keep a safe
        // margin for the `gif:` marker so an unusually long Commons filename
        // can never be sent as a broken attachment.
        if (gifUrl.length > 380) return [];
        const title = (page.title ?? 'GIF')
            .replace(/^File:/i, '')
            .replace(/\.gif$/i, '');
        return [
            {
                id: String(page.pageid ?? `${index}-${title}`),
                title,
                previewUrl,
                gifUrl,
                sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? title).replace(/%20/g, '_')}`,
            },
        ];
    });
}

/**
 * Searchable, no-key GIF picker. Wikimedia Commons is used because it has a
 * public CORS-enabled API and does not require us to ship a shared API key.
 */
export default function GifPicker({ onSelect, onClose, embedded = false }: Props) {
    const { t } = useI18n();
    const [query, setQuery] = useState('cat');
    const [results, setResults] = useState<GifResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const pickerRef = useRef<HTMLElement>(null);
    const requestRef = useRef<AbortController | null>(null);

    const search = (term = query) => {
        const clean = term.trim();
        if (!clean) return;
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError(false);
        searchCommons(clean, controller.signal)
            .then((next) => {
                // A slower request must not replace results from a newer one.
                if (requestRef.current === controller) setResults(next);
            })
            .catch((reason) => {
                if (requestRef.current === controller && reason?.name !== 'AbortError') {
                    setResults([]);
                    setError(true);
                }
            })
            .finally(() => {
                if (requestRef.current === controller) setLoading(false);
            });
    };

    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        };
        const onPointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                !(event.target instanceof Element && event.target.closest('.chat-gif-button')) &&
                !pickerRef.current?.contains(event.target)
            )
                onClose();
        };
        inputRef.current?.focus();
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('pointerdown', onPointerDown);
        search();
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('pointerdown', onPointerDown);
            requestRef.current?.abort();
            previousFocus?.focus();
        };
        // The picker should search once on open, not on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <section
            ref={pickerRef}
            className="gif-picker"
            aria-label={t('gif.aria_picker')}
        >
            <div className="gif-picker-search">
                <span aria-hidden className="gif-picker-icon">
                    GIF
                </span>
                <form
                    className="gif-picker-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        search();
                    }}
                >
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('gif.search')}
                        aria-label={t('gif.search')}
                        maxLength={80}
                    />
                    <button
                        type="submit"
                        className="gif-picker-search-button"
                        disabled={loading || !query.trim()}
                    >
                        {loading ? t('gif.searching') : t('gif.search')}
                    </button>
                </form>
                {!embedded && (
                    <button
                        type="button"
                        className="gif-picker-close"
                        onClick={onClose}
                        aria-label={t('gif.close')}
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className="gif-picker-results" aria-live="polite">
                {loading && (
                    <p className="gif-picker-state">{t('gif.loading')}</p>
                )}
                {!loading && error && (
                    <p className="gif-picker-state">{t('gif.error')}</p>
                )}
                {!loading && !error && results.length === 0 && (
                    <p className="gif-picker-state">{t('gif.empty')}</p>
                )}
                {!loading &&
                    results.map((gif) => (
                        <button
                            type="button"
                            className="gif-picker-result"
                            key={gif.id}
                            onClick={() => onSelect(gif)}
                            title={gif.title}
                            aria-label={gif.title}
                        >
                            <img src={gif.previewUrl} alt="" loading="lazy" />
                        </button>
                    ))}
            </div>
            <p className="gif-picker-attribution">
                {t('gif.attribution')}{' '}
                <a
                    href="https://commons.wikimedia.org/"
                    target="_blank"
                    rel="noreferrer"
                >
                    {t('gif.source')}
                </a>
            </p>
        </section>
    );
}
