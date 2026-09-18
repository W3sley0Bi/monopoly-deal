import type { Catalog } from '../types';

/**
 * French: every card in the deck, keyed exactly as the Go deck generates the
 * keys (see backend/game/card.go: `cardKey` lowercases the English name and
 * turns runs of punctuation into a single underscore). Property names are
 * proper nouns and stay in English; everything else reads in French.
 */
const cards: Catalog = {
    // Properties (28)
    'prop.mediterranean_avenue': 'Mediterranean Avenue',
    'prop.baltic_avenue': 'Baltic Avenue',
    'prop.oriental_avenue': 'Oriental Avenue',
    'prop.vermont_avenue': 'Vermont Avenue',
    'prop.connecticut_avenue': 'Connecticut Avenue',
    'prop.st_charles_place': 'St. Charles Place',
    'prop.virginia_avenue': 'Virginia Avenue',
    'prop.states_avenue': 'States Avenue',
    'prop.st_james_place': 'St. James Place',
    'prop.tennessee_avenue': 'Tennessee Avenue',
    'prop.new_york_avenue': 'New York Avenue',
    'prop.kentucky_avenue': 'Kentucky Avenue',
    'prop.indiana_avenue': 'Indiana Avenue',
    'prop.illinois_avenue': 'Illinois Avenue',
    'prop.atlantic_avenue': 'Atlantic Avenue',
    'prop.ventnor_avenue': 'Ventnor Avenue',
    'prop.marvin_gardens': 'Marvin Gardens',
    'prop.pacific_avenue': 'Pacific Avenue',
    'prop.north_carolina_avenue': 'North Carolina Avenue',
    'prop.pennsylvania_avenue': 'Pennsylvania Avenue',
    'prop.park_place': 'Park Place',
    'prop.boardwalk': 'Boardwalk',
    'prop.reading_railroad': 'Reading Railroad',
    'prop.pennsylvania_railroad': 'Pennsylvania Railroad',
    'prop.b_o_railroad': 'B. & O. Railroad',
    'prop.short_line': 'Short Line',
    'prop.water_works': 'Water Works',
    'prop.electric_company': 'Electric Company',

    // Property wildcards (the "Wild: " prefix is stripped before slugifying).
    'wild.brown_light_blue': 'Joker : Marron/Bleu ciel',
    'wild.green_blue': 'Joker : Vert/Bleu',
    'wild.green_railroad': 'Joker : Vert/Gare',
    'wild.pink_orange': 'Joker : Rose/Orange',
    'wild.red_yellow': 'Joker : Rouge/Jaune',
    'wild.railroad_utility': 'Joker : Gare/Compagnie',
    'wild.light_blue_railroad': 'Joker : Bleu ciel/Gare',
    'wild.any_colour': 'Joker : Toutes couleurs',

    // Money
    'money.1': '$1M',
    'money.2': '$2M',
    'money.3': '$3M',
    'money.4': '$4M',
    'money.5': '$5M',
    'money.10': '$10M',

    // Actions (keyed by ActionType)
    'action.pass_go': 'Départ',
    'action.deal_breaker': 'Rupture de contrat',
    'action.sly_deal': 'Deal sournois',
    'action.forced_deal': 'Deal forcé',
    'action.debt_collector': 'Percepteur de dettes',
    'action.birthday': 'C’est mon anniversaire',
    'action.house': 'Maison',
    'action.hotel': 'Hôtel',
    'action.just_say_no': 'Juste dites non',
    'action.double_rent': 'Doublez le loyer',

    // Rent (the "Rent: " prefix is stripped before slugifying).
    'rent.green_blue': 'Loyer : Vert/Bleu',
    'rent.brown_light_blue': 'Loyer : Marron/Bleu ciel',
    'rent.pink_orange': 'Loyer : Rose/Orange',
    'rent.red_yellow': 'Loyer : Rouge/Jaune',
    'rent.railroad_utility': 'Loyer : Gare/Compagnie',
    'rent.any_colour': 'Loyer : Toutes couleurs',
};

export default cards;
