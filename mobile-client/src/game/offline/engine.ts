import type {
    Card,
    ClientMessage,
    Color,
    Difficulty,
    LogEntry,
    Mode,
    Pending,
    PlayerView,
    RadioState,
    RoomView,
    SetView,
} from '../../types';

const COLORS: Color[] = [
    'brown', 'lightblue', 'pink', 'orange', 'red',
    'yellow', 'green', 'blue', 'railroad', 'utility',
];

const RENT: Record<string, number[]> = {
    brown: [1, 2], lightblue: [1, 2, 3], pink: [1, 2, 4], orange: [1, 3, 5],
    red: [2, 3, 6], yellow: [2, 4, 6], green: [2, 4, 7], blue: [3, 8],
    railroad: [1, 2, 3, 4], utility: [1, 2],
};

const BOT_NAMES = ['🤖 Otto', '🤖 Rosie', '🤖 Bender', '🤖 Clank'];
const MAX_PLAYERS = 5;
const HAND_LIMIT = 7;
const PLAYS_PER_TURN = 3;

interface OfflineSet {
    color: Color;
    cards: Card[];
    buildings: Card[];
}

interface OfflinePlayer {
    id: string;
    name: string;
    bot: boolean;
    hand: Card[];
    bank: Card[];
    sets: OfflineSet[];
}

interface OfflinePending extends Pending {
    extra: Card[];
}

export class OfflineGameError extends Error {
    constructor(public readonly key: string, public readonly args?: Record<string, unknown>) {
        super(key);
    }
}

function fail(key: string, args?: Record<string, unknown>): never {
    throw new OfflineGameError(key, args);
}

function shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

function isProperty(card: Card): boolean {
    return card.type === 'property' || card.type === 'property_wildcard';
}

function playableColors(card: Card): Color[] {
    return card.colors?.includes('all') ? COLORS : (card.colors ?? []);
}

function accepts(card: Card, color: Color): boolean {
    return playableColors(card).includes(color);
}

function setSize(color: Color): number {
    return RENT[color]?.length ?? 0;
}

function complete(set: OfflineSet): boolean {
    return set.cards.length >= setSize(set.color);
}

function rentFor(set: OfflineSet): number {
    const table = RENT[set.color] ?? [];
    if (!table.length || !set.cards.length) return 0;
    let rent = table[Math.min(set.cards.length, table.length) - 1];
    if (complete(set)) {
        if (set.buildings.some((c) => c.action === 'house')) rent += 3;
        if (set.buildings.some((c) => c.action === 'hotel')) rent += 4;
    }
    return rent;
}

function bankTotal(player: OfflinePlayer): number {
    return player.bank.reduce((sum, card) => sum + card.value, 0);
}

function assetTotal(player: OfflinePlayer): number {
    return bankTotal(player) + player.sets.reduce(
        (sum, set) => sum + [...set.cards, ...set.buildings].reduce((n, card) => n + card.value, 0),
        0,
    );
}

function completeSets(player: OfflinePlayer): number {
    return player.sets.filter(complete).length;
}

