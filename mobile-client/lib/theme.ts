/**
 * Design tokens, ported from `frontend/src/index.css` (authored in OKLCH) —
 * every literal below is the sRGB hex conversion documented in
 * DESIGN-TOKENS.md §1. Use these hexes verbatim; do not re-derive from OKLCH.
 *
 * The single accent is **lime** `#dce64e`, not gold — DESIGN.md is explicit
 * about this. A legacy warm gold (`brand.legacyGold`) survives only in the
 * pulse-ring keyframe and the avatar active ring.
 */
import type { Color } from '../src/types';

// ---- surfaces -------------------------------------------------------------

export const surface = {
    room: '#00181d',
    roomAlpha88: '#00181de0',
    felt800: '#00272d',
    felt700: '#004650',
    felt600: '#15636f',
    bodyBase: '#03141a',
    bodyGlow: '#044853',
    panel: '#072429',
    panelOverlay: '#011c21f2',
    sheet: '#031f24',
    tray: '#001b20',
    mobileControls: '#001a1f',
    socialButton: '#011c21',
    hoverCard: '#022227',
    welcomeCard: '#002227',
    soloPanel: '#0b2e32',
    activeBoard: '#0011139e',
    tableEvent: '#000c0fb8',
    turnBanner: '#000c10eb',
    tourOverlay: '#000102e6',
    startWheelOverlay: '#04151cf2',
    menu: '#08281d',
    dropSlot: '#001317d9',
    dropSlotOver: '#04270feb',
    stickyFade: '#072429',
} as const;

// ---- ink / text -------------------------------------------------------------

export const ink = {
    card: '#0c1d23',
    body: '#f4f2e9',
    cream: '#f9f5e6',
    headerTitle: '#dceeee',
    subtle: '#a3b9bc',
    muted60: '#ffffff99',
    muted55: '#ffffff8c',
    muted45: '#ffffff73',
    muted42: '#ffffff6b',
    hoverDt: '#aac0bc',
    tableEvent: '#e7faf7',
    turnBanner: '#d6f2ef',
    seatPlay: '#04191e',
    endTurnHint: '#ffd98a',
    wheelCopy: '#b8ccd0',
} as const;

// ---- lines / borders --------------------------------------------------------

export const line = {
    panel: '#d3e1e41f',
    header: '#d0e2e51f',
    seat: '#d0e2e526',
    sheet: '#d0e2e62e',
    zonePanel: '#c3ded833',
    arenaInner: '#9ee9d440',
    orbit: '#9ee9d421',
    orbitDash: '#9ee9d41f',
    hoverCard: '#98d1c959',
    hairlineWhite10: '#ffffff1a',
    cardHeaderDivider: '#00000040',
    cardFooterDivider: '#00000026',
    scrollThumb: '#ffffff2e',
} as const;

// ---- brand -------------------------------------------------------------------

export const brand = {
    /** Primary accent — lime, NOT gold. */
    brass: '#dce64e',
    brassDark: '#afb81f',
    brassGlow12: '#dce64e1f',
    brassGlow65: '#dce64ea6',
    /** Deprecated second accent — pulse-ring keyframe + Avatar active ring only. */
    legacyGold: '#f2c14e',
    plateRed: '#e32631',
    plateBorder: '#f4f2ea',
    plateInk: '#fbf8f1',
    dealInk: '#f9f5e6',
    inviteGold: '#eddf70',
    inviteCode: '#f6da8c',
    /** Opacity .45 in-game. */
    cityscape: '#51bcb0',
} as const;

// ---- status ------------------------------------------------------------------

export const status = {
    danger: '#ea3c3c',
    dangerShadow: '#761617',
    dangerSeat: '#ff6b62',
    success: '#0fbd59',
    /** "you get" pick ring / stake highlight. */
    take: '#63ea89',
    /** "you give" pick ring / stake highlight. */
    give: '#fad03e',
    bank: '#8cf6a5',
    rent: '#89ecab',
    dropOver: '#f9d460',
    dropLive: '#e5cc8980',
    blue: '#0087c5',
    goldInk: '#19200a',
    goldShadow: '#516b07',
} as const;

// ---- property / money meta ---------------------------------------------------

