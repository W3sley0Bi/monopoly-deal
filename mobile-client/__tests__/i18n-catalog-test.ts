import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../lib/store', () => ({ useStore: () => 'en' }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

import en from '../src/i18n/en';
import itCatalog from '../src/i18n/it';
import de from '../src/i18n/de';
import fr from '../src/i18n/fr';
import { makeTranslator } from '../src/i18n';
import type { Lang } from '../src/i18n/types';

describe('i18n catalogs and translations', () => {
    const catalogs = { en, it: itCatalog, de, fr };
    const langs: Lang[] = ['en', 'it', 'de', 'fr'];

    it('has identical keys across all language catalogs', () => {
        const enKeys = Object.keys(en).sort();
        for (const lang of ['it', 'de', 'fr'] as const) {
            const currentKeys = Object.keys(catalogs[lang]).sort();
            expect(currentKeys).toEqual(enKeys);
        }
    });

    it('has matching placeholders across all languages for every key', () => {
        for (const [key, enVal] of Object.entries(en)) {
            const enMatches = [...enVal.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
            for (const lang of ['it', 'de', 'fr'] as const) {
                const langVal = catalogs[lang][key];
                const langMatches = [...langVal.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
                expect(langMatches).toEqual(enMatches);
            }
        }
    });

    it('correctly interpolates lobby.players with seated and total across all languages', () => {
        for (const lang of langs) {
            const { t } = makeTranslator(lang);
            const result = t('lobby.players', { seated: 2, total: 5 });
            expect(result).not.toContain('{seated}');
            expect(result).not.toContain('{total}');
            expect(result).toContain('(2/5)');
        }
    });

    it('correctly interpolates dialog.plays_used with needed and left across all languages', () => {
        for (const lang of langs) {
            const { t } = makeTranslator(lang);
            const result = t('dialog.plays_used', { needed: 2, left: 3 });
            expect(result).not.toContain('{needed}');
            expect(result).not.toContain('{left}');
            expect(result).toContain('2');
            expect(result).toContain('3');
        }
    });

    it('correctly interpolates dialog.their_properties with target name', () => {
        for (const lang of langs) {
            const { t } = makeTranslator(lang);
            const result = t('dialog.their_properties', { name: 'Player1' });
            expect(result).not.toContain('{name}');
            expect(result).toContain('Player1');
        }
    });

    it('correctly resolves color and plural forms in t()', () => {
        const enTranslator = makeTranslator('en');
        const frTranslator = makeTranslator('fr');

        // Pluralization
        expect(enTranslator.t('board.in_hand', { count: 1 })).toBe('1 in hand');
        expect(enTranslator.t('board.in_hand', { count: 4 })).toBe('4 in hand');
        expect(frTranslator.t('board.in_hand', { count: 1 })).toBe('1 en main');
        expect(frTranslator.t('board.in_hand', { count: 4 })).toBe('4 en main');

        // Color resolution in pending rent
        expect(enTranslator.t('pending.rent', { color: 'blue', amount: 3 })).toBe('Blue rent — $3M');
        expect(frTranslator.t('pending.rent', { color: 'blue', amount: 3 })).toBe('Loyer Bleu — $3M');
    });
});
