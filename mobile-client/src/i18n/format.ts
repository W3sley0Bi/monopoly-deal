import type { I18n } from './index';

/** "No limit", "30s", "2 min" — the turn timer, in the reader's language. */
export function formatTurn(t: I18n['t'], seconds: number): string {
    if (!seconds) return t('turn.none');
    if (seconds % 60 === 0) return t('turn.minutes', { minutes: seconds / 60 });
    return t('turn.seconds', { seconds });
}

/** "$4M" — money is written the same everywhere, but goes through the catalog
 *  so a language can move the symbol if it needs to. */
export function money(t: I18n['t'], amount: number): string {
    return t('common.money', { amount });
}
