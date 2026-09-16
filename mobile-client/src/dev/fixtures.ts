/**
 * Hand-built tables for looking at the UI.
 *
 * These never touch the socket: the store holds one of these as `devRoom` and
 * the connection provider hands it out in place of the real room, so a fixture
 * is a *frozen* table — moves are inert. It exists to answer "what does a busy
 * five-player board look like", which is otherwise a twenty-minute game away.
 *
 * Kept out of the release build by the `__DEV__` gate at every call site.
 */
import type { Card, Color, GameView, PlayerView, RoomView, SetView } from '../types';

export interface Fixture {
    id: string;
    label: string;
    blurb: string;
    build: (youId: string, youName: string) => RoomView;
}

const SET_SIZES: Record<string, number> = {
    brown: 2, lightblue: 3, pink: 3, orange: 3, red: 3,
    yellow: 3, green: 3, blue: 2, railroad: 4, utility: 2, all: 0,
};

const RENT: Partial<Record<Color, number[]>> = {
    brown: [1, 2], lightblue: [1, 2, 3], pink: [1, 2, 4], orange: [1, 3, 5],
    red: [2, 3, 6], yellow: [2, 4, 6], green: [2, 4, 7], blue: [3, 8],
    railroad: [1, 2, 3, 4], utility: [1, 2],
};

const PROPERTY_NAMES: Partial<Record<Color, string[]>> = {
    brown: ['Mediterranean Avenue', 'Baltic Avenue'],
    lightblue: ['Oriental Avenue', 'Vermont Avenue', 'Connecticut Avenue'],
    pink: ['St. Charles Place', 'States Avenue', 'Virginia Avenue'],
    orange: ['St. James Place', 'Tennessee Avenue', 'New York Avenue'],
    red: ['Kentucky Avenue', 'Indiana Avenue', 'Illinois Avenue'],
    yellow: ['Atlantic Avenue', 'Ventnor Avenue', 'Marvin Gardens'],
    green: ['Pacific Avenue', 'North Carolina Avenue', 'Pennsylvania Avenue'],
    blue: ['Park Place', 'Boardwalk'],
    railroad: ['Reading Railroad', 'Pennsylvania Railroad', 'B&O Railroad', 'Short Line'],
    utility: ['Electric Company', 'Water Works'],
};

const PROPERTY_VALUE: Partial<Record<Color, number>> = {
    brown: 1, lightblue: 1, pink: 2, orange: 2, red: 3,
    yellow: 3, green: 4, blue: 4, railroad: 2, utility: 2,
};

let serial = 0;
const id = () => `dev${serial++}`;

function property(color: Color, index: number): Card {
    const name = PROPERTY_NAMES[color]?.[index] ?? `${color} ${index + 1}`;
    return {
        id: id(),
        key: `card.${name.toLowerCase().replace(/[^a-z]+/g, '_')}`,
        type: 'property',
        name,
        value: PROPERTY_VALUE[color] ?? 2,
        colors: [color],
    };
}

function money(value: number): Card {
    return { id: id(), key: `card.money_${value}`, type: 'money', name: `$${value}M`, value };
}

function action(name: string, actionType: Card['action'], value: number): Card {
    return { id: id(), key: `card.${actionType}`, type: 'action', name, value, action: actionType };
}

function rentCard(colors: Color[]): Card {
    return { id: id(), key: 'card.rent', type: 'rent', name: 'Rent', value: 1, colors };
}

function wildcard(colors: Color[]): Card {
    return {
        id: id(),
        key: 'card.property_wildcard',
        type: 'property_wildcard',
        name: 'Property Wildcard',
        value: colors.length === 10 ? 0 : 2,
        colors,
    };
}

/**
 * A set with `count` of the colour's cards in it.
 *
 * `build` follows the real rule: a house needs a complete set, a hotel needs a
 * house, and neither can go on a railroad or utility set — a fixture that broke
 * that would be testing a board the server can never send.
 */
function set(color: Color, count: number, build: 'none' | 'house' | 'hotel' = 'none'): SetView {
    const size = SET_SIZES[color] ?? 3;
    const cards = Array.from({ length: Math.min(count, size) }, (_, i) => property(color, i));
    const complete = cards.length >= size;
    const table = RENT[color] ?? [1, 2, 3];
    const buildable = complete && color !== 'railroad' && color !== 'utility';

    const buildings: Card[] = [];
    if (buildable && build !== 'none') buildings.push(action('House', 'house', 3));
    if (buildable && build === 'hotel') buildings.push(action('Hotel', 'hotel', 4));

    const base = table[Math.min(cards.length, table.length) - 1] ?? 0;
    return {
        color,
        cards,
        buildings,
        size,
        complete,
        rent: base + (buildings.length ? 3 : 0) + (buildings.length > 1 ? 4 : 0),
    };
}

