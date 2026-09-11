import type { Catalog } from '../types';

/** Words the whole app shares: colours, modes, difficulties, buttons. */
const common: Catalog = {
    'color.brown': 'Brown',
    'color.lightblue': 'Light Blue',
    'color.pink': 'Pink',
    'color.orange': 'Orange',
    'color.red': 'Red',
    'color.yellow': 'Yellow',
    'color.green': 'Green',
    'color.blue': 'Blue',
    'color.railroad': 'Railroad',
    'color.utility': 'Utility',
    'color.all': 'Any Colour',

    'color.short.brown': 'Brown',
    'color.short.lightblue': 'Lt Blue',
    'color.short.pink': 'Pink',
    'color.short.orange': 'Orange',
    'color.short.red': 'Red',
    'color.short.yellow': 'Yellow',
    'color.short.green': 'Green',
    'color.short.blue': 'Blue',
    'color.short.railroad': 'Rail',
    'color.short.utility': 'Util',
    'color.short.all': 'Any',

    'mode.classic': 'Classic',
    'mode.deathmatch': 'Death Match',
    'mode.golden_rush': 'Golden Rush',
    'mode.classic.blurb': 'First to 3 complete colour sets wins.',
    'mode.deathmatch.blurb': 'Win with 3 complete sets and an empty hand.',
    'mode.golden_rush.blurb': 'Coming soon.',

    'difficulty.easy': 'Easy',
    'difficulty.normal': 'Normal',
    'difficulty.hard': 'Hard',
    'difficulty.easy.blurb': 'Builds its own sets and leaves you alone.',
    'difficulty.normal.blurb': 'Charges rent and steals when it pays.',
    'difficulty.hard.blurb': 'Doubles rent, breaks sets, blocks with Just Say No.',

    'turn.none': 'No limit',
    'turn.seconds': '{seconds}s',
    'turn.minutes': '{minutes} min',

    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.confirm': 'Confirm',
    'common.you': 'you',
    'common.money': '${amount}M',
    'common.language': 'Language',
};

export default common;
