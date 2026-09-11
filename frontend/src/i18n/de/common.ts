import type { Catalog } from '../types';

/** Words the whole app shares: colours, modes, difficulties, buttons. */
const common: Catalog = {
    'color.brown': 'Braun',
    'color.lightblue': 'Hellblau',
    'color.pink': 'Pink',
    'color.orange': 'Orange',
    'color.red': 'Rot',
    'color.yellow': 'Gelb',
    'color.green': 'Grün',
    'color.blue': 'Blau',
    'color.railroad': 'Bahnhof',
    'color.utility': 'Werk',
    'color.all': 'Beliebige Farbe',

    'color.short.brown': 'Braun',
    'color.short.lightblue': 'Hellbl.',
    'color.short.pink': 'Pink',
    'color.short.orange': 'Orange',
    'color.short.red': 'Rot',
    'color.short.yellow': 'Gelb',
    'color.short.green': 'Grün',
    'color.short.blue': 'Blau',
    'color.short.railroad': 'Bahn',
    'color.short.utility': 'Werk',
    'color.short.all': 'Bel.',

    'mode.classic': 'Klassisch',
    'mode.deathmatch': 'Deathmatch',
    'mode.golden_rush': 'Golden Rush',
    'mode.classic.blurb': 'Wer zuerst 3 vollständige Farbsätze hat, gewinnt.',
    'mode.deathmatch.blurb': 'Gewinne mit 3 vollständigen Sätzen und leerer Hand.',
    'mode.golden_rush.blurb': 'Kommt bald.',

    'difficulty.easy': 'Leicht',
    'difficulty.normal': 'Normal',
    'difficulty.hard': 'Schwer',
    'difficulty.easy.blurb': 'Baut eigene Sätze und lässt dich in Ruhe.',
    'difficulty.normal.blurb': 'Kassiert Miete und klaut, wenn es sich lohnt.',
    'difficulty.hard.blurb': 'Verdoppelt Miete, bricht Sätze auf, blockt mit Sag einfach Nein.',

    'turn.none': 'Ohne Limit',
    'turn.seconds': '{seconds}s',
    'turn.minutes': '{minutes} Min.',

    'common.cancel': 'Abbrechen',
    'common.close': 'Schließen',
    'common.back': 'Zurück',
    'common.next': 'Weiter',
    'common.confirm': 'Bestätigen',
    'common.you': 'du',
    'common.money': '${amount}M',
    'common.language': 'Sprache',
};

export default common;