function cardKey(prefix: string, name: string): string {
    return `${prefix}.${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

function generateDeck(): Card[] {
    let sequence = 0;
    const deck: Card[] = [];
    const add = (card: Omit<Card, 'id'>, count: number) => {
        for (let i = 0; i < count; i++) deck.push({ ...card, id: `offline-${++sequence}` });
    };
    const money = (value: number, count: number) =>
        add({ type: 'money', key: `money.${value}`, name: `$${value}M`, value }, count);
    const action = (name: string, actionType: NonNullable<Card['action']>, value: number, count: number) =>
        add({ type: 'action', action: actionType, key: `action.${actionType}`, name, value }, count);
    const property = (name: string, value: number, color: Color) =>
        add({ type: 'property', key: cardKey('prop', name), name, value, colors: [color] }, 1);
    const wild = (name: string, value: number, colors: Color[], count = 1) =>
        add({ type: 'property_wildcard', key: cardKey('wild', name.replace(/^Wild: /, '')), name, value, colors }, count);
    const rent = (name: string, colors: Color[], count: number, value = 1) =>
        add({ type: 'rent', action: undefined, key: cardKey('rent', name), name: `Rent: ${name}`, value, colors }, count);

    money(10, 1); money(5, 2); money(4, 3); money(3, 3); money(2, 5); money(1, 6);
    action('Pass Go', 'pass_go', 1, 10);
    action('Deal Breaker', 'deal_breaker', 5, 2);
    action('Sly Deal', 'sly_deal', 3, 3);
    action('Forced Deal', 'forced_deal', 3, 3);
    action('Debt Collector', 'debt_collector', 3, 3);
    action("It's My Birthday", 'birthday', 2, 3);
    action('Just Say No', 'just_say_no', 4, 3);
    action('Double The Rent', 'double_rent', 1, 2);
    action('House', 'house', 3, 3);
    action('Hotel', 'hotel', 4, 2);
    rent('Green/Blue', ['green', 'blue'], 2);
    rent('Brown/Light Blue', ['brown', 'lightblue'], 2);
    rent('Pink/Orange', ['pink', 'orange'], 2);
    rent('Red/Yellow', ['red', 'yellow'], 2);
    rent('Railroad/Utility', ['railroad', 'utility'], 2);
    rent('Any Colour', ['all'], 3, 3);

    const properties: Array<[string, number, Color]> = [
        ['Mediterranean Avenue', 1, 'brown'], ['Baltic Avenue', 1, 'brown'],
        ['Oriental Avenue', 1, 'lightblue'], ['Vermont Avenue', 1, 'lightblue'], ['Connecticut Avenue', 1, 'lightblue'],
        ['St. Charles Place', 2, 'pink'], ['Virginia Avenue', 2, 'pink'], ['States Avenue', 2, 'pink'],
        ['St. James Place', 2, 'orange'], ['Tennessee Avenue', 2, 'orange'], ['New York Avenue', 2, 'orange'],
        ['Kentucky Avenue', 3, 'red'], ['Indiana Avenue', 3, 'red'], ['Illinois Avenue', 3, 'red'],
        ['Atlantic Avenue', 3, 'yellow'], ['Ventnor Avenue', 3, 'yellow'], ['Marvin Gardens', 3, 'yellow'],
        ['Pacific Avenue', 4, 'green'], ['North Carolina Avenue', 4, 'green'], ['Pennsylvania Avenue', 4, 'green'],
        ['Park Place', 4, 'blue'], ['Boardwalk', 4, 'blue'],
        ['Reading Railroad', 2, 'railroad'], ['Pennsylvania Railroad', 2, 'railroad'],
        ['B. & O. Railroad', 2, 'railroad'], ['Short Line', 2, 'railroad'],
        ['Water Works', 2, 'utility'], ['Electric Company', 2, 'utility'],
    ];
    properties.forEach(([name, value, color]) => property(name, value, color));
    wild('Wild: Brown/Light Blue', 1, ['brown', 'lightblue']);
    wild('Wild: Green/Blue', 4, ['green', 'blue']);
    wild('Wild: Green/Railroad', 4, ['green', 'railroad']);
    wild('Wild: Pink/Orange', 2, ['pink', 'orange'], 2);
    wild('Wild: Red/Yellow', 3, ['red', 'yellow'], 2);
    wild('Wild: Railroad/Utility', 2, ['railroad', 'utility']);
    wild('Wild: Light Blue/Railroad', 4, ['lightblue', 'railroad']);
    wild('Wild: Any Colour', 0, ['all'], 2);
    return shuffle(deck);
}

function modeLabel(mode: Mode): string {
    return mode === 'deathmatch' ? 'Death Match' : 'Classic';
}

export interface OfflineGameOptions {
    playerId: string;
    playerName: string;
    roomName: string;
    bots: number;
    difficulty: Difficulty;
    mode?: Mode;
}

export class OfflineGame {
    private deck: Card[] = [];
    private discard: Card[] = [];
    private players: OfflinePlayer[] = [];
    private currentTurn = 0;
    private playsLeft = 0;
    private state: 'playing' | 'finished' = 'playing';
    private winnerId: string | undefined;
    private pending: OfflinePending | null = null;
    private log: LogEntry[] = [];
    private chat: RoomView['chat'] = [];
    private chatSequence = 0;
    private startNumber = 0;
    readonly id = 'SOLO';
    readonly playerId: string;
    readonly playerName: string;
    readonly roomName: string;
    readonly difficulty: Difficulty;
    readonly mode: Mode;

    constructor(options: OfflineGameOptions) {
        this.playerId = options.playerId;
        this.playerName = options.playerName;
        this.roomName = options.roomName;
        this.difficulty = options.difficulty;
        this.mode = options.mode === 'deathmatch' ? 'deathmatch' : 'classic';
        const botCount = Math.max(1, Math.min(4, options.bots));
        this.players = [
            this.makePlayer(options.playerId, options.playerName, false),
            ...Array.from({ length: botCount }, (_, i) => this.makePlayer(`offline-bot-${i + 1}`, BOT_NAMES[i], true)),
        ];
        this.startGame();
    }

    private makePlayer(id: string, name: string, bot: boolean): OfflinePlayer {
        return { id, name, bot, hand: [], bank: [], sets: [] };
    }

    private write(key: string, args?: Record<string, unknown>) {
        this.log.push({ key, args });
        if (this.log.length > 60) this.log = this.log.slice(-60);
    }

    private startGame() {
        this.deck = generateDeck();
        this.discard = [];
        this.pending = null;
        this.winnerId = undefined;
        this.state = 'playing';
        this.players.forEach((player) => { player.hand = []; player.bank = []; player.sets = []; });
        const first = Math.floor(Math.random() * this.players.length);
        this.players = [...this.players.slice(first), ...this.players.slice(0, first)];
        this.players.forEach((player) => { for (let i = 0; i < 5; i++) this.drawInto(player); });
        this.currentTurn = 0;
        this.startNumber++;
        this.write('log.game_started', { mode: this.mode, players: this.players.length });
        this.startTurn();
    }

    private player(id: string): OfflinePlayer {
        const player = this.players.find((candidate) => candidate.id === id);
        if (!player) fail('err.player_not_found');
        return player;
    }

    private current(): OfflinePlayer {
        return this.players[this.currentTurn];
    }

    private opponents(player: OfflinePlayer): OfflinePlayer[] {
        return this.players.filter((candidate) => candidate.id !== player.id);
    }

    private drawInto(player: OfflinePlayer): boolean {
        if (!this.deck.length && this.discard.length) {
            this.deck = shuffle(this.discard.splice(0));
            this.write('log.reshuffled');
        }
        const card = this.deck.shift();
        if (!card) return false;
        player.hand.push(card);
        return true;
    }

    private startTurn() {
        const player = this.current();
        const count = player.hand.length ? 2 : 5;
        for (let i = 0; i < count; i++) this.drawInto(player);
        this.playsLeft = PLAYS_PER_TURN;
        this.write('log.turn', { name: player.name });
    }

    private requireTurn(playerId: string, needsPlay = false): OfflinePlayer {
        if (this.state !== 'playing') fail('err.no_game');
        if (this.pending) fail('err.resolve_first');
        if (this.current().id !== playerId) fail('err.not_your_turn');
        if (needsPlay && this.playsLeft <= 0) fail('err.no_plays_left');
        return this.current();
    }

    private takeHand(player: OfflinePlayer, cardId?: string): Card {
        const index = player.hand.findIndex((card) => card.id === cardId);
        if (index < 0) fail('err.card_not_in_hand');
        return player.hand.splice(index, 1)[0];
    }

    private peekHand(player: OfflinePlayer, cardId?: string): Card {
        const card = player.hand.find((candidate) => candidate.id === cardId);
        if (!card) fail('err.card_not_in_hand');
        return card;
    }

    private ensureSet(player: OfflinePlayer, color: Color): OfflineSet {
        let set = player.sets.find((candidate) => candidate.color === color);
        if (!set) {
            set = { color, cards: [], buildings: [] };
            player.sets.push(set);
        }
        return set;
    }

    private prune(player: OfflinePlayer) {
        player.sets = player.sets.filter((set) => set.cards.length || set.buildings.length);
    }

    private playBank(playerId: string, cardId?: string) {
        const player = this.requireTurn(playerId, true);
        const card = this.peekHand(player, cardId);
        if (isProperty(card)) fail('err.no_banking_property');
        this.takeHand(player, card.id);
        player.bank.push(card);
        this.playsLeft--;
        this.write(card.type === 'money' ? 'log.banked_money' : 'log.banked',
            card.type === 'money'
                ? { name: player.name, amount: card.value }
                : { name: player.name, card: card.key, amount: card.value });
        this.checkWin(player);
    }

    private playProperty(playerId: string, cardId?: string, color?: Color) {
        const player = this.requireTurn(playerId, true);
        const card = this.peekHand(player, cardId);
        if (!isProperty(card)) fail('err.not_a_property');
        if (!color || color === 'all') fail('err.choose_colour');
        if (!accepts(card, color)) fail('err.wrong_colour', { card: card.key, color });
        this.takeHand(player, card.id);
        this.ensureSet(player, color).cards.push(card);
        this.playsLeft--;
        this.write('log.played_property', { name: player.name, card: card.key, color });
        this.checkWin(player);
    }

    private moveWildcard(playerId: string, cardId?: string, color?: Color) {
        const player = this.requireTurn(playerId, true);
        if (!color || color === 'all') fail('err.choose_colour');
        for (const source of player.sets) {
            const index = source.cards.findIndex((card) => card.id === cardId);
            if (index < 0) continue;
            const card = source.cards[index];
            if (card.type !== 'property_wildcard') fail('err.only_wildcards_move');
            if (!accepts(card, color)) fail('err.wrong_colour', { card: card.key, color });
            if (source.color === color) fail('err.already_that_colour');
            if (card.colors?.includes('all') && !player.sets.some((set) => set.color === color && set.cards.length)) {
                fail('err.wild_any_needs_set', { color });
            }
            source.cards.splice(index, 1);
            this.ensureSet(player, color).cards.push(card);
            this.prune(player);
            this.playsLeft--;
            this.write('log.moved_wildcard', { name: player.name, card: card.key, color });
            this.checkWin(player);
            return;
        }
        fail('err.wildcard_not_in_play');
    }

    private playAction(playerId: string, message: ClientMessage) {
        const player = this.requireTurn(playerId, true);
        const card = this.peekHand(player, message.card_id);
        if (card.type !== 'action' && card.type !== 'rent') fail('err.no_action');
        if (card.action === 'just_say_no') fail('err.jsn_response_only');
        if (card.action === 'double_rent') fail('err.double_rent_with_rent');

        if (card.type === 'rent') return this.playRent(player, card, message);
        if (card.action === 'pass_go') {
            this.takeHand(player, card.id); this.discard.push(card); this.playsLeft--;
            let count = 0;
            if (this.drawInto(player)) count++;
            if (this.drawInto(player)) count++;
            this.write('log.pass_go', { name: player.name, count });
            return;
        }
        if (card.action === 'house' || card.action === 'hotel') return this.playBuilding(player, card, message.color);
        if (card.action === 'birthday') return this.startPayment(player, card, this.opponents(player), 2, 'pending.birthday');
        if (card.action === 'debt_collector') {
            const target = this.target(player, message.target_player_id);
            return this.startPayment(player, card, [target], 5, 'pending.debt_collector');
        }
        if (card.action === 'sly_deal' || card.action === 'forced_deal' || card.action === 'deal_breaker') {
            return this.startSteal(player, card, message);
        }
        fail('err.unsupported_card');
    }

    private playBuilding(player: OfflinePlayer, card: Card, color?: Color) {
        if (!color) fail('err.choose_set');
        const set = player.sets.find((candidate) => candidate.color === color);
        if (!set || !complete(set)) fail('err.needs_complete_set', { card: card.key });
        if (color === 'railroad' || color === 'utility') fail('err.cannot_build_here');
        if (card.action === 'house' && set.buildings.some((item) => item.action === 'house')) fail('err.has_house');
        if (card.action === 'hotel' && !set.buildings.some((item) => item.action === 'house')) fail('err.house_before_hotel');
        if (card.action === 'hotel' && set.buildings.some((item) => item.action === 'hotel')) fail('err.has_hotel');
        this.takeHand(player, card.id); set.buildings.push(card); this.playsLeft--;
        this.write('log.building', { name: player.name, card: card.key, color, rent: rentFor(set) });
    }

    private playRent(player: OfflinePlayer, card: Card, message: ClientMessage) {
        const color = message.color;
        if (!color) fail('err.choose_rent_colour');
        if (!accepts(card, color)) fail('err.rent_wrong_colour', { card: card.key, color });
        const set = player.sets.find((candidate) => candidate.color === color);
        if (!set?.cards.length) fail('err.no_properties_of_colour', { color });
        let amount = rentFor(set);
        const doubles = message.double_card_ids ?? [];
        if (this.playsLeft < 1 + doubles.length) fail('err.need_plays', { need: 1 + doubles.length, have: this.playsLeft });
        const extra = doubles.map((id) => {
            const item = this.peekHand(player, id);
            if (item.action !== 'double_rent') fail('err.not_double_rent');
            return item;
        });
        extra.forEach((item) => { this.takeHand(player, item.id); this.playsLeft--; amount *= 2; });
        const targets = card.colors?.includes('all')
            ? [this.target(player, message.target_player_id)]
            : this.opponents(player);
        this.startPayment(player, card, targets, amount, extra.length ? 'pending.rent_multiplied' : 'pending.rent', extra, {
            color, ...(extra.length ? { multiplier: 2 ** extra.length } : {}),
        });
    }

    private target(player: OfflinePlayer, targetId?: string): OfflinePlayer {
        if (!targetId) fail('err.choose_target');
        if (targetId === player.id) fail('err.no_self_target');
        return this.player(targetId);
    }

    private startPayment(
        player: OfflinePlayer,
        card: Card,
        targets: OfflinePlayer[],
        amount: number,
        labelKey: string,
        extra: Card[] = [],
        labelArgs: Record<string, unknown> = {},
    ) {
        this.takeHand(player, card.id); this.playsLeft--;
        this.pending = {
            kind: 'payment', action: card.action!, card, by_id: player.id,
            label_key: labelKey, label_args: { ...labelArgs, amount }, extra,
            targets: targets.map((target) => ({
                player_id: target.id, amount, responder: target.id, cancelled: false, settled: false,
            })),
        };
        this.write(targets.length > 1 ? 'log.charge_everyone' : 'log.charge', {
            name: player.name, card: card.key,
            targets: targets.length > 1 ? 'everyone' : targets[0]?.name,
            amount,
        });
        this.settleAutomatic();
    }

    private findProperty(player: OfflinePlayer, cardId?: string): { set: OfflineSet; card: Card } {
        if (!cardId) fail('err.choose_property');
        for (const set of player.sets) {
            const card = set.cards.find((candidate) => candidate.id === cardId);
            if (!card) continue;
            if (complete(set)) fail('err.complete_set_protected');
            return { set, card };
        }
        fail('err.property_not_found');
    }

    private startSteal(player: OfflinePlayer, card: Card, message: ClientMessage) {
        const target = this.target(player, message.target_player_id);
        let kind: OfflinePending['kind'];
        let targetColor: Color | undefined;
        if (card.action === 'deal_breaker') {
            kind = 'deal_breaker';
            const set = target.sets.find((candidate) => candidate.color === message.color);
            if (!set || !complete(set)) fail('err.deal_breaker_needs_set');
            targetColor = set.color;
        } else {
            kind = card.action === 'forced_deal' ? 'forced_deal' : 'sly_deal';
            targetColor = this.findProperty(target, message.target_card_id).set.color;
            if (kind === 'forced_deal') this.findProperty(player, message.give_card_id);
        }
        this.takeHand(player, card.id); this.playsLeft--;
        this.pending = {
            kind, action: card.action!, card, by_id: player.id, extra: [],
            label_key: `pending.${card.action}`,
            target_player_id: target.id, target_card_id: message.target_card_id,
            target_color: targetColor, give_card_id: message.give_card_id,
            targets: [{ player_id: target.id, amount: 0, responder: target.id, cancelled: false, settled: false }],
        };
        const logKey = card.action === 'deal_breaker' ? 'log.deal_breaker'
            : card.action === 'forced_deal' ? 'log.forced_deal' : 'log.sly_deal';
        this.write(logKey, { name: player.name, target: target.name, color: targetColor });
        this.settleAutomatic();
    }

    private hasJSN(player: OfflinePlayer): boolean {
        return player.hand.some((card) => card.action === 'just_say_no');
    }

    private settleAutomatic() {
        const pending = this.pending;
        if (!pending?.targets) return;
        for (const target of pending.targets) {
            if (target.settled) continue;
            const player = this.player(target.player_id);
            if (target.responder === target.player_id && !target.cancelled && !this.hasJSN(player)) {
                if (pending.kind !== 'payment') target.settled = true;
                else if (assetTotal(player) === 0) {
                    target.settled = true;
                    this.write('log.nothing_to_pay', { name: player.name });
                }
            }
            if (target.responder === pending.by_id && !this.hasJSN(this.player(pending.by_id))) target.settled = true;
        }
        this.resolveIfDone();
    }

    private respond(playerId: string, sayNo: boolean, cardIds: string[] = []) {
        const pending = this.pending;
        if (!pending?.targets) fail('err.nothing_to_respond');
        const target = pending.targets.find((candidate) => !candidate.settled && candidate.responder === playerId);
        if (!target) fail('err.not_your_response');
        const player = this.player(playerId);
        if (sayNo) {
            const jsn = player.hand.find((card) => card.action === 'just_say_no');
            if (!jsn) fail('err.no_jsn');
            this.takeHand(player, jsn.id); this.discard.push(jsn);
            target.cancelled = !target.cancelled;
            target.responder = playerId === pending.by_id ? target.player_id : pending.by_id;
            this.write(target.cancelled ? 'log.just_say_no_cancelled' : 'log.just_say_no_back_on', {
                name: player.name, label: pending.label_key, label_args: pending.label_args,
            });
            this.settleAutomatic();
            return;
        }
        if (playerId === pending.by_id) {
            target.settled = true;
            this.write('log.accepts_block', { name: player.name });
        } else if (target.cancelled) {
            fail('err.waiting_other_player');
        } else if (pending.kind === 'payment') {
            this.pay(pending, target, cardIds);
            target.settled = true;
        } else {
            target.settled = true;
        }
        this.settleAutomatic();
    }

    private assets(player: OfflinePlayer): Array<{ card: Card; color?: Color; property: boolean }> {
        return [
            ...player.bank.map((card) => ({ card, property: false })),
            ...player.sets.flatMap((set) => [
                ...set.cards.map((card) => ({ card, color: set.color, property: true })),
                ...set.buildings.map((card) => ({ card, color: set.color, property: false })),
            ]),
        ];
    }

    private takeAsset(player: OfflinePlayer, cardId: string): { card: Card; color?: Color } {
        const bankIndex = player.bank.findIndex((card) => card.id === cardId);
        if (bankIndex >= 0) return { card: player.bank.splice(bankIndex, 1)[0] };
        for (const set of player.sets) {
            let index = set.cards.findIndex((card) => card.id === cardId);
            if (index >= 0) return { card: set.cards.splice(index, 1)[0], color: set.color };
            index = set.buildings.findIndex((card) => card.id === cardId);
            if (index >= 0) return { card: set.buildings.splice(index, 1)[0], color: set.color };
        }
        fail('err.card_not_in_play');
    }

    private giveProperty(player: OfflinePlayer, card: Card, preferred?: Color) {
        let color = preferred && accepts(card, preferred) ? preferred : playableColors(card)[0];
        color = playableColors(card).find((candidate) => {
            const set = player.sets.find((item) => item.color === candidate);
            return set && !complete(set);
        }) ?? color;
        this.ensureSet(player, color).cards.push(card);
    }

    private pay(pending: OfflinePending, target: NonNullable<Pending['targets']>[number], cardIds: string[]) {
        const from = this.player(target.player_id);
        const to = this.player(pending.by_id);
        if (new Set(cardIds).size !== cardIds.length) fail('err.duplicate_payment_card');
        const selected = cardIds.map((id) => this.assets(from).find((asset) => asset.card.id === id)?.card ?? fail('err.card_not_in_play'));
        const total = selected.reduce((sum, card) => sum + card.value, 0);
        if (total < target.amount && total < assetTotal(from)) {
            fail('err.pay_more', { amount: target.amount, selected: total, available: assetTotal(from) });
        }
        let paid = 0;
        cardIds.forEach((id) => {
            const { card, color } = this.takeAsset(from, id);
            paid += card.value;
            if (isProperty(card)) this.giveProperty(to, card, color);
            else to.bank.push(card);
        });
        this.prune(from);
        this.write('log.paid', { from: from.name, to: to.name, amount: paid, count: cardIds.length });
        this.checkWin(to);
    }

    private resolveIfDone() {
        const pending = this.pending;
        if (!pending?.targets?.every((target) => target.settled)) return;
        const by = this.player(pending.by_id);
        const target = pending.target_player_id ? this.player(pending.target_player_id) : undefined;
        if (target && !pending.targets[0].cancelled) {
            if (pending.kind === 'sly_deal' && pending.target_card_id) {
                const taken = this.takeAsset(target, pending.target_card_id);
                this.giveProperty(by, taken.card, taken.color); this.prune(target);
                this.write('log.stole', { name: by.name, card: taken.card.key, target: target.name });
            } else if (pending.kind === 'forced_deal' && pending.target_card_id && pending.give_card_id) {
                const theirs = this.takeAsset(target, pending.target_card_id);
                const mine = this.takeAsset(by, pending.give_card_id);
                this.giveProperty(by, theirs.card, theirs.color);
                this.giveProperty(target, mine.card, mine.color);
                this.prune(by); this.prune(target);
                this.write('log.swapped', { name: by.name, target: target.name, gave: mine.card.key, got: theirs.card.key });
            } else if (pending.kind === 'deal_breaker' && pending.target_color) {
                const index = target.sets.findIndex((set) => set.color === pending.target_color);
                if (index >= 0) {
                    const stolen = target.sets.splice(index, 1)[0];
                    const destination = this.ensureSet(by, stolen.color);
                    destination.cards.push(...stolen.cards); destination.buildings.push(...stolen.buildings);
                    this.write('log.took_set', { name: by.name, target: target.name, color: stolen.color });
                }
            }
        }
        this.discard.push(pending.card, ...pending.extra);
        this.pending = null;
        this.checkWin(by);
    }

    private endTurn(playerId: string) {
        const player = this.requireTurn(playerId);
        const over = player.hand.length - HAND_LIMIT;
        if (over > 0) {
            for (let i = 0; i < over; i++) {
                const index = Math.floor(Math.random() * player.hand.length);
                this.discard.push(player.hand.splice(index, 1)[0]);
            }
            this.write('log.discarded_excess', { name: player.name, count: over });
        }
        this.currentTurn = (this.currentTurn + 1) % this.players.length;
        this.startTurn();
    }

    private checkWin(player: OfflinePlayer) {
        const won = completeSets(player) >= 3 && (this.mode !== 'deathmatch' || player.hand.length === 0);
        if (!won || this.state !== 'playing') return;
        this.state = 'finished'; this.winnerId = player.id; this.pending = null;
        this.write(this.mode === 'deathmatch' ? 'log.win_deathmatch' : 'log.win_classic', {
            name: player.name, sets: completeSets(player),
        });
    }

    dispatch(message: Omit<ClientMessage, 'player_id'>) {
        switch (message.type) {
            case 'play_bank': this.playBank(this.playerId, message.card_id); break;
            case 'play_property': this.playProperty(this.playerId, message.card_id, message.color); break;
            case 'move_wildcard': this.moveWildcard(this.playerId, message.card_id, message.color); break;
            case 'play_action': this.playAction(this.playerId, message as ClientMessage); break;
            case 'end_turn': this.endTurn(this.playerId); break;
            case 'respond': this.respond(this.playerId, Boolean(message.say_no), message.card_ids); break;
            case 'new_game': this.startGame(); break;
            case 'terminate_game': this.state = 'finished'; break;
            case 'chat':
                if (message.text?.trim()) {
                    this.chat.push({ id: `SOLO-${++this.chatSequence}`, player_id: this.playerId, name: this.playerName,
                        text: message.text.trim(), at_ms: Date.now() });
                }
                break;
            default: break;
        }
    }

    isBotWaiting(): boolean {
        if (this.state !== 'playing') return false;
        if (this.pending?.targets) {
            return this.pending.targets.some((target) => !target.settled && this.player(target.responder).bot);
        }
        return this.current().bot;
    }

    stepBot() {
        if (!this.isBotWaiting()) return;
        const pending = this.pending;
        if (pending?.targets) {
            const target = pending.targets.find((item) => !item.settled && this.player(item.responder).bot);
            if (!target) return;
            const bot = this.player(target.responder);
            let sayNo = false;
            if (this.hasJSN(bot) && this.difficulty !== 'easy') {
                sayNo = pending.kind === 'deal_breaker'
                    || (this.difficulty === 'hard' && pending.kind !== 'payment')
                    || (pending.kind === 'payment' && target.amount > bankTotal(bot) && target.amount >= (this.difficulty === 'hard' ? 2 : 3));
            }
            const cards = pending.kind === 'payment' && !sayNo && target.responder !== pending.by_id
                ? this.autoPay(bot, target.amount) : [];
            this.respond(bot.id, sayNo, cards);
            return;
        }
        const bot = this.current();
        if (this.playsLeft > 0 && this.botPlay(bot)) return;
        this.endTurn(bot.id);
    }

    private autoPay(player: OfflinePlayer, amount: number): string[] {
        const assets = this.assets(player).sort((a, b) => Number(a.property) - Number(b.property) || a.card.value - b.card.value);
        const ids: string[] = [];
        let total = 0;
        for (const asset of assets) {
            if (total >= amount) break;
            ids.push(asset.card.id); total += asset.card.value;
        }
        return ids;
    }

    private botPlay(bot: OfflinePlayer): boolean {
        const tryPlay = (fn: () => void): boolean => {
            try { fn(); return true; } catch { return false; }
        };
        const action = (name: Card['action']) => bot.hand.find((card) => card.action === name && card.type === 'action');

        if (this.difficulty === 'hard') {
            const breaker = action('deal_breaker');
            const richestSet = this.opponents(bot).flatMap((player) => player.sets.filter(complete).map((set) => ({ player, set })))
                .sort((a, b) => rentFor(b.set) - rentFor(a.set))[0];
            if (breaker && richestSet && tryPlay(() => this.playAction(bot.id, {
                type: 'play_action', player_id: bot.id, card_id: breaker.id,
                target_player_id: richestSet.player.id, color: richestSet.set.color,
            }))) return true;
        }

        const propertyMoves = bot.hand.filter(isProperty).flatMap((card) => playableColors(card).map((color) => {
            const held = bot.sets.find((set) => set.color === color)?.cards.length ?? 0;
            return { card, color, score: (held + 1 >= setSize(color) ? 200 : 0) + held * 10 + (RENT[color]?.[held] ?? 0) };
        })).filter((move) => (bot.sets.find((set) => set.color === move.color)?.cards.length ?? 0) < setSize(move.color))
            .sort((a, b) => b.score - a.score);
        if (propertyMoves[0] && tryPlay(() => this.playProperty(bot.id, propertyMoves[0].card.id, propertyMoves[0].color))) return true;

        if (this.difficulty !== 'easy') {
            const rentMoves = bot.hand.filter((card) => card.type === 'rent').flatMap((card) => playableColors(card).map((color) => ({
                card, color, amount: rentFor(bot.sets.find((set) => set.color === color) ?? { color, cards: [], buildings: [] }),
            }))).filter((move) => move.amount > 0).sort((a, b) => b.amount - a.amount);
            const rentMove = rentMoves[0];
            if (rentMove) {
                const target = [...this.opponents(bot)].sort((a, b) => assetTotal(b) - assetTotal(a))[0];
                const double = this.difficulty === 'hard' && rentMove.amount >= 3
                    ? bot.hand.find((card) => card.action === 'double_rent') : undefined;
                if (tryPlay(() => this.playAction(bot.id, {
                    type: 'play_action', player_id: bot.id, card_id: rentMove.card.id, color: rentMove.color,
                    target_player_id: target?.id, double_card_ids: double && this.playsLeft >= 2 ? [double.id] : [],
                }))) return true;
            }

            const steal = action('sly_deal');
            const victim = this.opponents(bot).flatMap((player) => player.sets.filter((set) => !complete(set))
                .flatMap((set) => set.cards.map((card) => ({ player, card, set })))).sort((a, b) => b.card.value - a.card.value)[0];
            if (steal && victim && tryPlay(() => this.playAction(bot.id, {
                type: 'play_action', player_id: bot.id, card_id: steal.id,
                target_player_id: victim.player.id, target_card_id: victim.card.id,
            }))) return true;

            const collector = action('debt_collector');
            const rich = [...this.opponents(bot)].sort((a, b) => assetTotal(b) - assetTotal(a))[0];
            if (collector && rich && assetTotal(rich) > 0 && tryPlay(() => this.playAction(bot.id, {
                type: 'play_action', player_id: bot.id, card_id: collector.id, target_player_id: rich.id,
            }))) return true;
            const birthday = action('birthday');
            if (birthday && this.opponents(bot).some((player) => assetTotal(player) > 0)
                && tryPlay(() => this.playAction(bot.id, { type: 'play_action', player_id: bot.id, card_id: birthday.id }))) return true;
        }

        for (const type of ['house', 'hotel'] as const) {
            const building = action(type);
            const set = bot.sets.find((candidate) => complete(candidate) && candidate.color !== 'railroad' && candidate.color !== 'utility');
            if (building && set && tryPlay(() => this.playAction(bot.id, {
                type: 'play_action', player_id: bot.id, card_id: building.id, color: set.color,
            }))) return true;
        }
        const passGo = action('pass_go');
        if (passGo && bot.hand.length <= HAND_LIMIT && tryPlay(() => this.playAction(bot.id, {
            type: 'play_action', player_id: bot.id, card_id: passGo.id,
        }))) return true;
        const bankable = bot.hand.filter((card) => !isProperty(card) && card.action !== 'just_say_no')
            .sort((a, b) => b.value - a.value)[0];
        return Boolean(bankable && tryPlay(() => this.playBank(bot.id, bankable.id)));
    }

    view(): RoomView {
        const playerViews: PlayerView[] = this.players.map((player) => ({
            id: player.id,
            name: player.name,
            connected: true,
            bot: player.bot,
            hand_count: player.hand.length,
            ...(player.id === this.playerId ? { hand: player.hand.map((card) => ({ ...card })) } : {}),
            bank: player.bank.map((card) => ({ ...card })),
            bank_total: bankTotal(player),
            sets: player.sets.map((set): SetView => ({
                color: set.color,
                cards: set.cards.map((card) => ({ ...card })),
                buildings: set.buildings.map((card) => ({ ...card })),
                size: setSize(set.color),
                complete: complete(set),
                rent: rentFor(set),
            })),
            complete_sets: completeSets(player),
            asset_total: assetTotal(player),
            has_just_say_no: player.id === this.playerId && this.hasJSN(player),
        }));
        const radio: RadioState = { name: '', url: '', playing: false };
        return {
            id: this.id,
            name: this.roomName,
            private: true,
            invite_code: this.id,
            owner_id: this.playerId,
            owner_name: this.playerName,
            is_owner: true,
            you: this.playerId,
            you_seated: true,
            you_requested: false,
            spectators: [],
            requests: [],
            seats_free: Math.max(0, MAX_PLAYERS - this.players.length),
            modes: [
                { id: 'classic', label: 'Classic', blurb: '', available: true },
                { id: 'deathmatch', label: 'Death Match', blurb: '', available: true },
                { id: 'golden_rush', label: 'Golden Rush', blurb: '', available: false },
            ],
            turn_options: [0, 30, 60, 120],
            respond_options: [0, 10, 15, 30],
            difficulties: ['easy', 'normal', 'hard'],
            radio,
            chat: this.chat.map((message) => ({ ...message })),
            game: {
                id: this.id,
                you: this.playerId,
                players: playerViews,
                deck_count: this.deck.length,
                discard_count: this.discard.length,
                discard_top: this.discard.length ? { ...this.discard[this.discard.length - 1] } : null,
                current_turn: this.currentTurn,
                state: this.state,
                winner_id: this.winnerId,
                plays_left: this.playsLeft,
                pending: this.pending ? JSON.parse(JSON.stringify(this.pending, (key, value) => key === 'extra' ? undefined : value)) : null,
                log: this.log.map((entry) => ({ ...entry, args: entry.args ? { ...entry.args } : undefined })),
                set_sizes: Object.fromEntries(COLORS.map((color) => [color, setSize(color)])),
                colors: COLORS,
                mode: this.mode,
                mode_label: modeLabel(this.mode),
                turn_seconds: 0,
                respond_seconds: 0,
                bot_difficulty: this.difficulty,
                deadline_ms: 0,
                deadline_kind: '',
                deadline_seconds: 0,
                now_ms: Date.now(),
                start_sequence: this.players.map((player) => player.id),
                start_id: `${this.id}-start-${this.startNumber}`,
            },
        };
    }
}