export interface ColorMeta {
    hex: string;
    ink: string;
    /** Full label translation key, e.g. `color.brown`. */
    labelKey: string;
    /** Short label translation key, e.g. `color.short.brown`. */
    shortKey: string;
}

/** 10 property colours + railroad + utility + the `all` wildcard colour.
 *  Hex values are already correct in `game/meta.ts` — do not re-derive. */
export const COLOR_META: Record<Color | 'fallback', ColorMeta> = {
    brown: { hex: '#8b5a2b', ink: '#fff8f0', labelKey: 'color.brown', shortKey: 'color.short.brown' },
    lightblue: { hex: '#7dd3fc', ink: '#0b2b3a', labelKey: 'color.lightblue', shortKey: 'color.short.lightblue' },
    pink: { hex: '#ec4899', ink: '#ffffff', labelKey: 'color.pink', shortKey: 'color.short.pink' },
    orange: { hex: '#f97316', ink: '#2b1400', labelKey: 'color.orange', shortKey: 'color.short.orange' },
    red: { hex: '#dc2626', ink: '#ffffff', labelKey: 'color.red', shortKey: 'color.short.red' },
    yellow: { hex: '#facc15', ink: '#2b2200', labelKey: 'color.yellow', shortKey: 'color.short.yellow' },
    green: { hex: '#15803d', ink: '#ffffff', labelKey: 'color.green', shortKey: 'color.short.green' },
    blue: { hex: '#2563eb', ink: '#ffffff', labelKey: 'color.blue', shortKey: 'color.short.blue' },
    railroad: { hex: '#334155', ink: '#ffffff', labelKey: 'color.railroad', shortKey: 'color.short.railroad' },
    utility: { hex: '#94a3b8', ink: '#0f172a', labelKey: 'color.utility', shortKey: 'color.short.utility' },
    all: { hex: '#a855f7', ink: '#ffffff', labelKey: 'color.all', shortKey: 'color.short.all' },
    fallback: { hex: '#64748b', ink: '#ffffff', labelKey: 'color.all', shortKey: 'color.short.all' },
};

export function colorMeta(c: Color | null | undefined): ColorMeta {
    return c ? (COLOR_META[c] ?? COLOR_META.fallback) : COLOR_META.fallback;
}

export interface MoneyMeta {
    hex: string;
    ink: string;
}

/** Money denomination colours — colour is the primary signal, read before
 *  the figure. Keys are the card's `value` in $M. */
export const MONEY_META: Record<number, MoneyMeta> & { fallback: MoneyMeta } = {
    1: { hex: '#9ca3af', ink: '#111827' },
    2: { hex: '#facc15', ink: '#2b2200' },
    3: { hex: '#facc15', ink: '#2b2200' },
    4: { hex: '#7dd3fc', ink: '#0b2b3a' },
    5: { hex: '#a855f7', ink: '#ffffff' },
    10: { hex: '#dc2626', ink: '#ffffff' },
    fallback: { hex: '#42bd97', ink: '#04240f' },
};

export function moneyMeta(value: number): MoneyMeta {
    return MONEY_META[value] ?? MONEY_META.fallback;
}

/** Unset `--card-color` fallback, from `PlayingCard.tsx`. */
export const CARD_COLOR_FALLBACK = '#f5b643';

// ---- radii -------------------------------------------------------------------

export const radius = {
    xs: 2,
    sm: 3,
    chip: 4,
    /** THE card radius — `.card-face`, `.dual-wildcard`. */
    card: 9,
    md: 10,
    lg: 12,
    panel: 14,
    xl: 16,
    '2xl': 18,
    modal: 20,
    hero: 25,
    pill: 999,
    /** TL / TR / BR / BL, for `.seat-reaction`-style profile shapes. */
    seatProfile: [40, 12, 12, 40] as [number, number, number, number],
} as const;

// ---- shadows -----------------------------------------------------------------
//
// RN iOS supports one shadow per view; where the source has multiple layers,
// the note says how to fake it (nested sibling views, or drop the extra layer).

export interface ShadowSpec {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    /** Android only — RN has no cross-platform multi-layer shadow. */
    elevation?: number;
}

