export type CardType = 'property' | 'property_wildcard' | 'money' | 'action' | 'rent';

export type ActionType =
    | 'pass_go' | 'deal_breaker' | 'sly_deal' | 'forced_deal' | 'debt_collector'
    | 'birthday' | 'house' | 'hotel' | 'just_say_no' | 'double_rent';

export type Color =
    | 'brown' | 'lightblue' | 'pink' | 'orange' | 'red'
    | 'yellow' | 'green' | 'blue' | 'railroad' | 'utility' | 'all';

export type GameState = 'waiting' | 'playing' | 'finished';
export type Mode = 'classic' | 'deathmatch' | 'golden_rush';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type PendingKind = 'payment' | 'sly_deal' | 'forced_deal' | 'deal_breaker';

export interface Card {
    id: string;
    /** Translation key for the card's name; `name` is the English fallback. */
    key: string;
    type: CardType;
    name: string;
    value: number;
    colors?: Color[];
    action?: ActionType;
}

export interface SetView {
    color: Color;
    cards: Card[];
    buildings: Card[];
    size: number;
    complete: boolean;
    rent: number;
}

export interface PlayerView {
    id: string;
    name: string;
    connected: boolean;
    /** A seat the server plays itself. */
    bot: boolean;
    hand_count: number;
    /** Only present for the player receiving the view. */
    hand?: Card[];
    bank: Card[];
    bank_total: number;
    sets: SetView[];
    complete_sets: number;
    asset_total: number;
    has_just_say_no: boolean;
}

export interface Target {
    player_id: string;
    amount: number;
    responder: string;
    cancelled: boolean;
    settled: boolean;
    note?: string;
}

export interface Pending {
    kind: PendingKind;
    action: ActionType;
    card: Card;
    by_id: string;
    /** Translation key naming the action, with the values that fill it in. */
    label_key: string;
    label_args?: Record<string, unknown>;
    targets: Target[];
    target_player_id?: string;
    target_card_id?: string;
    target_color?: Color;
    give_card_id?: string;
}

export interface GameView {
    /** Shared reveal window before the first turn begins. */
    start_id?: string;
    starts_at_ms?: number;
    start_sequence?: string[];
    id: string;
    you: string;
    players: PlayerView[];
    deck_count: number;
    discard_count: number;
    discard_top: Card | null;
    current_turn: number;
    state: GameState;
    winner_id?: string;
    plays_left: number;
    pending: Pending | null;
    log: LogEntry[];
    set_sizes: Record<string, number>;
    colors: Color[];
    mode: Mode;
    mode_label: string;
    turn_seconds: number;
    bot_difficulty: Difficulty;
    /** Unix ms when the turn or response expires; 0 means no limit. */
    deadline_ms: number;
    deadline_kind?: 'turn' | 'respond' | 'starting';
    /** Length of the current countdown window, for the ring proportion. */
    deadline_seconds: number;
    /** Server clock, used to correct countdown drift. */
    now_ms: number;
}

/** One line of the table log: a key plus the values that fill it in. */
export interface LogEntry {
    key: string;
    args?: Record<string, unknown>;
}

export interface Seat {
    id: string;
    name: string;
}

export interface ModeInfo {
    id: Mode;
    label: string;
    blurb: string;
    available: boolean;
}

export interface ChatMessage {
    id: string;
    player_id: string;
    name: string;
    /** Player messages carry text; server lines carry a key and its values. */
    text?: string;
    key?: string;
    args?: Record<string, unknown>;
    at_ms: number;
    /** Server-generated line rather than a player message. */
    system?: boolean;
}

/** One relayed WebRTC payload. */
export interface RTCEnvelope {
    from: string;
    signal: RTCSignal;
}

export type RTCSignal =
    | { kind: 'media'; micOn: boolean; camOn: boolean }
    | { kind: 'offer' | 'answer'; sdp: RTCSessionDescriptionInit }
    | { kind: 'candidate'; candidate: RTCIceCandidateInit };

/** The table's shared station. The owner tunes it; everyone plays it locally. */
export interface RadioState {
    name: string;
    url: string;
    home?: string;
    playing: boolean;
    /** Who tuned it. */
    by_name?: string;
    at_ms?: number;
}

export interface RoomView {
    private: boolean;
    id: string;
    name: string;
    owner_id: string;
    owner_name: string;
    is_owner: boolean;
    you: string;
    you_seated: boolean;
    you_requested: boolean;
    spectators: Seat[];
    requests: Seat[];
    seats_free: number;
    modes: ModeInfo[];
    turn_options: number[];
    difficulties: Difficulty[];
    game: GameView;
    radio: RadioState;
    chat: ChatMessage[];
    /** Player ids currently in the voice/video call. */
    call_members: string[];
}

export interface RoomSummary {
    id: string;
    name: string;
    owner_name: string;
    mode: Mode;
    mode_label: string;
    turn_seconds: number;
    bot_difficulty: Difficulty;
    state: GameState;
    players: Seat[];
    spectator_count: number;
    bot_count: number;
    call_count: number;
    seats_free: number;
    you_seated: boolean;
    you_spectating: boolean;
    you_requested: boolean;
    /** Nobody is connected to this table. */
    abandoned: boolean;
    /** You may close it: you are the host, or it is abandoned. */
    you_may_close: boolean;
}

export interface HomeView {
    you: string;
    name: string;
    rooms: RoomSummary[];
    modes: ModeInfo[];
    turn_options: number[];
    difficulties: Difficulty[];
    max_players: number;
}

/** Every message the client can send. */
export interface ClientMessage {
    type:
        | 'hello' | 'create_room' | 'join_room' | 'leave_room' | 'close_room'
        | 'set_options' | 'start_game' | 'new_game' | 'terminate_game'
        | 'kick' | 'take_seat' | 'request_seat' | 'cancel_seat' | 'chat'
        | 'add_bot' | 'remove_bot' | 'set_radio'
        | 'rtc_join' | 'rtc_leave' | 'rtc_signal'
        | 'play_bank' | 'play_property' | 'play_action' | 'move_wildcard'
        | 'discard' | 'end_turn' | 'respond';
    player_id?: string;
    player_name?: string;
    room_id?: string;
    room_name?: string;
    private?: boolean;
    mode?: Mode;
    turn_seconds?: number;
    as_spectator?: boolean;
    bot_difficulty?: Difficulty;
    /** Robot seats to fill when opening a table. */
    bots?: number;
    /** Deal the cards as soon as the table opens, for solo play. */
    auto_start?: boolean;
    card_id?: string;
    color?: Color;
    target_player_id?: string;
    target_card_id?: string;
    give_card_id?: string;
    double_card_ids?: string[];
    say_no?: boolean;
    card_ids?: string[];
    text?: string;
    /** Station for `set_radio`; an empty url switches the radio off. */
    radio?: Pick<RadioState, 'name' | 'url' | 'home' | 'playing'>;
    signal?: RTCSignal;
}

export type ServerMessage =
    | { type: 'home'; payload: HomeView }
    | { type: 'room'; payload: RoomView }
    | { type: 'rtc_signal'; payload: RTCEnvelope }
    | { type: 'error'; error: string; error_key?: string; error_args?: Record<string, unknown> }
    | { type: 'notice'; notice: string; notice_key?: string; notice_args?: Record<string, unknown> };
