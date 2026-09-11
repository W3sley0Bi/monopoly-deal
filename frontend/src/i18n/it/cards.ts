import type { Catalog } from '../types';

/**
 * Italian: every card in the deck, keyed exactly as the Go deck generates the
 * keys (see backend/game/card.go: `cardKey` lowercases the English name and
 * turns runs of punctuation into a single underscore). Property names are
 * proper nouns and stay in English; everything else reads in Italian.
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
    'wild.brown_light_blue': 'Jolly: Marrone/Azzurro',
    'wild.green_blue': 'Jolly: Verde/Blu',
    'wild.green_railroad': 'Jolly: Verde/Ferrovia',
    'wild.pink_orange': 'Jolly: Rosa/Arancione',
    'wild.red_yellow': 'Jolly: Rosso/Giallo',
    'wild.railroad_utility': 'Jolly: Ferrovia/Servizi',
    'wild.light_blue_railroad': 'Jolly: Azzurro/Ferrovia',
    'wild.any_colour': 'Jolly: Qualsiasi colore',

    // Money
    'money.1': '$1M',
    'money.2': '$2M',
    'money.3': '$3M',
    'money.4': '$4M',
    'money.5': '$5M',
    'money.10': '$10M',

    // Actions (keyed by ActionType)
    'action.pass_go': 'Via!',
    'action.deal_breaker': 'Affare Rotto',
    'action.sly_deal': 'Furto Furbo',
    'action.forced_deal': 'Scambio Forzato',
    'action.debt_collector': 'Esattore',
    'action.birthday': 'È il mio compleanno',
    'action.house': 'Casa',
    'action.hotel': 'Albergo',
    'action.just_say_no': 'Dì Solo No',
    'action.double_rent': 'Raddoppia l’Affitto',

    // Rent (the "Rent: " prefix is stripped before slugifying).
    'rent.green_blue': 'Affitto: Verde/Blu',
    'rent.brown_light_blue': 'Affitto: Marrone/Azzurro',
    'rent.pink_orange': 'Affitto: Rosa/Arancione',
    'rent.red_yellow': 'Affitto: Rosso/Giallo',
    'rent.railroad_utility': 'Affitto: Ferrovia/Servizi',
    'rent.any_colour': 'Affitto: Qualsiasi colore',
};

export default cards;
