import type { GameAudio } from '../game/useGameAudio';
import GameAudioControls from './GameAudioControls';
import RoomInvite from './RoomInvite';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Card, ClientMessage, Color, PlayerView, RoomView } from '../types';
import { NARROW, PORTRAIT, useMediaQuery } from '../game/useMediaQuery';
import { DragProvider } from '../game/dragLayer';
import { applyOptimistic, moveSettled, type PendingMove } from '../game/optimistic';
import { usePlayBubbles } from '../game/usePlayBubbles';
import {
    colorMeta, dropTargets, isPlayableAction, needsTargeting, playableColors,
} from '../game/meta';
import { useI18n } from '../i18n';
import { formatTurn, money } from '../i18n/format';
import HoverDetails from './HoverDetails';
import GameBrand, { Cityscape } from './GameBrand';
import Reactions, { PlayBubble, ReactionBubble } from './Reactions';
import DiscardBurst from './DiscardBurst';
import { REACTIONS } from '../game/reactions';
import TableMotion from './TableMotion';
import LanguagePicker from './LanguagePicker';
import ActionDialog from './ActionDialog';
import ActiveBoard from './ActiveBoard';
import Avatar from './Avatar';
import DropZone from './DropZone';
import FeltCards from './FeltCards';
import OpponentPanel from './OpponentPanel';
import PendingPanel from './PendingPanel';
import PlayerBoard from './PlayerBoard';
import PlayerChip from './PlayerChip';
import PlayingCard, { CardBack } from './PlayingCard';
import PropertySets from './PropertySets';
import Sheet from './Sheet';
import SidePanel from './SidePanel';
import TalkSheet from './TalkSheet';
import Tutorial from './Tutorial';
import TurnBanner from './TurnBanner';
import TurnTimer from './TurnTimer';
import TutorialDone from './TutorialDone';
import WinOverlay from './WinOverlay';

interface Props {
    audio: GameAudio;
    room: RoomView;
    error?: string;
    /** Server clock minus browser clock, in ms. */
    skewMs: number;
    /** The guided tour is running. */
    tutorial: boolean;
    onTutorial: (on: boolean) => void;
    send: (msg: ClientMessage) => void;
    onLeave: () => void;
}

// Where each panel slot sits on a wide table. `.seats-N .opponent-seat:nth-child()`
// in the stylesheet does not run round the table — it fills the top of the
// arena first and the sides after — while the felt does, clockwise from
// your own edge. SEAT_SLOTS[n][slot] is the seat, counted the felt's way, that
// belongs in that slot, so a rival's panel sits over their own cards.
const SEAT_SLOTS: Record<number, number[]> = {
    3: [1, 0, 2],
    4: [1, 2, 0, 3],
    5: [2, 1, 3, 0, 4],
};

// A turn with no plays left has nothing else to give, so it closes itself
// after a short beat. Long enough to read the table, short enough to keep the
// game moving.
const AUTO_END_MS = 2500;

/** Where the player's own hand sits on a wide screen. */
const HAND_POSITIONS = ['bottom', 'left', 'right'] as const;
type HandPos = (typeof HAND_POSITIONS)[number];

type Dialog = { card: Card; intent: 'property' | 'action' | 'move' };
type Drag = { card: Card; from: 'hand' | 'board' };
type SheetState =
    | { kind: 'player'; player: PlayerView }
    | { kind: 'bank' }
    | { kind: 'talk' }
    | null;

