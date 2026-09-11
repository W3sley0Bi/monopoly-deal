import { useEffect, useState } from 'react';

/** Tracks a media query, so layout can change structure rather than just size. */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    return matches;
}

/**
 * The table switches from side-by-side panels to a stacked, sheet-based layout
 * below this width. Chosen from where the board actually breaks, not a device.
 */
export const NARROW = '(max-width: 899px)';
