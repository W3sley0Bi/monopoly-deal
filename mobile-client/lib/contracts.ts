/**
 * THE prop contract for every shared component. Every other agent builds in
 * parallel against this file and must never read another agent's source —
 * a missing prop here becomes a compile error in three agents at once.
 *
 * Types only, plus the tiny shared enums components need. No implementation.
 * Sources: TABLE-SPEC.md §2–§5 (interactions, dialogs, pending flow, drag
 * model), DESIGN-TOKENS.md §2.7 (pick rings), SHELL-SPEC.md §7 (audio).
 */
import type { ReactNode } from 'react';
import type { Card, Color, GameView, Pending, PlayerView, SetView, Target } from '../src/types';
import type { CardSizeKey } from './theme';

export type { CardSizeKey };

// =====================================================================
// Shared enums
// =====================================================================

/** Pick-ring tint: `take` = amber "you get" (`status.take` #63ea89 — wait,
 *  see note), `give` = green "you give". Colours live in `lib/theme.ts`
 *  `status.take` / `status.give`; this type only names the choice. */
export type PickTone = 'take' | 'give' | null;

/** Own-property density, driven by set count (§1 TABLE-SPEC / DESIGN-TOKENS
 *  §2.2): `normal` (≤4 sets), `dense` (>4), `tight` (>6). */
export type Density = 'normal' | 'dense' | 'tight';

/** What a card is being dragged from, per TABLE-SPEC §5's draggable list. */
export type DragFrom = 'hand' | 'board';

/** The 13 named SFX cues, per SHELL-SPEC.md §7's cue table. */
export type SoundCue =
    | 'tap'
    | 'card_draw'
    | 'card_play'
    | 'bank'
    | 'turn'
    | 'action'
    | 'strike'
    | 'threat'
    | 'payment'
    | 'shuffle'
    | 'spin'
    | 'error'
    | 'win';

export interface UseGameAudio {
    /** Plays a cue immediately — used for the `tap` cue, before the server
     *  answers, to kill perceived latency. */
    play: (cue: SoundCue) => void;
    sfxEnabled: boolean;
    setSfxEnabled: (on: boolean) => void;
    sfxVolume: number;
    setSfxVolume: (v: number) => void;
    radioEnabled: boolean;
    setRadioEnabled: (on: boolean) => void;
    radioVolume: number;
    setRadioVolume: (v: number) => void;
    /** Station name, or null when nothing is tuned. */
    radioStationName: string | null;
    /** Who tuned the current station (`by_name`), for `audio.tuned_by`. */
    radioByName: string | null;
    radioLoading: boolean;
    /** A rejected `play()` — native has no autoplay policy, so this stays
     *  false, kept only so `<GameAudioControls>` has one shape on every
     *  platform. */
    radioBlocked: boolean;
    radioFailed: boolean;
    /** Always true on native — there is no gesture-gate to unlock audio. */
    unlocked: true;
}

// =====================================================================
// CardProps / CardBackProps
// =====================================================================

export interface CardProps {
    card: Card;
    size: CardSizeKey;
    /** Overrides the colour a two-colour wildcard renders as, once the
     *  player has tapped to choose (`wildColor` in the web app). Ignored
     *  for single-colour cards. */
    activeColor?: Color | null;
    selected?: boolean;
    /** Rendered at reduced opacity — e.g. an ineligible drop-zone card, or
     *  a card mid-flight elsewhere (TableMotion `placed`/`sent`). */
    dimmed?: boolean;
    faceDown?: boolean;
    onPress?: () => void;
    onLongPress?: () => void;
    /** Stable id handed to the drag layer's `begin()` — see
     *  `useDragLayer` below. Omit for a non-draggable card. */
    dragId?: string;
    /** Ring tint while this card is a pickable choice in a dialog or the
     *  pending panel (§3/§4 TABLE-SPEC). `null` = no ring. */
    pickTone?: PickTone;
    /** True while `sent`/`inFlight` (§6/§7 TABLE-SPEC) or genuinely
     *  non-interactive (opponent card, building, discard pile). */
    disabled?: boolean;
}

