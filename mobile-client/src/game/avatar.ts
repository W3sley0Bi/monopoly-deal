import { createAvatar } from '@dicebear/core';
import { funEmoji, botttsNeutral, adventurerNeutral, loreleiNeutral } from '@dicebear/collection';

const cache = new Map<string, string>();

const BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'];

function hash(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

// Each style has its own options type, so the call sites stay separate rather
// than being unified behind one array.
function render(seed: string, variant: number): string {
    const shared = { seed, size: 96, radius: 50, backgroundColor: BACKGROUNDS };
    switch (variant) {
        case 0:
            return createAvatar(funEmoji, shared).toString();
        case 1:
            return createAvatar(botttsNeutral, shared).toString();
        case 2:
            return createAvatar(adventurerNeutral, shared).toString();
        default:
            return createAvatar(loreleiNeutral, shared).toString();
    }
}

/**
 * A stable SVG avatar for a player id. Four styles keep a table varied while
 * each person keeps the same face everywhere. Generated locally, so it works
 * with no internet connection.
 *
 * This returns SVG *markup*, not a data URI: React Native's `Image` cannot
 * decode an SVG data URI, so the markup goes through `react-native-svg`'s
 * `SvgXml` instead. Generating one is not cheap and avatars appear in
 * scrolling rails, hence the cache.
 */
export function avatarFor(seed: string): string {
    const cached = cache.get(seed);
    if (cached) return cached;
    const svg = render(seed, hash(seed) % 4);
    cache.set(seed, svg);
    return svg;
}
