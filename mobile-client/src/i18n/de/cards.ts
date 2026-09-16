import type { Catalog } from '../types';

/**
 * Every card in the deck, keyed exactly as the Go deck generates the keys
 * (see backend/game/card.go: `cardKey` lowercases the English name and turns
 * runs of punctuation into a single underscore). The server sends only the
 * key, so these names are what a player actually reads on the card.
 */
const cards: Catalog = {
    // Properties (28) — street names are proper nouns and stay English.
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
    'wild.brown_light_blue': 'Joker: Braun/Hellblau',
    'wild.green_blue': 'Joker: Grün/Blau',
    'wild.green_railroad': 'Joker: Grün/Bahnhof',
    'wild.pink_orange': 'Joker: Pink/Orange',
    'wild.red_yellow': 'Joker: Rot/Gelb',
    'wild.railroad_utility': 'Joker: Bahnhof/Werk',
    'wild.light_blue_railroad': 'Joker: Hellblau/Bahnhof',
    'wild.any_colour': 'Joker: Beliebige Farbe',

    // Money
    'money.1': '$1M',
    'money.2': '$2M',
    'money.3': '$3M',
    'money.4': '$4M',
    'money.5': '$5M',
    'money.10': '$10M',

    // Actions (keyed by ActionType)
    'action.pass_go': 'Los!',
    'action.deal_breaker': 'Geschäftsbruch',
    'action.sly_deal': 'Trickbetrug',
    'action.forced_deal': 'Zwangstausch',
    'action.debt_collector': 'Schuldeneintreiber',
    'action.birthday': 'Ich hab Geburtstag',
    'action.house': 'Haus',
    'action.hotel': 'Hotel',
    'action.just_say_no': 'Sag einfach Nein',
    'action.double_rent': 'Doppelte Miete',

    // Rent (the "Rent: " prefix is stripped before slugifying).
    'rent.green_blue': 'Miete: Grün/Blau',
    'rent.brown_light_blue': 'Miete: Braun/Hellblau',
    'rent.pink_orange': 'Miete: Pink/Orange',
    'rent.red_yellow': 'Miete: Rot/Gelb',
    'rent.railroad_utility': 'Miete: Bahnhof/Werk',
    'rent.any_colour': 'Miete: Beliebige Farbe',
};

export default cards;