function player(
    name: string,
    sets: SetView[],
    bank: Card[],
    handCount: number,
    options: { bot?: boolean; hand?: Card[]; playerId?: string } = {},
): PlayerView {
    const bankTotal = bank.reduce((sum, c) => sum + c.value, 0);
    const setValue = sets.flatMap(s => s.cards).reduce((sum, c) => sum + c.value, 0);
    return {
        id: options.playerId ?? id(),
        name,
        connected: true,
        bot: options.bot ?? true,
        hand_count: handCount,
        hand: options.hand,
        bank,
        bank_total: bankTotal,
        sets,
        complete_sets: sets.filter(s => s.complete).length,
        asset_total: bankTotal + setValue,
        has_just_say_no: false,
    };
}

function room(youId: string, game: GameView, label: string): RoomView {
    return {
        id: 'DEV1',
        name: label,
        private: false,
        invite_code: 'DEV1',
        owner_id: youId,
        owner_name: 'you',
        is_owner: true,
        you: youId,
        you_seated: true,
        you_requested: false,
        spectators: [],
        requests: [],
        seats_free: 0,
        modes: [],
        turn_options: [0, 30, 60, 120],
        respond_options: [0, 10, 15, 30],
        difficulties: ['easy', 'normal', 'hard'],
        game,
        radio: { name: '', url: '', playing: false },
        chat: [],
    };
}

/** Five seats, everyone holding two finished sets, money and loose property. */
function crowdedTable(youId: string, youName: string): RoomView {
    serial = 0;
    // Buildings are spread deliberately: one seat with a bare house, one with
    // house + hotel, one with neither, so the board shows all three states.
    const you = player(
        youName || 'You',
        [set('lightblue', 3, 'house'), set('orange', 3), set('red', 2), set('railroad', 2)],
        [money(5), money(3), money(2), money(1)],
        6,
        {
            bot: false,
            playerId: youId,
            hand: [
                property('green', 0),
                property('yellow', 1),
                wildcard(['pink', 'orange']),
                money(4),
                action('Deal Breaker', 'deal_breaker', 5),
                rentCard(['red', 'yellow']),
            ],
        },
    );

    const rivals = [
        // House and hotel on the same colour.
        player('Otto', [set('pink', 3, 'hotel'), set('blue', 2, 'house'), set('brown', 1), set('green', 2)], [money(4), money(2), money(2)], 5),
        // Complete sets, nothing built on them — railroads and utilities cannot
        // take a building at all.
        player('Rosie', [set('yellow', 3), set('railroad', 4), set('utility', 1)], [money(3), money(3), money(1)], 7),
        player('Bishop', [set('green', 3, 'house'), set('brown', 2, 'hotel'), set('lightblue', 2), set('pink', 1), set('orange', 1)], [money(5), money(5)], 4),
        player('Marvin', [set('red', 3, 'house'), set('utility', 2), set('blue', 1), set('yellow', 2), set('railroad', 3)], [money(2), money(1), money(1), money(1)], 3),
    ];

    const players = [you, ...rivals];
    const game: GameView = {
        id: 'DEV1',
        you: youId,
        players,
        deck_count: 41,
        discard_count: 12,
        discard_top: action('Forced Deal', 'forced_deal', 3),
        current_turn: 0,
        state: 'playing',
        plays_left: 2,
        pending: null,
        log: [
            { key: 'log.played_property', args: { name: 'Bishop', card: 'Pacific Avenue', color: 'Green' } },
            { key: 'log.banked', args: { name: 'Rosie', amount: 3 } },
        ] as GameView['log'],
        set_sizes: SET_SIZES,
        colors: ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'railroad', 'utility'],
        mode: 'classic',
        mode_label: 'Classic',
        turn_seconds: 0,
        respond_seconds: 0,
        bot_difficulty: 'normal',
        deadline_ms: 0,
        deadline_seconds: 0,
        now_ms: Date.now(),
    };
    return room(youId, game, 'Dev · five-player table');
}

export const FIXTURES: Fixture[] = [
    {
        id: 'crowded',
        label: 'Five-player table',
        blurb: 'Everyone holding two full sets, money and loose property',
        build: crowdedTable,
    },
];
