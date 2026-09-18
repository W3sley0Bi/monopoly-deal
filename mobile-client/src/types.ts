/**
 * Wire protocol types — literal to `backend/server/{messages,hub,room,errors}.go`
 * and `backend/game/{card,fault}.go`. Do not invent fields; see PROTOCOL.md.
 */

// ---- enums --------------------------------------------------------------

export type GameState = 'waiting' | 'playing' | 'finished';
export type Mode = 'classic' | 'deathmatch' | 'tutorial' | 'golden_rush';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type CardType = 'property' | 'property_wildcard' | 'money' | 'action' | 'rent';
export type ActionType =
    | 'pass_go' | 'deal_breaker' | 'sly_deal' | 'forced_deal' | 'debt_collector'
    | 'birthday' | 'house' | 'hotel' | 'just_say_no' | 'double_rent';
export type Color =
    | 'brown' | 'lightblue' | 'pink' | 'orange' | 'red'
    | 'yellow' | 'green' | 'blue' | 'railroad' | 'utility' | 'all';
export type PendingKind = 'payment' | 'sly_deal' | 'forced_deal' | 'deal_breaker';
export type DeadlineKind = '' | 'turn' | 'respond' | 'starting';

// ---- card -----------------------------------------------------------------

export interface Card {
    /** Unique per deck instance, e.g. "c17". */
    id: string;
    /** Translation key for the card's name; `name` is the English fallback. */
    key: string;
    type: CardType;
    name: string;
    /** Bank value in $M. */
    value: number;
    colors?: Color[];
    action?: ActionType;
}

// ---- property set -----------------------------------------------------------

export interface SetView {
    color: Color;
    /** Never null on the wire. */
    cards: Card[];
    /** House/hotel cards. Never null on the wire. */
    buildings: Card[];
    /** Cards needed to complete this colour. */
    size: number;
    complete: boolean;
    /** Current rent including house/hotel bonus. */
    rent: number;
}

// ---- pending ----------------------------------------------------------------

export interface Target {
    player_id: string;
    /** $M owed; 0 for steal pendings. */
    amount: number;
    /** Player id who must act next. */
    responder: string;
    /** Unix ms, per-target. */
    deadline_ms?: number;
    /** Toggles with every Just Say No. */
    cancelled: boolean;
    settled: boolean;
    /** e.g. "blocked". */
    note?: string;
}

export interface Pending {
    kind: PendingKind;
    action: ActionType;
    /** The card that created it. */
    card: Card;
    /** Instigator player id. */
    by_id: string;
    label_key: string;
    label_args?: Record<string, unknown>;
    /** May be null on the wire. */
    targets: Target[] | null;
    target_player_id?: string;
    target_card_id?: string;
    target_color?: Color;
    give_card_id?: string;
}

// ---- log ----------------------------------------------------------------------

/** One line of the table log: a key plus the values that fill it in. There is
 *  no English text on the wire at all — the client owns every string. */
export interface LogEntry {
    key: string;
    args?: Record<string, unknown>;
}

// ---- tutorial -------------------------------------------------------------------

/** The lesson a scripted tutorial table is teaching. */
export interface TutorialState {
    /** 1-based, for "4 of 15". */
    step: number;
    total: number;
    /** Names the lesson; the client keys its copy and its hints off this. */
    id: string;
    /** The lesson asks for a move rather than a read. */
    task: boolean;
    /** The move has been made and the table is waiting to go on. */
    done: boolean;
}

// ---- player -------------------------------------------------------------------

export interface PlayerView {
    id: string;
    name: string;
    connected: boolean;
    /** A seat the server plays itself. */
    bot: boolean;
    hand_count: number;
    /** Present only for the player receiving the view. */
    hand?: Card[];
    /** Never null on the wire. */
    bank: Card[];
    bank_total: number;
    /** Never null on the wire. */
    sets: SetView[];
    complete_sets: number;
    asset_total: number;
    /** Only ever true for you. */
    has_just_say_no: boolean;
}

// ---- game -----------------------------------------------------------------------

export interface GameView {
    /** Same as the room code. */
    id: string;
    /** "" for spectators. */
    you: string;
    /** Never null on the wire. */
    players: PlayerView[];
    deck_count: number;
    discard_count: number;
    /** NOT omitempty on the wire — null when the discard pile is empty. */
    discard_top: Card | null;
    /** Index into `players`. */
    current_turn: number;
    state: GameState;
    winner_id?: string;
    /** Of `PlaysPerTurn = 3`. */
    plays_left: number;
    /** NOT omitempty on the wire. */
    pending: Pending | null;
    /** Never null; last 60 entries. */
    log: LogEntry[];
    /** color -> cards needed. */
    set_sizes: Record<string, number>;
    /** `AllColors`, in UI play order. */
    colors: Color[];
    mode: Mode;
    /** English label. */
    mode_label: string;
    /** 0 = no limit. */
    turn_seconds: number;
    /** 0 = no limit. */
    respond_seconds: number;
    /** Present only on a scripted tutorial table. */
    tutorial?: TutorialState;
    bot_difficulty: Difficulty;
    /** Unix ms; 0 = none. When `deadline_kind === 'respond'` and you are
     *  seated, this is overwritten with your own target deadline, so each
     *  player sees their own countdown. */
    deadline_ms: number;
    deadline_kind?: DeadlineKind;
    /** Length of the current countdown window, for the ring proportion. */
    deadline_seconds: number;
    /** Server clock, for skew correction — never compare against the local
     *  clock directly. */
    now_ms: number;
    /** Player ids from the chosen starter, then clockwise around the table. */
    start_sequence?: string[];
    /** Animate the seat-order wheel once per new id. */
    start_id?: string;
    /** Unix ms; `StartRevealDelay = 4500ms` before this moment. */
    starts_at_ms?: number;
}

