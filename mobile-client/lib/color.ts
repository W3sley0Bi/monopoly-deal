/**
 * sRGB colour helpers replacing CSS `color-mix(in srgb, …)`, which RN cannot
 * parse. Ratios needed by the port are listed in DESIGN-TOKENS.md §5:
 *
 *   card body tint      mix(cardColor, transparent, 16%)
 *   card symbol          mix(cardColor, '#162f3a', 70%)
 *   card artwork          mix(cardColor, '#0b2b30', 85%)
 *   wildcard half         mix(cardColor, '#f7f2df', 16%)
 *   money figure          mix(moneyColor, '#000000', 78%)
 *   money header gradient mix(moneyColor, '#ffffff', 55%)
 *   discard ghost         mix(cardColor, '#0a1013', 55%)
 */

function clamp255(n: number): number {
    return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
    let h = hex.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length === 4) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
}

function rgbToHex(r: number, g: number, b: number): string {
    const to2 = (n: number) => clamp255(n).toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/**
 * `color-mix(in srgb, hex pct%, base)` — linear-interpolates `hex` toward
 * `base` in sRGB space. `pct` is how much of `hex` survives (0–100), matching
 * CSS `color-mix` argument order. `base` may itself carry alpha; when it does
 * (or when `hex` does), the result's alpha is interpolated too and returned
 * as an 8-digit hex — callers that want plain rgb can slice `.slice(0,7)`.
 */
export function mix(hex: string, base: string, pct: number): string {
    const t = Math.max(0, Math.min(100, pct)) / 100;
    const a = hexToRgb(hex);
    const b = hexToRgb(base);
    const r = a.r * t + b.r * (1 - t);
    const g = a.g * t + b.g * (1 - t);
    const bl = a.b * t + b.b * (1 - t);
    const alpha = a.a * t + b.a * (1 - t);
    const rgbHex = rgbToHex(r, g, bl);
    if (alpha >= 1) return rgbHex;
    const alphaHex = clamp255(alpha * 255).toString(16).padStart(2, '0');
    return `${rgbHex}${alphaHex}`;
}

/** `hex` with alpha `a` (0–1) appended as an 8-digit hex — the RN-friendly
 *  equivalent of `rgb(... / a)`. */
export function withAlpha(hex: string, a: number): string {
    const { r, g, b } = hexToRgb(hex);
    const base = rgbToHex(r, g, b);
    const alphaHex = clamp255(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
    return `${base}${alphaHex}`;
}
