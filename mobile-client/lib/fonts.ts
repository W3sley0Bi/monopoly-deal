/**
 * Typography per DESIGN-TOKENS.md §7.
 *
 * UI face: Avenir Next, built into iOS — no download, used directly.
 * Display face: Nunito (`@expo-google-fonts/nunito`), the only rounded
 * Google family with a true 1000 weight, which the brand wordmark, card
 * values and card symbols all need. Nunito/Arial Rounded have no italic —
 * fake it with `transform: [{ skewX: '-9deg' }]` rather than `fontStyle`.
 */
import { useFonts } from '@expo-google-fonts/nunito';
import {
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
} from '@expo-google-fonts/nunito';

export const UI_FONT = {
    regular: 'AvenirNext-Regular',
    medium: 'AvenirNext-Medium',
    demiBold: 'AvenirNext-DemiBold',
    bold: 'AvenirNext-Bold',
    heavy: 'AvenirNext-Heavy',
} as const;

export const DISPLAY_FONT = {
    regular: 'Nunito_400Regular',
    semiBold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    extraBold: 'Nunito_800ExtraBold',
    black: 'Nunito_900Black',
} as const;

/** Load the Nunito weights the app uses. Gate first paint on `[loaded]`. */
export function useAppFonts(): boolean {
    const [loaded, error] = useFonts({
        Nunito_400Regular,
        Nunito_600SemiBold,
        Nunito_700Bold,
        Nunito_800ExtraBold,
        Nunito_900Black,
    });
    // Font loading should never strand the app behind its native splash. RN
    // falls back to a system face if a bundled font cannot be registered.
    return loaded || error !== null;
}

export type CssWeight = 600 | 700 | 800 | 850 | 900 | 950 | 1000;

/**
 * CSS weight → concrete family, per the §7 mapping. RN needs an explicit
 * font file per weight; a bare `fontWeight` will not reach 900+ on a custom
 * family. 850 collapses to 800, 950/1000 collapse to 900 (Black) unless the
 * variable font ships, in which case 1000 is the true Nunito Black used by
 * `.game-brand`, `.table-wordmark`, `.card-symbol`, `.card-back-mark b`,
 * `.home-hero h2`, `.start-wheel-hub`.
 */
export function displayFont(weight: CssWeight): string {
    switch (weight) {
        case 600:
            return DISPLAY_FONT.semiBold;
        case 700:
            return DISPLAY_FONT.bold;
        case 800:
        case 850:
            return DISPLAY_FONT.extraBold;
        case 900:
        case 950:
        case 1000:
            return DISPLAY_FONT.black;
        default:
            return DISPLAY_FONT.regular;
    }
}

/** UI-face equivalent, for components that want the same weight scale in
 *  Avenir Next instead of Nunito. */
export function uiFont(weight: CssWeight): string {
    switch (weight) {
        case 600:
            return UI_FONT.demiBold;
        case 700:
            return UI_FONT.bold;
        case 800:
        case 850:
        case 900:
        case 950:
        case 1000:
            return UI_FONT.heavy;
        default:
            return UI_FONT.regular;
    }
}

/**
 * Converts a CSS `em` letter-spacing to RN `letterSpacing` points — RN's
 * unit is points, not em, so it must be multiplied by the element's own
 * font size. e.g. `ls(0.13, 10)` → 1.3, matching `.label-caps` (`.13em @10px`).
 */
export function ls(em: number, fontSize: number): number {
    return Math.round(em * fontSize * 100) / 100;
}
