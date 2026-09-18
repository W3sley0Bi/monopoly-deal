import type { Catalog } from '../types';

/** French: words the whole app shares — colours, modes, difficulties, buttons. */
const common: Catalog = {
    'color.brown': 'Marron',
    'color.lightblue': 'Bleu ciel',
    'color.pink': 'Rose',
    'color.orange': 'Orange',
    'color.red': 'Rouge',
    'color.yellow': 'Jaune',
    'color.green': 'Vert',
    'color.blue': 'Bleu',
    'color.railroad': 'Gare',
    'color.utility': 'Compagnie',
    'color.all': 'Toutes couleurs',

    'color.short.brown': 'Marron',
    'color.short.lightblue': 'Bleu ciel',
    'color.short.pink': 'Rose',
    'color.short.orange': 'Orange',
    'color.short.red': 'Rouge',
    'color.short.yellow': 'Jaune',
    'color.short.green': 'Vert',
    'color.short.blue': 'Bleu',
    'color.short.railroad': 'Gare',
    'color.short.utility': 'Comp.',
    'color.short.all': 'Toutes',

    'mode.classic': 'Classique',
    'mode.deathmatch': 'Combat à mort',
    'mode.golden_rush': 'Ruée vers l’or',
    'mode.classic.blurb': 'Le premier à réunir 3 groupes complets de couleur gagne.',
    'mode.deathmatch.blurb': 'Gagnez avec 3 groupes complets et une main vide.',
    'mode.golden_rush.blurb': 'Bientôt disponible.',

    'difficulty.easy': 'Facile',
    'difficulty.normal': 'Normal',
    'difficulty.hard': 'Difficile',
    'difficulty.easy.blurb': 'Construit ses propres groupes et vous laisse tranquille.',
    'difficulty.normal.blurb': 'Demande des loyers et vole quand c’est avantageux.',
    'difficulty.hard.blurb': 'Double les loyers, brise les groupes et contre avec Juste dites non.',

    'turn.none': 'Sans limite',
    'turn.seconds': '{seconds} s',
    'turn.minutes': '{minutes} min',

    'common.error': 'Une erreur s\'est produite',
    'common.cancel': 'Annuler',
    'common.close': 'Fermer',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.confirm': 'Confirmer',
    'common.save': 'Enregistrer',
    'common.you': 'vous',
    'common.money': '${amount}M',
    'common.language': 'Langue',
};

export default common;
