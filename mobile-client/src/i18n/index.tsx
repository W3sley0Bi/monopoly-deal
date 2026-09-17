import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as Localization from 'expo-localization';
import { useStore } from '../../lib/store';
import type { Card, ChatMessage, Color, LogEntry } from '../types';
import { LANGS, type Catalog, type Lang } from './types';
import en from './en';
import it from './it';
import de from './de';

/**
 * Translation for a table where every seat may read a different language.
 *
 * Nothing the server sends is a finished sentence: the game log, chat notices
 * and errors all arrive as a key plus values, and each client renders them in
 * its own language. That is what lets an Italian, a German and an English
 * player share one table and all read the same game.
 */

const CATALOGS: Record<Lang, Catalog> = { en, it, de };

function isLang(v: string | null | undefined): v is Lang {
    return v === 'en' || v === 'it' || v === 'de';
}

/** Device locale fallback, used only until the store has hydrated a saved
 *  `md.lang` — `expo-localization` is the native replacement for
 *  `navigator.languages`. */
export function deviceLang(): Lang {
    const locales = Localization.getLocales();
    for (const l of locales) {
        if (isLang(l.languageCode)) return l.languageCode;
    }
    return 'en';
}

export type Params = Record<string, unknown>;

export interface I18n {
    lang: Lang;
    setLang: (lang: Lang) => void;
    /** Translate a key, filling {placeholders} from params. */
    t: (key: string, params?: Params) => string;
    /** A card's name. */
    tCard: (card: Pick<Card, 'key' | 'name'>) => string;
    /** A colour's name. */
    tColor: (color: Color) => string;
    /** One line of the table log. */
    tLog: (entry: LogEntry) => string;
    /** One chat line: player text as typed, server notices translated. */
    tChat: (message: ChatMessage) => string;
}

const I18nContext = createContext<I18n | null>(null);

/** Fills {name}-style placeholders. */
function interpolate(text: string, params?: Params): string {
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const value = params[name];
        return value === undefined || value === null ? whole : String(value);
    });
}

export function makeTranslator(lang: Lang) {
    const catalog = CATALOGS[lang] ?? en;

    /**
     * Looks a key up in the chosen language, then English, then gives the key
     * back so a missing string is obvious rather than invisible.
     *
     * A `count` parameter picks a plural form: `key.one` / `key.other`.
     */
    const t = (key: string, params?: Params): string => {
        const count = params?.count;
        if (typeof count === 'number') {
            const form = `${key}.${count === 1 ? 'one' : 'other'}`;
            const plural = catalog[form] ?? en[form];
            if (plural !== undefined) return interpolate(plural, params);
        }
        const text = catalog[key] ?? en[key];
        return text === undefined ? key : interpolate(text, params);
    };

    const tCard = (card: Pick<Card, 'key' | 'name'>): string => {
        const text = catalog[card.key] ?? en[card.key];
        return text ?? card.name;
    };

    const tColor = (color: Color): string => t(`color.${color}`);

    // Log and chat arguments name other keys rather than carrying text, so the
    // whole line resolves in the reader's language.
    const resolve = (key: string, args?: Params): Params | undefined => {
        if (!args) return args;
        const out: Params = {};
        for (const [name, value] of Object.entries(args)) {
            if (typeof value === 'string' && (name === 'card' || name === 'gave' || name === 'got')) {
                out[name] = catalog[value] ?? en[value] ?? value;
            } else if (typeof value === 'string' && name === 'color') {
                out[name] = t(`color.${value}`);
            } else if (typeof value === 'string' && name === 'mode') {
                out[name] = t(`mode.${value}`);
            } else if (name === 'label' && typeof value === 'string') {
                out[name] = t(value, resolve(value, args.label_args as Params | undefined));
            } else {
                out[name] = value;
            }
        }
        // `cards` counts cards handed over; give the plural helper its number.
        if (key.endsWith('paid') && typeof args.cards === 'number') out.count = args.cards;
        return out;
    };

    const tLog = (entry: LogEntry): string => t(entry.key, resolve(entry.key, entry.args as Params));

    const tChat = (message: ChatMessage): string =>
        message.key ? t(message.key, resolve(message.key, message.args as Params)) : (message.text ?? '');

    return { t, tCard, tColor, tLog, tChat };
}

export function I18nProvider({ children }: { children: ReactNode }) {
    // The store hydrates `md.lang` (falling back to the device locale) before
    // the root layout renders this provider — see lib/store.ts `hydrate()`
    // and app/_layout.tsx. Language choice is per-device, not per-table.
    const storeLang = useStore((s) => s.lang);
    const setStoreLang = useStore((s) => s.setLang);
    const [lang, setLangState] = useState<Lang>(storeLang);

    useEffect(() => {
        setLangState(storeLang);
    }, [storeLang]);

    const setLang = useCallback(
        (next: Lang) => {
            setLangState(next);
            setStoreLang(next);
        },
        [setStoreLang],
    );

    const value = useMemo<I18n>(() => ({ lang, setLang, ...makeTranslator(lang) }), [lang, setLang]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
    return ctx;
}

export { LANGS, LANG_LABEL, LANG_FLAG } from './types';
export type { Lang, Catalog } from './types';
