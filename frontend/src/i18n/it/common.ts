import type { Catalog } from '../types';

/** Italian: words the whole app shares — colours, modes, difficulties, buttons. */
const common: Catalog = {
    'color.brown': 'Marrone',
    'color.lightblue': 'Azzurro',
    'color.pink': 'Rosa',
    'color.orange': 'Arancione',
    'color.red': 'Rosso',
    'color.yellow': 'Giallo',
    'color.green': 'Verde',
    'color.blue': 'Blu',
    'color.railroad': 'Ferrovia',
    'color.utility': 'Servizi',
    'color.all': 'Qualsiasi colore',

    'color.short.brown': 'Marr.',
    'color.short.lightblue': 'Azzurro',
    'color.short.pink': 'Rosa',
    'color.short.orange': 'Aran.',
    'color.short.red': 'Rosso',
    'color.short.yellow': 'Giallo',
    'color.short.green': 'Verde',
    'color.short.blue': 'Blu',
    'color.short.railroad': 'Ferr.',
    'color.short.utility': 'Serv.',
    'color.short.all': 'Tutti',

    'mode.classic': 'Classica',
    'mode.deathmatch': 'Scontro Mortale',
    'mode.golden_rush': 'Corsa all’oro',
    'mode.classic.blurb': 'Vince chi completa per primo 3 serie di colore.',
    'mode.deathmatch.blurb': 'Vinci con 3 serie complete e la mano vuota.',
    'mode.golden_rush.blurb': 'In arrivo.',

    'difficulty.easy': 'Facile',
    'difficulty.normal': 'Normale',
    'difficulty.hard': 'Difficile',
    'difficulty.easy.blurb': 'Costruisce le sue serie e ti lascia in pace.',
    'difficulty.normal.blurb': 'Chiede l’affitto e ruba quando conviene.',
    'difficulty.hard.blurb': 'Raddoppia l’affitto, rompe le serie e blocca con Dì Solo No.',

    'turn.none': 'Nessun limite',
    'turn.seconds': '{seconds}s',
    'turn.minutes': '{minutes} min',

    'common.cancel': 'Annulla',
    'common.close': 'Chiudi',
    'common.back': 'Indietro',
    'common.next': 'Avanti',
    'common.confirm': 'Conferma',
    'common.you': 'tu',
    'common.money': '${amount}M',
    'common.language': 'Lingua',
};

export default common;