export const shadow = {
    /** Paper-edge layers (`0 2px #c6c1b5`, `0 4px #6e6a5f`) need two extra
     *  sibling Views offset 2px/4px down at the same radius — not expressible
     *  as a single RN shadow. This is just the soft cast shadow layer. */
    card: { shadowColor: '#000f15', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 8 } } as ShadowSpec,
    lift: { shadowColor: '#00090c', shadowOpacity: 0.7, shadowRadius: 40, shadowOffset: { width: 0, height: 18 } } as ShadowSpec,
    panel: { shadowColor: '#000000', shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 10 } } as ShadowSpec,
    panelFlat: { shadowColor: '#00090c', shadowOpacity: 1, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } } as ShadowSpec,
    /** Hard, no blur — approximate with a small radius. */
    zone: { shadowColor: '#00070a', shadowOpacity: 0.4, shadowRadius: 0, shadowOffset: { width: 0, height: 5 } } as ShadowSpec,
    seat: { shadowColor: '#000407', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } } as ShadowSpec,
    seatActive: { shadowColor: '#00040c', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } } as ShadowSpec,
    handHover: { shadowColor: '#000608', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 22 } } as ShadowSpec,
    tray: { shadowColor: '#000608', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 15 } } as ShadowSpec,
    modal: { shadowColor: '#000608', shadowOpacity: 0.6, shadowRadius: 90, shadowOffset: { width: 0, height: 30 } } as ShadowSpec,
    arena: { shadowColor: '#000407', shadowOpacity: 0.5, shadowRadius: 40, shadowOffset: { width: 0, height: 28 } } as ShadowSpec,
    feltCardPhone: { shadowColor: '#000407', shadowOpacity: 0.5, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } } as ShadowSpec,
    feltCardDesktop: { shadowColor: '#000407', shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 1, height: 2 } } as ShadowSpec,
    /** `rgba(242,193,78,0.9)` — the legacy-gold avatar ring. */
    avatarActiveRing: { shadowColor: '#f2c14e', shadowOpacity: 0.9, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } } as ShadowSpec,
    /** Ring 2px `#dce64e` + glow — pair a border with this shadow. */
    glow: { shadowColor: '#dce64e', shadowOpacity: 0.65, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } } as ShadowSpec,
} as const;

// ---- spacing -----------------------------------------------------------------

/** No formal scale in the source; observed values, in frequency order. */
export const space = {
    1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 10,
    9: 12, 10: 14, 11: 16, 12: 18, 13: 20, 14: 24, 15: 26, 16: 30,
} as const;

// ---- font sizes ----------------------------------------------------------------

/** Every literal px size as authored (§1.10). Roles are documented there;
 *  callers pick the literal that matches their component. */
export const fontSize = [
    7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 25, 26, 30, 32, 38, 40, 48, 78, 88,
] as const;

// ---- card geometry ---------------------------------------------------------------

/** Canonical card 112×158 → 0.7089. Drive width; derive height from this. */
export const CARD_ASPECT = 0.709;

export interface CardSizeSpec {
    w: number;
    h: number;
    /** The card's own base font-size — every internal size is `em` off this. */
    em: number;
}

export type CardSizeKey =
    | 'hand' | 'propertyZone' | 'dense' | 'tight' | 'bank' | 'activeBoard' | 'opponent' | 'sm' | 'xs';

export const CARD_SIZES: Record<CardSizeKey, CardSizeSpec> = {
    hand: { w: 76, h: 109, em: 8 },
    propertyZone: { w: 54, h: 76, em: 8 },
    dense: { w: 46, h: 65, em: 7 },
    tight: { w: 38, h: 54, em: 6 },
    bank: { w: 38, h: 55, em: 6 },
    activeBoard: { w: 60, h: 86, em: 8 },
    opponent: { w: 30, h: 42, em: 5 },
    sm: { w: 72, h: 104, em: 9 },
    xs: { w: 56, h: 80, em: 8 },
};

export const theme = {
    surface,
    ink,
    line,
    brand,
    status,
    radius,
    shadow,
    space,
    fontSize,
    CARD_ASPECT,
    CARD_SIZES,
    COLOR_META,
    MONEY_META,
} as const;

export default theme;
