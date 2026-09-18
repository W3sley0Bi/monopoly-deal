/** Every language the game speaks. */
export const LANGS = ['en', 'it', 'de', 'fr'] as const;

export type Lang = (typeof LANGS)[number];

/** A flat key → sentence map. Keys are dotted, e.g. `home.play_solo`. */
export type Catalog = Record<string, string>;

/** How each language names itself in the picker. */
export const LANG_LABEL: Record<Lang, string> = {
    en: 'English',
    it: 'Italiano',
    de: 'Deutsch',
    fr: 'Français',
};

export const LANG_FLAG: Record<Lang, string> = {
    en: '🇬🇧',
    it: '🇮🇹',
    de: '🇩🇪',
    fr: '🇫🇷',
};