export default function Table({ audio, room, error, skewMs, tutorial, onTutorial, send, onLeave }: Props) {
    const { t, tCard, tLog } = useI18n();

    // A move whose result only depends on cards already on screen — placing a
    // property, moving a wildcard, banking, discarding — is drawn right away
    // rather than waiting on the round trip that confirms it. `effectiveRoom`
    // is what every read below sees; `room` itself never changes underneath.
    const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
    useEffect(() => {
        if (pendingMove && moveSettled(room, pendingMove)) setPendingMove(null);
    }, [room, pendingMove]);
    useEffect(() => {
        if (!pendingMove) return undefined;
        // A move the server refused never satisfies moveSettled, so this is
        // what lets the guess retire and the real (unchanged) state show
        // through instead of holding a prediction that never came true.
        const timer = window.setTimeout(() => setPendingMove(null), 4000);
        return () => window.clearTimeout(timer);
    }, [pendingMove]);
    const effectiveRoom = pendingMove ? applyOptimistic(room, pendingMove) : room;

    const g = effectiveRoom.game;
    const me = g.players.find(p => p.id === g.you);
    const spectating = !room.you_seated || !me;
    const narrow = useMediaQuery(NARROW);
    const portrait = useMediaQuery(PORTRAIT);
    // The log already records every move; this lifts the newest one back onto
    // the player who made it, where you would hear it at a real table.
    const plays = usePlayBubbles(g.log);
    // Only the discard event gets a bubble over your own hand — every other
    // move already shows itself on the board you are looking at.
    const myDiscardPlay = me && plays[me.name]?.entry.key === 'log.discarded_excess' ? plays[me.name] : undefined;
    // The last thing that happened, for the phone's inline recap — never the
    // turn changing itself, since the status line right above it already
    // says whose turn this is. Without this filter the two lines repeated
    // each other the instant a turn passed. A tutorial lesson opening is
    // bookkeeping rather than a move, and reads as noise in the same place.
    const NOT_A_MOVE = new Set(['log.turn', 'log.tutorial_lesson']);
    let lastMoveIndex = -1;
    for (let i = g.log.length - 1; i >= 0; i -= 1) {
        if (!NOT_A_MOVE.has(g.log[i].key)) { lastMoveIndex = i; break; }
    }
    const lastMove = lastMoveIndex >= 0 ? g.log[lastMoveIndex] : undefined;

    const [selectedCard, setSelected] = useState<Card | null>(null);
    const selected = me?.hand?.find(card => card.id === selectedCard?.id) ?? null;
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [sheet, setSheet] = useState<SheetState>(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [boardOpen, setBoardOpen] = useState(true);
    const [motion, setMotion] = useState(() => localStorage.getItem('md.motion') !== 'off');
    // The inspection panel over a card in your own hand. It reads well the
    // first few games and then only gets in the way of the cards behind it, so
    // a player who already knows the deck can put it away. The cards in play
    // keep theirs either way: those are the ones whose set and rent you are
    // actually looking up.
    const [handPeek, setHandPeek] = useState(() => localStorage.getItem('md.handpeek') !== 'off');
    // A hand laid across the bottom of a wide screen costs the table a quarter
    // of its height for cards that are just as readable standing on end. Which
    // side suits depends on the room and the player, so it is theirs to pick.
    const [handPos, setHandPos] = useState<HandPos>(
        () => (HAND_POSITIONS.find(p => p === localStorage.getItem('md.hand')) ?? 'bottom'));
    const chooseHandPos = (pos: HandPos) => {
        localStorage.setItem('md.hand', pos);
        setHandPos(pos);
    };
    // Tapping a card opens a row of buttons. It is a panel that lands over the
    // board every time a thumb brushes a card, for a move the same thumb can
    // make by pulling the card upward, so it is off unless it is asked for.
    //
    // The one exception is the lesson that teaches it: a tutorial step about
    // tapping a card has to let the card be tapped.
    const [tapTray, setTapTray] = useState(() => localStorage.getItem('md.taptray') === 'on');
    // Off by default: a face reacting to your own discard is a lot for some
    // players, so it is something you turn on rather than have to turn off.
    const [cryReaction, setCryReaction] = useState(() => localStorage.getItem('md.cryreaction') === 'on');
    const tapOpens = tapTray || g.tutorial?.id === 'tapping';
    // Turning the tray off with a card already chosen would leave the panel on
    // screen with no way to dismiss it.
    useEffect(() => {
        if (!tapOpens) setSelected(null);
    }, [tapOpens]);

    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [chatSeen, setChatSeen] = useState(room.chat.length);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    // Closing the menu also drops the end-game confirmation: a player who walks
    // away mid-confirm should never come back to a menu that is already armed.
    const closeMenu = useCallback(() => {
        setMenuOpen(false);
        setConfirmEnd(false);
    }, []);

    // While the table is on screen the document itself is pinned: a game that
    // rubber-bands at the top, or keeps a scroll position left behind by a drag
    // that ran off the edge, reads as a web page rather than a table.
    useEffect(() => {
        document.body.classList.add('playing');
        return () => document.body.classList.remove('playing');
    }, []);

    // A dropdown that only closes by pressing its own button is a trap on a
    // touch screen, so any press outside it and the Escape key close it too.
    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Element | null;
            if (target && (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target))) return;
            // Dialogs the menu opens — the radio picker — render in a portal
            // on document.body, so they count as "outside". Tearing the menu
            // down there would unmount the dialog under the player's finger,
            // before the click it belongs to ever arrives.
            if (target?.closest?.('[role="dialog"],[data-dialog-overlay]')) return;
            closeMenu();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            // Escape belongs to the dialog on top, not to the menu behind it.
            if (document.querySelector('[role="dialog"]')) return;
            closeMenu();
        };
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [menuOpen, closeMenu]);

    // Every cue this table plays is triggered by the log, which arrives with
    // the server's answer — so between a tap and the round trip completing,
    // nothing happened at all. This is the table saying it heard you, now,
    // before the network gets a word in.
    const [sent, setSent] = useState<string | null>(null);
    useEffect(() => {
        if (!sent) return;
        // A refused play leaves the card where it was; the mark must not
        // outlive the answer either way.
        const timer = window.setTimeout(() => setSent(null), 1400);
        return () => window.clearTimeout(timer);
    }, [sent]);

    const act = (msg: ClientMessage) => {
        audio.play('tap');
        const carried = (msg as { card_id?: string }).card_id;
        setSent(carried ?? null);
        send(msg);
        setSelected(null);
        setDialog(null);
        setDrag(null);
    };

    // The card is on its way to the server. Showing it as gone from the hand
    // is the difference between a table that answers and one that thinks.
    const inFlight = sent && me?.hand?.some(c => c.id === sent) ? sent : null;

    const recentReaction = (id: string) => room.chat.findLast(m => m.player_id === id && m.text && REACTIONS.some(r => r === m.text) && g.now_ms - m.at_ms < 5000);

    const turnPlayer = g.players[g.current_turn];
    const myTurn = turnPlayer?.id === g.you && !spectating;
    const pending = g.pending;
    // Seat order, not array order: the felt lays each player's cards out going
    // round the table from your own edge (`FeltCards`), so the panels have to
    // run the same way. Filtering the raw list left them in deal order, which
    // put a rival's cards in front of somebody else's face whenever you were
    // not the first player in it.
    const foes = (() => {
        const start = g.players.findIndex(p => p.id === g.you);
        const seated = start < 0 ? g.players : [...g.players.slice(start), ...g.players.slice(0, start)];
        const round = seated.filter(p => p.id !== g.you);
        return narrow ? round : (SEAT_SLOTS[round.length] ?? round.map((_, i) => i)).map(i => round[i]);
    })();
    const handSize = me?.hand?.length ?? 0;
    const overLimit = handSize > 7;
    const canPlay = myTurn && !pending && g.plays_left > 0;

    // On an upright phone your own board is the tallest thing on screen, and
    // between your turns it is also the least urgent: folding it at the end of
    // your turn hands the room back to whoever is playing now.
    const accordion = narrow && portrait;
    useEffect(() => {
        if (!accordion) return;
        setBoardOpen(myTurn);
    }, [accordion, myTurn]);
    // A card already in the air needs its targets, whatever the fold says.
    const boardShown = !accordion || boardOpen || Boolean(drag);

    // The hand folds the other way round: it is what the accordion gives
    // back while somebody else is playing, so their board gets the room your
    // own cards do not need until it is your turn again. A pending action
    // keeps it open regardless — an answer (Just Say No, a payment) can come
    // from your hand at any moment while one is unresolved.
    const [handOpen, setHandOpen] = useState(true);
    useEffect(() => {
        if (!accordion) return;
        setHandOpen(myTurn || Boolean(pending));
    }, [accordion, myTurn, pending]);
    const handShown = !accordion || handOpen || Boolean(drag && drag.from === 'hand');


    // The reveal wheel runs with the turn not yet live: plays are still zero
    // there, and ending the turn during it would skip the first player.
    // Being over the hand limit no longer holds this back — ending the turn
    // now drops the extra cards itself instead of waiting on the player.
    const startPending = Boolean(g.starts_at_ms && Date.now() + skewMs < g.starts_at_ms);
    const autoEnd = myTurn && !pending && !spectating && !startPending
        && g.state === 'playing' && g.plays_left === 0;
    const sendRef = useRef(send);
    sendRef.current = send;
    const [autoEndLeft, setAutoEndLeft] = useState(0);
    useEffect(() => {
        if (!autoEnd) {
            setAutoEndLeft(0);
            return;
        }
        const until = Date.now() + AUTO_END_MS;
        setAutoEndLeft(Math.ceil(AUTO_END_MS / 1000));
        const tick = window.setInterval(
            () => setAutoEndLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000))), 250);
        const timer = window.setTimeout(() => sendRef.current({ type: 'end_turn' }), AUTO_END_MS);
        return () => {
            window.clearInterval(tick);
            window.clearTimeout(timer);
        };
    }, [autoEnd, g.current_turn]);

    /** An "any colour" joker, which may only join a colour you already own. */
    const isAnyColorWild = (card: Card) =>
        card.type === 'property_wildcard' && card.colors?.length === 1 && card.colors[0] === 'all';

    // Colours a card already on the table may move to: never the set it is in,
    // and an any-colour joker may only join a colour this player already owns.
    const moveColors = (card: Card): Color[] => {
        const current = me?.sets.find(s => s.cards.some(c => c.id === card.id))?.color;
        return playableColors(card, g.colors).filter(c =>
            c !== current
            && (!isAnyColorWild(card) || Boolean(me?.sets.some(s => s.color === c && s.cards.length > 0))));
    };

    // A colour a wildcard in hand has been tapped to commit to, ahead of the
    // drag itself. Nothing here decides which stack it plays into — that is
    // still whichever zone the card lands on — it only narrows which single
    // zone lights up, so a two- or any-colour card stops asking the player to
    // aim at a whole spread of possible targets at once.
    const [wildColor, setWildColor] = useState<Record<string, Color>>({});
    // Which any-colour joker currently has its colour tray open, so tapping
    // it again (or picking a swatch) is what closes it.
    const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

    /** Taps a wildcard toward a committed colour rather than opening the tap
     *  tray for it. Returns whether the card was actually a wildcard, so the
     *  caller knows whether to fall through to the ordinary tap behaviour. */
    const tapWildcard = (card: Card): boolean => {
        if (card.type !== 'property_wildcard') return false;
        const cols = card.colors ?? [];
        if (cols.length === 2) {
            setWildColor(prev => {
                const cur = prev[card.id] ?? cols[0];
                return { ...prev, [card.id]: cur === cols[0] ? cols[1] : cols[0] };
            });
            return true;
        }
        if (isAnyColorWild(card)) {
            setColorPickerFor(prev => (prev === card.id ? null : card.id));
            return true;
        }
        return false;
    };

    // What the currently dragged card can accept. A wildcard that was tapped
    // to a colour already collapses to just that one, if it is still legal.
    const dragTargets = drag?.from === 'hand'
        ? dropTargets(drag.card, g.colors)
        : { colors: drag ? moveColors(drag.card) : [], bankable: false };
    const committedColor = drag ? wildColor[drag.card.id] : undefined;
    const dragColorsAll = committedColor && dragTargets.colors.includes(committedColor)
        ? [committedColor]
        : dragTargets.colors;
    const dragColors = drag && canPlay ? dragColorsAll : [];
    const dragBankable = Boolean(drag && canPlay && dragTargets.bankable);

    // A joker that joins any colour cannot be aimed at a panel that means
    // "the board". Every colour is a legal answer, so the whole-panel
    // resolver below has nothing to resolve by and the card lands wherever
    // its list of candidates happened to start — which from the other side
    // of the screen looks like the board refusing the card and then putting
    // it somewhere nobody asked for. On a phone it has to be told which
    // colour first, by tapping it; until then the board does not take it.
    // A mouse aims at one colour's own stack and never had the question.
    const unaimedJoker = (card: Card, from: 'hand' | 'board') =>
        narrow
        && isAnyColorWild(card)
        && !wildColor[card.id]
        && (from === 'board' ? moveColors(card) : dropTargets(card, g.colors).colors).length > 1;
    const carryingUnaimedJoker = Boolean(drag && unaimedJoker(drag.card, drag.from));
    const propertyDropActive = dragColors.length > 0 && !carryingUnaimedJoker;

    const playCard = (card: Card, color: Color, from: 'hand' | 'board') => {
        if (from === 'board') {
            setPendingMove({ type: 'move_wildcard', cardId: card.id, color });
            act({ type: 'move_wildcard', card_id: card.id, color });
        } else {
            setPendingMove({ type: 'play_property', cardId: card.id, color });
            act({ type: 'play_property', card_id: card.id, color });
        }
    };

    // A two-colour wildcard always has a face up: the colour it was tapped to,
    // or the first of the two if it has not been tapped. The card is never
    // ambiguous about which it is — the player can see it.
    const faceColor = (card: Card): Color | undefined => {
        const cols = card.colors ?? [];
        if (card.type !== 'property_wildcard' || cols.length !== 2) return undefined;
        return wildColor[card.id] ?? cols[0];
    };

    // Which colour a card dropped anywhere in the property panel actually
    // lands in — the panel is one target, not a row of them, so this is
    // where the choice a wildcard's tap left open finally gets settled.
    const resolvePropertyColor = (card: Card, from: 'hand' | 'board'): Color | null => {
        const targets = from === 'board' ? moveColors(card) : dropTargets(card, g.colors).colors;
        if (targets.length === 0) return null;
        // What the card shows is what it plays as. This used to read only an
        // explicit tap and otherwise prefer whichever stack was already under
        // way, so a joker sitting face-up green dropped into the blue set the
        // player happened to own — the card said one thing and the board did
        // another, and the only way to be believed was to tap twice back to
        // the colour it was already showing.
        const showing = faceColor(card) ?? wildColor[card.id];
        if (showing && targets.includes(showing)) return showing;
        // Nothing on the card to go by: topping up a stack that is already
        // under way beats opening another.
        const existing = targets.find(c => me?.sets.some(s => s.color === c));
        return existing ?? targets[0];
    };

    // On a phone the panel resolves the drop itself, so the marker belongs on
    // the one stack the card will actually join rather than on every stack it
    // would be legal in. Two lit stacks and one card is a question the player
    // cannot answer by aiming.
    const landingColor = drag && canPlay && narrow
        ? resolvePropertyColor(drag.card, drag.from)
        : null;

    const dropProperty = (card: Card, from: 'hand' | 'board') => {
        const color = resolvePropertyColor(card, from);
        if (color) playCard(card, color, from);
    };

    // Double The Rent is the rule nobody remembers they are holding: it is
    // played with a rent card rather than on its own, so by the time the rent
    // has been charged it is too late to use. The moment a rent card is
    // picked up or chosen, then, whatever could double it catches the light
    // in the hand — the reminder arrives while it can still be acted on, and
    // says it without a line of text or a second card to aim at.
    const rentInPlay = drag?.card.type === 'rent' || selected?.type === 'rent';
    const ridesAlong = (card: Card) => rentInPlay && card.action === 'double_rent';

    const playActionCard = (card: Card) => {
        // A two-colour rent card only ever asks the dialog's colour question
        // because both prices are shown as options — once a property set of
        // only one of them exists, that question already has one answer, and
        // charging every opponent needs no target either. Nothing is left to
        // decide, so nothing is asked: it charges the instant it lands,
        // exactly like a bank or action-space drop already does. A wild rent
        // still needs a target player, and a hand still holding Double The
        // Rent still gets asked, since spending one is a real choice.
        if (card.type === 'rent') {
            const isWild = card.colors?.length === 1 && card.colors[0] === 'all';
            const hasDouble = me?.hand?.some(c => c.action === 'double_rent') ?? false;
            if (!isWild && !hasDouble) {
                const owned = playableColors(card, g.colors)
                    .filter(c => me?.sets.some(s => s.color === c && s.cards.length > 0));
                if (owned.length === 1) {
                    act({ type: 'play_action', card_id: card.id, color: owned[0] });
                    return;
                }
            }
        }
        if (needsTargeting(card)) setDialog({ card, intent: 'action' });
        else act({ type: 'play_action', card_id: card.id });
    };

    const playBank = (card: Card) => {
        setPendingMove({ type: 'play_bank', cardId: card.id });
        act({ type: 'play_bank', card_id: card.id });
    };

    const wildcardIds = (cards: Card[]) =>
        new Set(cards.filter(c => c.type === 'property_wildcard').map(c => c.id));

    const backButton = (
        <button
            type="button"
            className="btn btn-ghost !px-2.5 !py-1.5 !text-sm"
            onClick={onLeave}
            title={t('table.leave_hint')}
        >
            ‹ <span className="hidden sm:inline">{t('table.tables')}</span>
        </button>
    );

    const turnChip = turnPlayer ? (
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 ${
            myTurn ? 'animate-pulse-ring bg-brass text-ink' : 'bg-black/35'
        }`}>
            <Avatar id={turnPlayer.id} name={turnPlayer.name} size={20} />
            <span className="text-[0.7rem] font-bold uppercase tracking-wide">
                {myTurn ? t('table.your_turn') : turnPlayer.name}
            </span>
        </span>
    ) : null;

    const playChips = (
        <HoverDetails content={<div><h3>{t('table.plays')}</h3><p>{t('table.plays_hint')}</p><p className="inspection-note">{t('table.wildcard_move_cost')}</p></div>}><span tabIndex={0} data-tour="plays" className="flex items-center gap-1.5" title={t('table.plays_hint')}>
            <span className="label-caps">{t('table.plays')}</span>
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className={`h-3.5 w-3.5 rounded-full border transition ${
                        i < g.plays_left
                            ? 'border-amber-200 bg-brass shadow-[0_0_8px_rgba(242,193,78,0.8)]'
                            : 'border-white/20 bg-black/40'
                    }`}
                />
            ))}
        </span></HoverDetails>
    );

    const endTurnButton = (
        <button
            type="button"
            data-tour="end-turn"
            className="btn btn-red !py-1.5"
            onClick={() => act({ type: 'end_turn' })}
            title={t(overLimit ? 'table.end_turn_over_limit' : 'table.end_turn_hint', { count: handSize - 7 })}
        >
            {t('table.end_turn')}
        </button>
    );

    const deckChip = (
        <div className="panel flex shrink-0 items-center gap-2.5 px-2.5 py-2">
            <div className="relative">
                <CardBack size="xs" className="absolute left-0.5 top-0.5 !h-11 !w-8 opacity-60" />
                <CardBack size="xs" className="relative !h-11 !w-8" />
            </div>
            <div className="text-[0.7rem] leading-tight text-white/65">
                <p>{t('table.deck')} <span className="font-bold text-white">{g.deck_count}</span></p>
                <p>{t('table.discard')} <span className="font-bold text-white">{g.discard_count}</span></p>
            </div>
            {g.discard_top && <PlayingCard card={g.discard_top} size="xs" className="!h-11 !w-8" />}
        </div>
    );

    const bankZone = (
        <DropZone
            active={dragBankable}
            hint={drag ? t('table.bank_drop', { amount: money(t, drag.card.value) }) : ''}
            onDrop={() => drag && playBank(drag.card)}
            tour="bank"
            className="bank-zone min-w-0 rounded-2xl"
        >
            {narrow ? (
                <button
                    type="button"
                    className="panel flex w-full items-center gap-2 px-3 py-2 text-left"
                    onClick={() => setSheet({ kind: 'bank' })}
                >
                    <span className="label-caps">{t('table.bank')}</span>
                    <span className="font-display text-xl leading-none text-emerald-300">{money(t, me?.bank_total ?? 0)}</span>
                    <span className="text-xs text-white/45">{t('table.bank_cards', { count: me?.bank.length ?? 0 })}</span>
                    <span className="ml-auto text-xs text-white/45">{t('table.bank_view')}</span>
                </button>
            ) : (
                <div className="panel h-full p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="label-caps">{t('table.your_bank')}</p>
                        <p className="font-display text-xl text-emerald-300">{money(t, me?.bank_total ?? 0)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {me?.bank.length === 0
                            ? <p className="py-3 text-xs italic text-white/35">{t('table.bank_empty')}</p>
                            : me?.bank.map(c => <PlayingCard key={c.id} card={c} size="xs" banked />)}
                    </div>
                </div>
            )}
        </DropZone>
    );

    const propertyHeading = (
        <>
            <p className="label-caps">{t('table.your_properties')}</p>
            {/* Folded, the colour bar is all that is left of the board, so it
                has to carry the shape of it. */}
            {accordion && !boardShown && Boolean(me?.sets.length) && (
                <span className="board-swatches" aria-hidden="true">
                    {me?.sets.map(set => (
                        <span
                            key={set.color}
                            style={{
                                background: colorMeta(set.color).hex,
                                flex: set.cards.length,
                                opacity: set.complete ? 1 : 0.55,
                            }}
                        />
                    ))}
                </span>
            )}
            <p data-tour="sets-progress" className="truncate text-xs text-white/50">
                {t('table.sets_progress', { done: me?.complete_sets ?? 0 })}
                {g.mode === 'deathmatch' && t('table.empty_hand_to_win')}
            </p>
        </>
    );

    const propertyZone = (
        <div
            data-tour="properties"
            data-density={(me?.sets.length ?? 0) > 6 ? 'tight' : (me?.sets.length ?? 0) > 4 ? 'dense' : undefined}
            className={`property-zone panel flex min-h-0 min-w-0 flex-1 flex-col p-2 sm:p-3 ${
                accordion ? 'property-accordion' : ''
            } ${accordion && !boardShown ? 'is-folded' : ''} ${propertyDropActive ? 'property-zone-live' : ''}`}
        >
            {accordion ? (
                <button
                    type="button"
                    className="property-fold"
                    aria-expanded={boardShown}
                    onClick={() => setBoardOpen(open => !open)}
                    title={t(boardShown ? 'table.board_fold' : 'table.board_unfold')}
                >
                    {propertyHeading}
                    <span className="property-chevron" aria-hidden="true">▾</span>
                </button>
            ) : (
                <div className="mb-2 flex items-center justify-between gap-2">{propertyHeading}</div>
            )}

            {/* A phone drops anywhere in the panel and lets the system work
                out which stack that means (see `dropProperty`) — there is no
                room to aim precisely with a thumb. A mouse has no such
                excuse, so it keeps the exact, one-zone-per-colour version:
                land the card on the stack you mean, same as it always did. */}
            {narrow ? (
                <DropZone
                    hidden={!boardShown}
                    active={propertyDropActive}
                    onDrop={() => drag && dropProperty(drag.card, drag.from)}
                    className={`property-groups min-w-0 flex-1 gap-3 pb-1 ${me?.sets.length ? 'items-start' : 'items-center justify-center'}`}
                >
                    {me?.sets.map(set => {
                        const accepts = set.color === landingColor;
                        const aimable = carryingUnaimedJoker && dragColors.includes(set.color);
                        const stack = (
                            <div className={`shrink-0 rounded-xl ${accepts ? 'property-set-live' : ''}`}>
                                <PropertySets
                                    sets={[set]}
                                    size="sm"
                                    draggableIds={myTurn && !pending ? wildcardIds(set.cards) : undefined}
                                    onDragCard={card => setDrag({ card, from: 'board' })}
                                    onDragEndCard={() => setDrag(null)}
                                    draggingId={drag?.card.id}
                                    onCardClick={myTurn && !pending
                                        ? card => {
                                            if (card.type === 'property_wildcard') setDialog({ card, intent: 'move' });
                                        }
                                        : undefined}
                                    enabledIds={wildcardIds(set.cards)}
                                    dimDisabled={false}
                                />
                            </div>
                        );
                        return aimable ? (
                            <DropZone
                                key={set.color}
                                active
                                onDrop={() => drag && playCard(drag.card, set.color, drag.from)}
                                className="shrink-0 rounded-xl"
                            >
                                {stack}
                            </DropZone>
                        ) : <div key={set.color} className="contents">{stack}</div>;
                    })}

                    {/* Normally a preview only: dropping anywhere in this
                        panel is what starts the set, and the panel works out
                        which colour that meant. A joker with no colour chosen
                        is the one card it cannot work out — so for that card,
                        and only that card, each tile answers for itself and
                        the drop can be aimed after all. */}
                    {dragColors
                        .filter(c => !me?.sets.some(s => s.color === c))
                        .map(c => {
                            const m = colorMeta(c);
                            // A joker offers every colour at once. At the size
                            // of a card that is four rows of tiles in a panel
                            // three rows tall, so the choice goes off the
                            // bottom of the screen; they are swatches here,
                            // not cards, and the whole choice fits on screen.
                            const tile = (
                                <div
                                    className={`grid place-items-center rounded-xl border-2 border-dashed p-1 text-center ${
                                        carryingUnaimedJoker
                                            ? 'h-[4.25rem] w-[4.25rem] text-[0.7rem]'
                                            : 'h-[7.5rem] w-[5.5rem] text-sm'
                                    }`}
                                    style={{ borderColor: m.hex, background: `${m.hex}22` }}
                                >
                                    <span className="font-display leading-tight tracking-wide">
                                        {carryingUnaimedJoker
                                            ? t(`color.short.${c}`)
                                            : <>{t('table.new_set')}<br />{t(`color.short.${c}`)}</>}
                                    </span>
                                </div>
                            );
                            return carryingUnaimedJoker ? (
                                <DropZone
                                    key={`new-${c}`}
                                    active
                                    onDrop={() => drag && playCard(drag.card, c, drag.from)}
                                    className="shrink-0 rounded-xl"
                                >
                                    {tile}
                                </DropZone>
                            ) : (
                                <div key={`new-${c}`} className="shrink-0 rounded-xl">{tile}</div>
                            );
                        })}

                    {me?.sets.length === 0 && dragColors.length === 0 && (
                        <p className="property-empty px-3 text-center text-xs text-white/60">
                            <span aria-hidden="true" className="property-ghosts"><i>⌂</i><i>⌂</i><i>⌂</i></span>
                            {t('table.properties_tap')}
                        </p>
                    )}
                </DropZone>
            ) : (
                <div
                    hidden={!boardShown}
                    className={`property-groups min-w-0 flex-1 gap-3 pb-1 ${me?.sets.length ? 'items-start' : 'items-center justify-center'}`}
                >
                    {me?.sets.map(set => {
                        const accepts = dragColors.includes(set.color);
                        return (
                            <DropZone
                                key={set.color}
                                active={accepts}
                                hint={t(`color.short.${set.color}`)}
                                onDrop={() => drag && playCard(drag.card, set.color, drag.from)}
                                className="shrink-0 rounded-xl"
                            >
                                <PropertySets
                                    sets={[set]}
                                    size="sm"
                                    draggableIds={myTurn && !pending ? wildcardIds(set.cards) : undefined}
                                    onDragCard={card => setDrag({ card, from: 'board' })}
                                    onDragEndCard={() => setDrag(null)}
                                    draggingId={drag?.card.id}
                                    onCardClick={myTurn && !pending
                                        ? card => {
                                            if (card.type === 'property_wildcard') setDialog({ card, intent: 'move' });
                                        }
                                        : undefined}
                                    enabledIds={wildcardIds(set.cards)}
                                    dimDisabled={false}
                                />
                            </DropZone>
                        );
                    })}

                    {/* Empty slots for colours this card could start. */}
                    {dragColors
                        .filter(c => !me?.sets.some(s => s.color === c))
                        .map(c => {
                            const m = colorMeta(c);
                            return (
                                <DropZone
                                    key={`new-${c}`}
                                    active
                                    onDrop={() => drag && playCard(drag.card, c, drag.from)}
                                    className="shrink-0 rounded-xl"
                                >
                                    <div
                                        className="grid h-[7.5rem] w-[5.5rem] place-items-center rounded-xl border-2 border-dashed p-1 text-center"
                                        style={{ borderColor: m.hex, background: `${m.hex}22` }}
                                    >
                                        <span className="font-display text-sm leading-tight tracking-wide">
                                            {t('table.new_set')}<br />{t(`color.short.${c}`)}
                                        </span>
                                    </div>
                                </DropZone>
                            );
                        })}

                    {me?.sets.length === 0 && dragColors.length === 0 && (
                        <p className="property-empty px-3 text-center text-xs text-white/60">
                            <span aria-hidden="true" className="property-ghosts"><i>⌂</i><i>⌂</i><i>⌂</i></span>
                            {t('table.properties_drag')}
                        </p>
                    )}
                </div>
            )}

            {/* A refusal with no reason reads as a bug. */}
            {carryingUnaimedJoker && (
                <p className="mt-1 shrink-0 text-[0.65rem] font-semibold text-amber-300">
                    {t('table.joker_pick_colour')}
                </p>
            )}
            {/* Shuffling a wildcard between colours used to be free; it is not
                any more, so the board says so where the move is made. */}
            {boardShown && myTurn && !pending && me?.sets.some(s => s.cards.some(c => c.type === 'property_wildcard')) && (
                <p className="mt-1 shrink-0 text-[0.65rem] text-white/35">{t('table.wildcard_move_cost')}</p>
            )}
        </div>
    );

    // A phone has no room for the shared centre of the table, but hiding the
    // action space until a drag begins leaves no way to tell "play this hotel"
    // apart from "bank it" before committing to the gesture. So both targets
    // stand beside the bank, lit only when the card in hand can land there.
    const actionActive = Boolean(drag && drag.from === 'hand' && canPlay && isPlayableAction(drag.card));
    const boardTargets = (
        <div className="board-targets">
            {bankZone}
            <DropZone
                active={actionActive}
                onDrop={() => drag && playActionCard(drag.card)}
                tour="action-space"
                className="board-target rounded-xl"
            >
                <div className="board-target-slot">
                    <span aria-hidden="true">✦</span>
                    {t('table.action_space')}
                </div>
            </DropZone>
        </div>
    );

    return (
        <DragProvider>
        <div className={`game-room ${narrow ? 'compact-room' : 'desktop-room'} ${motion ? '' : 'motion-off'} ${drag ? 'is-carrying' : ''} ${
            !narrow && handPos !== 'bottom' ? `hand-column hand-${handPos}` : ''
        } ${
            accordion && !boardShown ? 'board-folded' : ''
        } ${
            accordion && !handShown ? 'hand-folded' : ''
        }`}>
            <Cityscape />
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <header className="game-header relative flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-2 sm:px-3">
                {backButton}
                <GameBrand compact />

                <div className="flex min-w-0 items-center gap-2">
                    <h1 className="min-w-0 truncate font-display text-xl leading-none tracking-wider text-brass sm:text-2xl">
                        {room.name}
                    </h1>
                    <RoomInvite room={room} />
                </div>

                {!narrow && (
                    <span className="rounded-full bg-black/30 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest text-white/60">
                        {t(`mode.${g.mode}`)}
                    </span>
                )}

                {!narrow && turnChip}

                {!narrow && (
                    <TurnTimer
                        deadlineMs={g.deadline_ms}
                        totalSeconds={g.deadline_seconds}
                        skewMs={skewMs}
                        kind={g.deadline_kind}
                    />
                )}

                {!narrow && !spectating && playChips}

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Reactions onSend={text => send({ type: 'chat', text })} />

                    <button
                        ref={menuButtonRef}
                        type="button"
                        className="btn btn-ghost !px-2.5 !py-1.5"
                        title={t('table.menu')}
                        aria-label={t('table.menu')}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
                    >
                        ⚙
                    </button>
                </div>

                {menuOpen && (
                    <div
                        ref={menuRef}
                        role="menu"
                        aria-label={t('table.menu')}
                        className="game-menu animate-pop absolute right-2 top-full z-50 mt-1 max-h-[min(70vh,calc(100vh-5rem))] w-64 max-w-[min(16rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-white/15 bg-[#08281d] shadow-2xl"
                    >
                        <p className="border-b border-white/10 px-3 py-2 text-xs text-white/55">
                            {t('table.menu_summary', {
                                mode: t(`mode.${g.mode}`),
                                turn: formatTurn(t, g.turn_seconds),
                                host: room.owner_name,
                            })}
                        </p>
                        {/* Robot seats have a difficulty everyone at the table
                            should be able to see, not only the host who set it. */}
                        {g.players.some(p => p.bot) && (
                            <p className="border-b border-white/10 px-3 py-2 text-xs text-white/55">
                                {t('table.menu_robots', { difficulty: t(`difficulty.${g.bot_difficulty}`) })}
                            </p>
                        )}
                        {spectating ? (
                            <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/10"
                                onClick={() => {
                                    send(room.you_requested ? { type: 'cancel_seat' } : { type: 'request_seat' });
                                    closeMenu();
                                }}
                            >
                                {t(room.you_requested ? 'table.cancel_seat' : 'table.ask_seat')}
                            </button>
                        ) : (
                            <button
                                type="button"
                                role="menuitem"
                                className={`block w-full px-3 py-2.5 text-left text-sm ${confirmEnd ? 'bg-rose-600/40' : 'hover:bg-white/10'}`}
                                onClick={() => {
                                    if (confirmEnd) {
                                        act({ type: 'terminate_game' });
                                        closeMenu();
                                    } else {
                                        setConfirmEnd(true);
                                    }
                                }}
                            >
                                {t(confirmEnd ? 'table.end_game_confirm' : 'table.end_game')}
                            </button>
                        )}
                        <button
                            type="button"
                            role="menuitem"
                            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/10"
                            onClick={() => {
                                closeMenu();
                                onTutorial(!tutorial);
                            }}
                        >
                            {t(tutorial ? 'table.tutorial_stop' : 'table.tutorial_start')}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/10"
                            onClick={() => {
                                closeMenu();
                                onLeave();
                            }}
                        >
                            {t('table.leave')}
                        </button>
                        {!narrow && (
                            <div className="border-t border-white/10 px-3 py-2">
                                <p className="label-caps mb-1.5">{t('table.hand_position')}</p>
                                <div className="flex gap-1.5">
                                    {HAND_POSITIONS.map(pos => (
                                        <button
                                            key={pos}
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={handPos === pos}
                                            className={`btn !px-2 !py-1 !text-xs ${handPos === pos ? 'btn-gold' : 'btn-ghost'}`}
                                            onClick={() => chooseHandPos(pos)}
                                        >
                                            {t(`table.hand_${pos}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <button
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={tapTray}
                            className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/10"
                            onClick={() => setTapTray(value => {
                                localStorage.setItem('md.taptray', value ? 'off' : 'on');
                                return !value;
                            })}
                        >
                            {t('table.tap_tray')}: {t(tapTray ? 'table.on' : 'table.off')}
                        </button>
                        {!narrow && (
                            <button
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={handPeek}
                                className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/10"
                                onClick={() => setHandPeek(value => {
                                    localStorage.setItem('md.handpeek', value ? 'off' : 'on');
                                    return !value;
                                })}
                            >
                                {t('table.hand_peek')}: {t(handPeek ? 'table.on' : 'table.off')}
                            </button>
                        )}
                        <button type="button" role="menuitemcheckbox" aria-checked={motion} className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/10" onClick={() => setMotion(value => { localStorage.setItem('md.motion', value ? 'off' : 'on'); return !value; })}>
                            {t('table.motion')}: {t(motion ? 'table.on' : 'table.off')}
                        </button>
                        <button type="button" role="menuitemcheckbox" aria-checked={cryReaction} className="block w-full px-3 py-2.5 text-left text-sm hover:bg-white/10" onClick={() => setCryReaction(value => { localStorage.setItem('md.cryreaction', value ? 'off' : 'on'); return !value; })}>
                            {t('table.cry_reaction')}: {t(cryReaction ? 'table.on' : 'table.off')}
                        </button>
                        <div className="border-t border-white/10 p-3"><GameAudioControls audio={audio} radio={room.radio} canManage={room.is_owner} ownerName={room.owner_name} send={send} /></div>
                        <LanguagePicker variant="menu" />
                    </div>
                )}

            </header>


            {spectating && (
                <div className="panel flex min-w-0 flex-wrap items-center gap-2 px-3 py-2">
                    <span className="text-sm">{t('table.watching')}</span>
                    <button
                        type="button"
                        className={`btn !py-1 !text-xs ${room.you_requested ? 'btn-ghost' : 'btn-gold'}`}
                        onClick={() => send(room.you_requested ? { type: 'cancel_seat' } : { type: 'request_seat' })}
                    >
                        {t(room.you_requested ? 'table.seat_waiting' : 'table.ask_seat')}
                    </button>
                    <button type="button" className="btn btn-ghost !py-1 !text-xs" onClick={onLeave}>
                        ‹ {t('table.back_to_tables')}
                    </button>
                    {room.requests.length > 0 && (
                        <span className="truncate text-xs text-white/50">
                            {t('table.queue', { names: room.requests.map(r => r.name).join(', ') })}
                        </span>
                    )}
                </div>
            )}

            <div className="table-layout flex min-h-0 min-w-0 flex-1 gap-2">
                <main className="table-stage flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="table-field flex min-h-0 min-w-0 flex-1 flex-col">
                        <div className={`arena-top seats-${foes.length}`}>
                            <div className="arena-surface" aria-hidden="true"><div className="arena-orbit" /><span className="table-wordmark">MONOPOLY <b>DEAL</b></span></div>
                            {/* What the table would look like if you were
                                sitting at it: everyone's played property, in
                                front of the seat that played it. */}
                            <FeltCards
                                players={g.players}
                                you={g.you}
                                turnId={turnPlayer?.id}
                                interactive={!narrow}
                            />
                            {/* ── Opponents ───────────────────────────── */}
                            <section data-tour="opponents" className={`opponent-seats ${narrow ? 'rail gap-2 pb-1' : ''}`}>
                                {narrow && deckChip}
                                {foes.map(p => {
                                    const play = plays[p.name];
                                    const shared = {
                                        player: p,
                                        play: play ? tLog(play.entry) : undefined,
                                        reaction: recentReaction(p.id),
                                        isTurn: turnPlayer?.id === p.id,
                                        isTargeted: pending?.targets.some(t => t.player_id === p.id && !t.settled),
                                        lastPlay: play?.entry,
                                    };
                                    return narrow
                                        ? <PlayerChip
                                            key={p.id}
                                            {...shared}
                                            playKey={play?.id}
                                            grow={foes.length <= 3}
                                            onOpen={() => setSheet({ kind: 'player', player: p })}
                                        />
                                        : <OpponentPanel key={p.id} {...shared} playKey={play?.id} onOpen={() => setSheet({ kind: 'player', player: p })} />;
                                })}
                            </section>

                            {/* ── Table centre: wide screens have room for it ── */}
                            {!narrow && (
                            <section className="table-center">
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute inset-0 rounded-2xl"
                                    style={{ background: 'radial-gradient(ellipse 42% 120% at 50% 50%, rgb(242 193 78 / 0.1), transparent 70%)' }}
                                />
                                <div className="relative flex flex-col items-center gap-1">
                                    <div className="relative">
                                        <CardBack size="sm" className="absolute left-1 top-1 opacity-60" />
                                        <CardBack size="sm" className="relative" />
                                    </div>
                                    <span className="label-caps">{t('table.deck_count', { count: g.deck_count })}</span>
                                </div>

                                {/* The pile itself, not a drop target any more — nobody
                                    chooses what lands here; the server discards the
                                    excess itself when a turn over the limit ends. */}
                                <div className="flex flex-col items-center gap-1 p-1">
                                    {g.discard_top
                                        ? <PlayingCard key={g.discard_top.id} card={g.discard_top} size="sm" className="discard-arrival" />
                                        : <div className="grid h-[6.5rem] w-[4.5rem] place-items-center rounded-lg border-2 border-dashed border-white/20 text-xs text-white/35">
                                            {t('table.discard_empty')}
                                        </div>}
                                    <span className="label-caps">{t('table.discard_count', { count: g.discard_count })}</span>
                                </div>

                                <DropZone
                                    active={actionActive}
                                    hint={t('table.play_it')}
                                    onDrop={() => drag && playActionCard(drag.card)}
                                    tour="action-space"
                                    className="rounded-xl"
                                >
                                    <div className="action-landing">
                                        {t('table.action_space')}
                                    </div>
                                </DropZone>
                            </section>
                            )}
                            {/* A phone shows rivals as chips, so the centre of
                                the table carries the board of whoever is using
                                it right now. */}
                            {narrow && turnPlayer && !myTurn && turnPlayer.id !== g.you && (
                                <ActiveBoard
                                    player={turnPlayer}
                                    onOpen={() => setSheet({ kind: 'player', player: turnPlayer })}
                                />
                            )}
                            {/* A phone has no side log to read the last move from,
                                so it still gets this inline. */}
                            {narrow && (
                                <div key={lastMoveIndex} className="table-event" aria-live="polite">
                                    {lastMove ? tLog(lastMove) : t('table.shared_space')}
                                </div>
                            )}
                        </div>

                        {/* ── My board ────────────────────────────────── */}
                        {me && (
                            <section className="my-board flex min-w-0 gap-3">
                                {propertyZone}
                                {narrow ? boardTargets : bankZone}
                            </section>
                        )}
                    </div>

                    {/* ── Hand: pinned below the table ─────────────────── */}
                    {me && (
                        <section
                            data-tour="hand"
                            className={`hand-zone relative min-w-0 shrink-0 ${accordion ? 'hand-accordion' : ''} ${accordion && !handShown ? 'is-folded' : ''}`}
                        >
                            <button
                                type="button"
                                className="hand-fold mb-1 flex w-full min-w-0 items-center justify-between gap-2"
                                aria-expanded={handShown}
                                disabled={!accordion}
                                onClick={() => setHandOpen(open => !open)}
                                title={accordion ? t(handShown ? 'table.hand_fold' : 'table.hand_unfold') : undefined}
                            >
                                <div className="hand-player"><Avatar id={me.id} name={me.name} size={32} active={myTurn} /><strong>{me.name}</strong>{recentReaction(me.id) && <ReactionBubble key={recentReaction(me.id)!.id} message={recentReaction(me.id)!} />}{!recentReaction(me.id) && myDiscardPlay && <PlayBubble key={myDiscardPlay.id} text={tLog(myDiscardPlay.entry)} />}<span className="label-caps">{t('table.hand', { count: handSize })}</span></div>
                                {/* Folded, the hand is a strip of colour rather than a
                                    row of readable cards — enough to remember what is
                                    still in it without spending the screen an opponent's
                                    turn needs more. */}
                                {accordion && !handShown && handSize > 0 && (
                                    <span className="hand-swatches" aria-hidden="true">
                                        {me.hand?.map(c => (
                                            <span
                                                key={c.id}
                                                style={{
                                                    background: c.type === 'money'
                                                        ? 'oklch(78% 0.14 150)'
                                                        : c.type === 'action' || c.type === 'rent'
                                                          ? 'oklch(74% 0.16 305)'
                                                          : colorMeta(c.colors?.[0]).hex,
                                                }}
                                            />
                                        ))}
                                    </span>
                                )}
                                {overLimit ? (
                                    <p className="truncate rounded-md bg-amber-600/25 px-2 py-1 text-xs font-bold text-amber-200">
                                        {t('table.over_limit', { count: handSize - 7 })}
                                    </p>
                                ) : (!accordion || handShown) && (
                                    <p className="truncate text-xs text-white/40">
                                        {t(
                                            narrow
                                                ? tapOpens ? 'table.hand_tap' : 'table.hand_drag_only'
                                                : handPeek
                                                    ? tapOpens ? 'inspect.hand_hint' : 'inspect.hand_hint_drag'
                                                    : tapOpens ? 'inspect.hand_hint_click' : 'table.hand_drag_only',
                                        )}
                                    </p>
                                )}
                            </button>
                            <div hidden={!handShown} onKeyDown={e => {
                                if (e.key === 'Escape') { setSelected(null); return; }
                                const cards = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.hand-card'));
                                const index = cards.indexOf(document.activeElement as HTMLButtonElement);
                                const next = e.key === 'ArrowRight' ? Math.min(cards.length - 1, index + 1) : e.key === 'ArrowLeft' ? Math.max(0, index - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : -1;
                                if (next >= 0) { e.preventDefault(); cards[next]?.focus(); }
                            }} className={`hand-fan ${handSize > 10 ? 'hand-many' : ''}`} style={{ '--hand-count': handSize } as CSSProperties}>
                                {handSize === 0 && (
                                    <p className="py-8 text-sm italic text-white/35">
                                        {t('table.hand_empty')}
                                    </p>
                                )}
                                {me.hand?.map((c, i) => (
                                    <PlayingCard
                                        key={c.id}
                                        card={c}
                                        size={narrow ? 'sm' : 'md'}
                                        selected={selected?.id === c.id}
                                        activeColor={wildColor[c.id]}
                                        draggable={myTurn && !pending}
                                        dragAxis={narrow ? 'vertical' : 'free'}
                                        inspectable={handPeek}
                                        dragging={drag?.card.id === c.id || inFlight === c.id}
                                        onDragStart={() => setDrag({ card: c, from: 'hand' })}
                                        onDragEnd={() => setDrag(null)}
                                        onClick={() => {
                                            if (tapWildcard(c)) return;
                                            if (tapOpens) setSelected(prev => (prev?.id === c.id ? null : c));
                                        }}
                                        className={`hand-card ${ridesAlong(c) ? 'card-companion' : ''}`}
                                        style={{ '--fan-angle': `${(i - (handSize - 1) / 2) * Math.min(3, 22 / Math.max(handSize, 1))}deg`, '--fan-y': `${Math.pow(i - (handSize - 1) / 2, 2) * Math.min(1.2, 12 / Math.max(handSize, 1))}px`, '--deal-delay': `${Math.min(i, 8) * 35}ms` } as CSSProperties}
                                    />
                                ))}
                            </div>
                            {/* Next to the cards, where the hand already has
                                the player's attention. */}
                            {!narrow && !spectating && myTurn && !pending && (
                                <div className="hand-end-turn">
                                    {autoEndLeft > 0 && (
                                        <span className="hand-end-turn-hint" aria-live="polite">
                                            {t('table.auto_end', { seconds: autoEndLeft })}
                                        </span>
                                    )}
                                    {endTurnButton}
                                </div>
                            )}
                        </section>
                    )}
                </main>

                {!narrow && (
                    <SidePanel
                        log={g.log}
                        chat={room.chat}
                        you={room.you}
                        open={panelOpen}
                        onToggle={() => setPanelOpen(o => !o)}
                        onSend={text => send({ type: 'chat', text })}
                    />
                )}
            </div>

            {/* ── Colour tray for an any-colour joker ────────────────────
                Tapped instead of dragged first: the card commits to one
                colour before it ever leaves the hand, so the drag that
                follows has exactly one zone to aim at, not a spread of them. */}
            {colorPickerFor && me && (() => {
                const card = me.hand?.find(h => h.id === colorPickerFor);
                if (!card) return null;
                return (
                    <div className="card-action-tray panel animate-slide-up flex min-w-0 flex-wrap items-center gap-2 px-3 py-2">
                        <span className="font-display text-lg tracking-wide text-brass">{t('inspect.wild_choose')}</span>
                        {g.colors.filter(c => c !== 'all').map(c => {
                            // A colour you have already started is the one this
                            // card is usually for, so it is the one the tray
                            // points at rather than leaving ten equal buttons.
                            const own = me.sets.find(s => s.color === c && s.cards.length > 0);
                            return (
                                <button
                                    key={c}
                                    type="button"
                                    className={`btn !px-2.5 !py-1.5 !text-xs ${own ? 'wild-swatch-owned' : ''}`}
                                    style={{ background: colorMeta(c).hex, color: colorMeta(c).ink }}
                                    onClick={() => {
                                        setWildColor(prev => ({ ...prev, [card.id]: c }));
                                        setColorPickerFor(null);
                                    }}
                                >
                                    {t(`color.short.${c}`)}
                                    {own && <span className="wild-swatch-count">{own.cards.length}/{own.size}</span>}
                                </button>
                            );
                        })}
                        <button type="button" className="btn btn-ghost ml-auto" onClick={() => setColorPickerFor(null)}>{t('common.close')}</button>
                    </div>
                );
            })()}

            {/* ── Card actions ────────────────────────────────────────── */}
            {selected && me && (
                <div className="card-action-tray panel animate-slide-up flex min-w-0 flex-wrap items-center gap-2 px-3 py-2">
                    <span className="font-display text-lg tracking-wide text-brass">{tCard(selected)}</span>
                    <span className="text-xs text-white/50">{money(t, selected.value)}</span>

                    {!myTurn && <span className="text-sm text-amber-300">{t('table.wait_your_turn')}</span>}
                    {myTurn && Boolean(pending) && <span className="text-sm text-amber-300">{t('table.resolve_first')}</span>}

                    {myTurn && !pending && (
                        <>
                            {(selected.type === 'property' || selected.type === 'property_wildcard') && (
                                <button type="button" className="btn btn-blue" disabled={g.plays_left === 0}
                                    onClick={() => setDialog({ card: selected, intent: 'property' })}>
                                    {t('table.place_property')}
                                </button>
                            )}
                            {isPlayableAction(selected) && (
                                <button type="button" className="btn btn-gold" disabled={g.plays_left === 0}
                                    onClick={() => playActionCard(selected)}>
                                    {t(selected.type === 'rent' ? 'table.charge_rent' : 'table.play_action')}
                                </button>
                            )}
                            {selected.type !== 'property' && selected.type !== 'property_wildcard' && (
                                <button type="button" className="btn btn-green" disabled={g.plays_left === 0}
                                    onClick={() => playBank(selected)}>
                                    {t('table.bank_card', { amount: money(t, selected.value) })}
                                </button>
                            )}
                            {selected.action === 'just_say_no' && (
                                <span className="text-xs text-white/55">{t('table.just_say_no_hint')}</span>
                            )}
                            {selected.action === 'double_rent' && (
                                <span className="text-xs text-white/55">{t('table.double_rent_hint')}</span>
                            )}
                        </>
                    )}

                    <button type="button" className="btn btn-ghost ml-auto" onClick={() => setSelected(null)}>{t('common.close')}</button>
                </div>
            )}

            {/* ── Bottom bar: status and the primary action, in thumb reach ── */}
            {narrow && (
                <div className="mobile-controls panel flex min-w-0 shrink-0 items-center gap-2 px-2 py-1.5">
                    <TurnTimer
                        deadlineMs={g.deadline_ms}
                        totalSeconds={g.deadline_seconds}
                        skewMs={skewMs}
                        kind={g.deadline_kind}
                        size={34}
                    />
                    {turnChip}
                    {!spectating && playChips}

                    <button
                        type="button"
                        data-tour="log-narrow"
                        className="btn btn-ghost relative ml-auto !px-2.5 !py-1.5"
                        onClick={() => {
                            setSheet({ kind: 'talk' });
                            setChatSeen(room.chat.length);
                        }}
                        title={t('table.talk')}
                    >
                        💬
                        {room.chat.length > chatSeen && (
                            <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[0.55rem] font-bold">
                                {room.chat.length - chatSeen}
                            </span>
                        )}
                    </button>

                    {!spectating && myTurn && !pending && (
                        <>
                            {autoEndLeft > 0 && (
                                <span
                                    className="hand-end-turn-hint"
                                    aria-live="polite"
                                    title={t('table.auto_end', { seconds: autoEndLeft })}
                                >
                                    {t('table.auto_end_short', { seconds: autoEndLeft })}
                                </span>
                            )}
                            {endTurnButton}
                        </>
                    )}
                </div>
            )}

            {/* A phone already carries the turn inline, right where the
                cards are — the popup on top of that was one notice too
                many. A desktop's version of that inline text is a side
                panel out of the eye's way, so it keeps the announcement. */}
            {!narrow && (
                <TurnBanner
                    player={turnPlayer}
                    isYou={myTurn}
                    turn={g.current_turn}
                    enabled={g.state === 'playing' && !startPending}
                />
            )}

            <TableMotion game={g} enabled={motion} />
            <DiscardBurst plays={plays} you={g.you} players={g.players} myHand={me?.hand} cryEnabled={cryReaction} />

            {/* ── Overlays ────────────────────────────────────────────── */}
            {sheet?.kind === 'player' && (
                <Sheet
                    title={sheet.player.name}
                    subtitle={t('table.their_board')}
                    onClose={() => setSheet(null)}
                >
                    <PlayerBoard player={g.players.find(p => p.id === sheet.player.id) ?? sheet.player} isTurn={turnPlayer?.id === sheet.player.id} />
                </Sheet>
            )}

            {sheet?.kind === 'talk' && (
                <TalkSheet
                    log={g.log}
                    chat={room.chat}
                    you={room.you}
                    onClose={() => {
                        setSheet(null);
                        setChatSeen(room.chat.length);
                    }}
                    onSend={text => send({ type: 'chat', text })}
                />
            )}

            {sheet?.kind === 'bank' && me && (
                <Sheet
                    title={t('table.your_bank')}
                    subtitle={t('table.bank_sheet_total', {
                        amount: money(t, me.bank_total),
                        cards: t('table.bank_cards', { count: me.bank.length }),
                    })}
                    onClose={() => setSheet(null)}
                >
                    {me.bank.length === 0 ? (
                        <p className="text-sm italic text-white/40">
                            {t('table.bank_sheet_empty')}
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {me.bank.map(c => <PlayingCard key={c.id} card={c} size="sm" banked />)}
                        </div>
                    )}
                </Sheet>
            )}

            {dialog && me && (
                <ActionDialog
                    view={g}
                    card={dialog.card}
                    intent={dialog.intent}
                    onCancel={() => setDialog(null)}
                    onConfirm={act}
                />
            )}

            {pending && !dialog && <PendingPanel view={g} skewMs={skewMs} send={act} />}

            {/* A scripted table has no rematch and nobody to play on against,
                so finishing it means welcoming the player to the real thing. */}
            {g.state === 'finished' && g.mode === 'tutorial' && <TutorialDone onLeave={onLeave} />}

            {g.state === 'finished' && g.mode !== 'tutorial' && (
                <WinOverlay
                    view={g}
                    isOwner={room.is_owner}
                    ownerName={room.owner_name}
                    onNewGame={() => act({ type: 'new_game' })}
                    onLeave={onLeave}
                />
            )}

            {tutorial && !spectating && (
                <Tutorial
                    room={room}
                    narrow={narrow}
                    send={send}
                    paused={Boolean(colorPickerFor)}
                    compact={Boolean(dialog || sheet || pending || g.state === 'finished')}
                    onClose={() => (g.mode === 'tutorial' ? onLeave() : onTutorial(false))}
                />
            )}

            {error && (
                <div className="error-toast animate-shake fixed left-1/2 top-3 z-[70] max-w-[92vw] -translate-x-1/2 rounded-xl border border-rose-300/40 bg-rose-600/95 px-4 py-2 text-center font-semibold shadow-lg">
                    {error}
                </div>
            )}
        </div>
        </DragProvider>
    );
}