export interface CardBackProps {
    /** Border/radius scale — the source varies by context (seat fan vs.
     *  active-hand pile vs. hero); pass the literal geometry rather than a
     *  size key since card backs don't carry the face's internal layout. */
    width: number;
    height: number;
    borderWidth: number;
    radius: number;
    /** Fan rotation, degrees — active-board hand piles rotate each back by
     *  `i * 7deg` on expand (DESIGN-TOKENS §6.1 2c). */
    rotateDeg?: number;
    style?: object;
}

// =====================================================================
// PropertySets
// =====================================================================

export interface PropertySetsProps {
    sets: SetView[];
    size: CardSizeKey;
    /** Card tap — used for tap-tray moves, and for picking a card inside a
     *  dialog (sly deal / forced deal / deal breaker's `SetPicker`). */
    onCardPress?: (card: Card, set: SetView) => void;
    /** Restricts which card ids are actually pickable — TABLE-SPEC §3's
     *  `stealableCards`. Omit to make every card inert (read-only display,
     *  e.g. an opponent's board shown outside a targeting dialog). */
    enabledIds?: ReadonlySet<string>;
    /** Cards currently chosen — ringed per `pickTone`. */
    selectedIds?: ReadonlySet<string>;
    pickTone?: PickTone;
    density?: Density;
    /** While a card is being carried and a colour has been resolved, the one
     *  stack that would receive it lights as `property-set-live`
     *  (DESIGN-TOKENS §6.1 3b / TABLE-SPEC §5). `null` = none lit. */
    liveColor?: Color | null;
}

// =====================================================================
// Drag layer
// =====================================================================

/** What is currently being carried, or null. Mirrors `dragLayer.tsx`'s
 *  `PendingMove`-adjacent drag state, ported to a gesture-driven registry
 *  per TABLE-SPEC §5's native redesign notes. */
export interface DragState {
    card: Card;
    from: DragFrom;
    /** The stack colour a board-wildcard drag started from — undefined for
     *  a hand drag. */
    fromColor?: Color;
}

export interface UseDragLayer {
    dragging: boolean;
    card: Card | null;
    from: DragFrom | null;
    /** Called by a draggable `<Card>` on `begin()` (pointerdown past the
     *  threshold) — see TABLE-SPEC §5 for the axis rules (`vertical` on
     *  narrow hand drags, `free` for board wildcards and desktop). */
    begin: (state: DragState) => void;
    /** Pointer released with no committed drop, or Escape/pointercancel —
     *  triggers the 260ms snap-back + fade. */
    cancel: () => void;
}

/** A `<DropZone>` registers itself with the drag layer instead of listening
 *  for native drag events (there are none on a phone) — TABLE-SPEC §5.
 *  `registerZone` is the layer-side half of that contract: each zone reports
 *  its measured rect and receives hit-tests against it every frame the
 *  layer is dragging. */
export interface RegisterZoneOptions {
    id: string;
    /** Whether this zone can currently accept the card being carried —
     *  computed by the caller (`dropTargets()` / `moveColors()` in
     *  TABLE-SPEC §5), not by the zone itself. */
    active: boolean;
    /** Fires once, when a drop lands inside this zone while `active`. */
    onDrop: (card: Card) => void;
}

export interface DropZoneProps {
    id: string;
    /** Lit as a legal target for the card currently being carried. */
    active: boolean;
    onDrop: (card: Card) => void;
    /** Centred hint text while active/over (`table.bank_drop`, `table.play_it`,
     *  a colour's short name). */
    hint?: string;
    children?: ReactNode;
    /** `:has()`'s replacement — the eligible zone grows (`flexGrow: 1.72`),
     *  the ineligible one shrinks (`0.28`), decided once when the card
     *  leaves the hand and never re-aimed mid-drag (TABLE-SPEC §1.1 3d). */
    grow?: number;
}

// =====================================================================
// Chrome: Sheet / Modal / Btn / Panel / Avatar / LabelCaps
// =====================================================================

export interface SheetProps {
    open: boolean;
    onClose: () => void;
    /** `panel.title_chat` / `panel.title_log` / etc. — pre-translated. */
    title?: string;
    /** `max-height: min(78vh, 100dvh - 5rem)` per DESIGN-TOKENS §6.1. */
    children: ReactNode;
    /** `talk` sheets show a chat/log tab pair (SHELL-SPEC §6 TalkSheet). */
    tabs?: { key: string; label: string }[];
    activeTab?: string;
    onTabChange?: (key: string) => void;
}