// ---- room -----------------------------------------------------------------------

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

export interface ChatMessage {
    /** "<ROOM>-<seq>". */
    id: string;
    player_id: string;
    name: string;
    /** Player lines only. */
    text?: string;
    /** System lines only. */
    key?: string;
    args?: Record<string, unknown>;
    /** Unix ms. */
    at_ms: number;
    system?: boolean;
}

export interface RoomView {
    id: string;
    name: string;
    private: boolean;
    /** == id. */
    invite_code: string;
    owner_id: string;
    /** "—" if unknown. */
    owner_name: string;
    is_owner: boolean;
    you: string;
    you_seated: boolean;
    you_requested: boolean;
    /** Sorted by id. */
    spectators: Seat[];
    /** Queue order. Never null. */
    requests: Seat[];
    seats_free: number;
    modes: ModeInfo[];
    /** [0, 30, 60, 120]. */
    turn_options: number[];
    /** [0, 10, 15, 30]. */
    respond_options: number[];
    /** ["easy", "normal", "hard"]. */
    difficulties: Difficulty[];
    game: GameView;
    radio: RadioState;
    /** Newest last, max 120. */
    chat: ChatMessage[];
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
    seats_free: number;
    you_seated: boolean;
    you_spectating: boolean;
    you_requested: boolean;
    /** Zero live connections. */
    abandoned: boolean;
    /** Owner, or abandoned. */
    you_may_close: boolean;
}

export interface HomeView {
    you: string;
    name: string;
    /** Public (non-private) rooms only. */
    rooms: RoomSummary[];
    modes: ModeInfo[];
    turn_options: number[];
    respond_options: number[];
    difficulties: Difficulty[];
    /** == 5. */
    max_players: number;
    /** Absent from servers that predate the version check. */
    protocol_version?: number;
}

// ---- client -> server -------------------------------------------------------------

export type ClientMsgType =
    | 'hello' | 'create_room' | 'join_room' | 'leave_room' | 'close_room'
    | 'set_options' | 'set_radio' | 'start_game' | 'new_game' | 'terminate_game'
    | 'kick' | 'take_seat' | 'request_seat' | 'cancel_seat' | 'add_bot' | 'remove_bot'
    | 'chat'
    | 'play_bank' | 'play_property' | 'play_action' | 'move_wildcard'
    | 'end_turn' | 'respond' | 'tutorial_next';

/** One envelope for everything sent to the server. `player_id` has no
 *  `omitempty` on the Go side — always send it, even though it is typed
 *  optional here to let call sites build a message before stamping identity. */
export interface ClientMessage {
    type: ClientMsgType;
    player_id: string;
    player_name?: string;
    /** Stamped on every frame; the server refuses a mismatch. */
    protocol_version?: number;

    room_id?: string;
    room_name?: string;
    private?: boolean;
    mode?: Mode;
    turn_seconds?: number;
    /** `*int` on the Go side because 0 ("no limit") must be distinguishable
     *  from absent: omit the key to leave unchanged, send 0 for unlimited. */
    respond_seconds?: number | null;
    as_spectator?: boolean;
    /** Robot seats to fill when opening a table. */
    bots?: number;
    /** Deal the cards as soon as the table opens, for solo play. */
    auto_start?: boolean;
    bot_difficulty?: Difficulty;

    card_id?: string;
    color?: Color;
    target_player_id?: string;
    target_card_id?: string;
    give_card_id?: string;
    double_card_ids?: string[];
    say_no?: boolean;
    card_ids?: string[];

    /** Station for `set_radio`; a null/empty url switches the radio off. */
    radio?: RadioState | null;
    text?: string;
}

// ---- server -> client -------------------------------------------------------------

export type ServerMessage =
    /** Sent to every client not in a room. */
    | { type: 'home'; payload: HomeView }
    /** Sent to every client in a room, rendered from that client's own
     *  `player_id` — hands are hidden from everyone else. */
    | { type: 'room'; payload: RoomView }
    /** Sent only to the offending client, never broadcast. */
    | { type: 'error'; error: string; error_key?: string; error_args?: Record<string, unknown> }
    /** Currently only from `close_room`. */
    | { type: 'notice'; notice: string; notice_key?: string; notice_args?: Record<string, unknown> };