export interface ModalProps {
    open: boolean;
    /** Omit to disable the close affordance — e.g. a pending panel that must
     *  be resolved via its own buttons. */
    onClose?: () => void;
    /** Wider modal variant — deal breaker / sly deal / forced deal dialogs
     *  (TABLE-SPEC §3). */
    wide?: boolean;
    /** Countdown-ring slot in the corner, shown when `deadline_kind ===
     *  'respond'` (TABLE-SPEC §3/§4). */
    corner?: ReactNode;
    title?: string;
    children: ReactNode;
}

export type BtnVariant = 'gold' | 'green' | 'red' | 'blue' | 'ghost';

export interface BtnProps {
    label: string;
    onPress: () => void;
    variant?: BtnVariant;
    disabled?: boolean;
    /** Renders `…` and disables the press per TABLE-SPEC §5's Tutorial Next
     *  round-trip, and the same pattern in dialogs waiting on the server. */
    pending?: boolean;
    icon?: ReactNode;
    style?: object;
}

export interface PanelProps {
    children: ReactNode;
    style?: object;
    /** `.panel` vs. a flatter surface — see `shadow.panel` / `shadow.panelFlat`
     *  in `lib/theme.ts`. */
    flat?: boolean;
}

export interface AvatarProps {
    /** Deterministic seed — the player id. No upload. */
    id: string;
    name: string;
    size: number;
    /** Legacy-gold pulsing ring for the active turn (DESIGN-TOKENS §1.8
     *  `shadow.avatarActiveRing`). */
    active?: boolean;
    /** Dimmed rendering for a disconnected player. */
    dimmed?: boolean;
}

export interface LabelCapsProps {
    children: ReactNode;
    /** `.label-caps` is `10px`, `.13em` letter-spacing, `ink.muted55` by
     *  default (DESIGN-TOKENS §1.10/§7) — size lets a caller match the
     *  11.2px/`.14em` utility variant used elsewhere. */
    size?: 10 | 11.2;
    color?: string;
    style?: object;
}

// =====================================================================
// ActionDialog
// =====================================================================

/** One case of the dialog's full case list (TABLE-SPEC §3). `intent`
 *  disambiguates the two non-`play_action` cases; every other case is
 *  identified by the card itself (`card.type === 'rent'`,
 *  `card.action === 'house' | 'hotel' | ...`). */
export type ActionDialogIntent = 'property' | 'move' | 'action';

export interface ActionDialogProps {
    open: boolean;
    intent: ActionDialogIntent;
    card: Card;
    /** The set this card is moving out of — `move` intent only. */
    fromColor?: Color;
    game: GameView;
    /** The viewer's own player id. */
    you: string;
    onClose: () => void;
    /** Fires the one `play_property` / `move_wildcard` / `play_action`
     *  message the dialog resolves to. The dialog itself does not know how
     *  to send — the caller stamps identity and routes it. */
    onSubmit: (
        msg:
            | { type: 'play_property'; card_id: string; color: Color }
            | { type: 'move_wildcard'; card_id: string; color: Color }
            | {
                  type: 'play_action';
                  card_id: string;
                  color?: Color;
                  target_player_id?: string;
                  target_card_id?: string;
                  give_card_id?: string;
                  double_card_ids?: string[];
              },
    ) => void;
}

// =====================================================================
// PendingPanel
// =====================================================================

/** The viewer's relationship to `pending`, per TABLE-SPEC §4's four states —
 *  computed by the caller (`myTarget(view)` + `pending.by_id === you`) and
 *  handed in rather than recomputed inside the panel. */
export type PendingViewerRole = 'bystander' | 'payer' | 'target' | 'blocked_instigator';

export interface PendingPanelProps {
    pending: Pending;
    role: PendingViewerRole;
    /** The viewer's own unsettled `Target` entry — undefined for a
     *  bystander. */
    myTarget: Target | null;
    /** Every asset the payer can offer, pre-split by source pile so the
     *  panel can label each (`pending.ui.from_bank` vs. a set/colour) —
     *  `payer` role only. */
    payableCards?: { card: Card; source: 'bank' | Color }[];
    /** The stakes to render as `give`/`take` chips — a card or whole set
     *  moving, per the pending's kind. */
    stakeGive?: Card | SetView | null;
    stakeTake?: Card | SetView | null;
    you: string;
    /** For the corner countdown ring, when `deadline_kind === 'respond'`. */
    deadlineMs?: number;
    skewMs: number;
    onClose?: () => void;
    onRespond: (msg: { say_no?: boolean; card_ids?: string[] }) => void;
}

// =====================================================================
// Tutorial
// =====================================================================

export interface TutorialHint {
    anchor?: string;
    anchorNarrow?: string;
    targets?: string;
    targetCount?: number;
    gesture?: 'drag' | 'tap';
    gestureNarrow?: 'drag' | 'tap';
}

export interface TutorialProps {
    /** `room.game.tutorial` — null hides the coach entirely. */
    tutorial: { step: number; total: number; id: string; task: boolean; done: boolean } | null;
    /** Read-only steps allow no interaction either — `locked` is computed by
     *  the caller from `!compact && !(task && done)` and handed in so the
     *  component doesn't need the rest of the table's state. */
    locked: boolean;
    /** A dialog/payment panel owns the screen — the coach returns null. */
    compact: boolean;
    /** A card is in the air — the coach also returns null. */
    carrying: boolean;
    /** A colour tray is open — same. */
    paused: boolean;
    onNext: () => void;
    onSkip: () => void;
    pendingNext: boolean;
}

// =====================================================================
// TalkSheet
// =====================================================================

export interface TalkSheetProps {
    open: boolean;
    onClose: () => void;
    initialTab?: 'chat' | 'log';
    chat: { id: string; playerId: string; name: string; text: string; atMs: number; system: boolean }[];
    log: { key: string; text: string }[];
    you: string;
    onSend: (text: string) => void;
    unreadCount: number;
}

// =====================================================================
// StartWheel
// =====================================================================

export interface StartWheelProps {
    /** Player ids in randomised seat order. */
    startSequence: string[];
    /** Animate once per new id. */
    startId: string;
    /** Unix ms; `StartRevealDelay = 4500`ms before this moment. */
    startsAtMs: number;
    players: PlayerView[];
    skewMs: number;
    onDone: () => void;
}

// =====================================================================
// WinOverlay
// =====================================================================

export interface WinOverlayProps {
    winnerId: string | null;
    players: PlayerView[];
    you: string;
    /** Only the owner sees "Play again". */
    isOwner: boolean;
    mode: GameView['mode'];
    onPlayAgain: () => void;
    onLeave: () => void;
}

// =====================================================================
// PlayerChip / ActiveBoard / FeltCards
// =====================================================================

export interface PlayerChipProps {
    player: PlayerView;
    /** Highlighted as the current turn. */
    isTurn: boolean;
    /** An unsettled pending target names this seat. */
    isTargeted: boolean;
    isOwner: boolean;
    isYou: boolean;
    /** Their last log line, translated — suppressed while a reaction bubble
     *  shows (usePlayBubbles / Reactions, SHELL-SPEC §6). */
    playBubbleText?: string | null;
    /** A reaction emoji live for 5s of server time. */
    reactionEmoji?: string | null;
    onPress: () => void;
}

export interface ActiveBoardProps {
    player: PlayerView;
    /** Tap the header → opens the player sheet. */
    onPressHeader: () => void;
    /** Tap the hand pile → fans/unfans, no message. */
    handExpanded: boolean;
    onToggleHand: () => void;
    onCardPress?: (card: Card, set: SetView) => void;
}

export interface FeltPile {
    playerId: string;
    /** Unit vector placement around the table, clockwise from the viewer's
     *  own near edge (TABLE-SPEC §1.1). */
    ux: number;
    uy: number;
    /** Rotation so the pile faces its seat. */
    faceDeg: number;
    miniSets: { color: Color; complete: boolean }[];
    bankCount: number;
}

export interface FeltCardsProps {
    piles: FeltPile[];
    /** Non-interactive + `aria-hidden` on phone. */
    interactive: boolean;
}
