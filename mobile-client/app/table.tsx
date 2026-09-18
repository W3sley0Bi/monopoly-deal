import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { BlurTargetView } from 'expo-blur';
import { FeltTable, type ChairAnchor, type SeatHit } from '../src/components/table/FeltTable';
import { tiltedChipScale } from '../src/game/feltLayout';
import { GlassPanel, TableGlassProvider } from '../src/components/table/TableGlass';

import { useGameConnectionContext, type UseGameConnection } from '../lib/net/messages';
import { useStore } from '../lib/store';
import { brand, ink, line, radius, status, surface } from '../lib/theme';
import { displayFont, ls, uiFont } from '../lib/fonts';
import { Btn, Icon, LabelCaps, Panel, Sheet, Toggle } from '../src/ui/kit';
import { PlayerChip, PropertySets } from '../src/components/board';
import { DragLayer, DropZone, useDragLayer } from '../src/game/drag';
import { ActionDialog } from '../src/components/table/ActionDialog';
import { ActiveBoard } from '../src/components/board/ActiveBoard';
import { useChatBubbles } from '../src/game/useChatBubbles';

const AUTO_END_MS = 2500;
import { PendingPanel } from '../src/components/table/PendingPanel';
import { ChatPanel } from '../src/components/table/ChatPanel';
import { TutorialCoach, TutorialDone, type TutorialAnchors } from '../src/components/table/TutorialCoach';
import { CountdownTimer } from '../src/components/table/CountdownTimer';
import { StartWheel } from '../src/components/table/StartWheel';
import { PlayerBoardRow, propertyDensityForLayout } from '../src/components/table/PlayerBoardRow';
import { GameSoundSettings } from '../src/components/settings/GameSoundSettings';
import { useI18n } from '../src/i18n';
import { useGameAudio } from '../src/game/useGameAudio';
import { FIXTURES } from '../src/dev/fixtures';
import {
    assets,
    colorMeta,
    isPlayableAction,
    isYourTurn,
    myTarget,
    dropTargets,
    needsTargeting,
    opponents,
    playableColors,
    you as youOf,
} from '../src/game/meta';
import { HandFan } from '../src/components/table/HandFan';
import { Card } from '../src/ui/card';
import { applyOptimistic, moveSettled, type PendingMove } from '../src/game/optimistic';
import type { Card as CardT, ChatMessage, Color, RoomView, TutorialState } from '../src/types';
import type { ActionDialogIntent, PendingViewerRole } from '../lib/contracts';

const EMPTY_CHAT: ChatMessage[] = [];

/**
 * A remote player's chip where it stands at the tilted table's edge, at its
 * base size. Fixed, because the felt reserves this much room beside each chair
 * before it sizes the ring — a chip that grew with its content would land on
 * the cards. Laid out at the width where every figure fits (narrower, the
 * chip's own type scale truncated "$0M" to "$…"), then drawn smaller whole,
 * so the reserved box and the drawn chip can never disagree.
 */
const CHAIR_CHIP = { w: 150, h: 78 };

export default function TableScreen() {
    // The body has to live inside the layer to read what is being carried.
    return (
        <DragLayer>
            <TableBody />
        </DragLayer>
    );
}

function TableBody() {
    const { t, tCard, tLog } = useI18n();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const feltTarget = useRef<View>(null);
    const tableRootRef = useRef<View>(null);
    const handTutorialRef = useRef<View>(null);
    const propertiesTutorialRef = useRef<View>(null);
    const bankTutorialRef = useRef<View>(null);
    const actionTutorialRef = useRef<View>(null);
    const endTurnTutorialRef = useRef<View>(null);
    const tutorialCardRef = useRef<View>(null);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    // A landscape phone can be wider than a portrait tablet. Native devices
    // therefore qualify by their short edge; the web also supports a wide,
    // short desktop window.
    const roomyPlayerStation = Math.min(windowWidth, windowHeight) >= 600 ||
        (Platform.OS === 'web' && windowWidth >= 900);
    // The felt belongs to the viewport, not to the accordion's remaining space.
    // Just the rail now (~64, the chips being one row shorter) plus the top
    // padding. It has to clear the rail rather than merely start near it: the
    // rail is a ScrollView and would take the taps meant for the seats beneath.
    // Roomy screens seat the chips at the table itself, so there is no rail
    // to clear and the felt starts at the top.
    const feltTop = insets.top + (roomyPlayerStation ? 8 : 72);
    const feltHeight = Math.max(180, windowHeight - feltTop - insets.bottom - 60);
    const { room: live, send, leave, notice, skewMs } = useGameConnectionContext();
    const dragLayer = useDragLayer();
    const audio = useGameAudio(live?.game ?? null);

    const tapTray = useStore((s) => s.tapTray);
    const setTapTray = useStore((s) => s.setTapTray);
    const setDevRoom = useStore((s) => s.setDevRoom);
    const livePlay = useStore((s) => s.livePlay);
    const setLivePlay = useStore((s) => s.setLivePlay);
    const motion = useStore((s) => s.motion);
    const setMotion = useStore((s) => s.setMotion);
    const setTutorialDone = useStore((s) => s.setTutorialDone);

    const [guess, setGuess] = useState<PendingMove | null>(null);
    const [sent, setSent] = useState<string | null>(null);
    const [selected, setSelected] = useState<CardT | null>(null);
    const [dialog, setDialog] = useState<{ card: CardT; intent: ActionDialogIntent; fromColor?: Color } | null>(null);
    const [wildColor, setWildColor] = useState<Record<string, Color>>({});
    const [talk, setTalk] = useState(false);
    const [logOpen, setLogOpen] = useState(false);
    const [menu, setMenu] = useState(false);
    const [sheetPlayer, setSheetPlayer] = useState<string | null>(null);
    const [bankOpen, setBankOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);
    const [seatHits, setSeatHits] = useState<SeatHit[]>([]);
    const [chairs, setChairs] = useState<ChairAnchor[]>([]);
    // Where your own panels start. The seat hit layer is clipped to stop above
    // it: your controls always win a contested touch.
    const [localTop, setLocalTop] = useState<number | null>(null);
    // The tilted ring is fitted to the felt between the top and your own
    // board, which on a roomy screen is a fixed-height row — measured, so the
    // near chair never slides under it.
    const chipScale = tiltedChipScale(windowWidth, windowHeight);
    const chairChip = useMemo(
        () => ({ w: CHAIR_CHIP.w * chipScale, h: CHAIR_CHIP.h * chipScale }),
        [chipScale],
    );
    const cardAreaHeight = roomyPlayerStation && localTop !== null
        ? Math.max(160, localTop - feltTop - 4)
        : Math.max(120, feltHeight * 0.55);
    // Dev only: paints the seat tap targets and the overlay band they live in.
    const [showHits, setShowHits] = useState(false);
    const [copied, setCopied] = useState(false);
    const [tutorialNext, setTutorialNext] = useState(false);
    const [tutorialAnchors, setTutorialAnchors] = useState<TutorialAnchors>({});

    // `onLayout` is relative to each component's immediate parent. The coach
    // is a root overlay, so adding nested layout values eventually points at
    // a different card or the top of the screen. Measure both nodes in window
    // space and translate once into the overlay's coordinate system instead.
    const recordTutorialAnchor = useCallback((key: keyof TutorialAnchors, target: View | null) => {
        const root = tableRootRef.current;
        if (!root || !target) return;
        target.measureInWindow((x, y, width, height) => {
            if (!width || !height) return;
            root.measureInWindow((rootX, rootY) => {
                const next = { x: x - rootX, y: y - rootY, width, height };
                setTutorialAnchors((current) =>
                    sameRect(current[key], next) ? current : { ...current, [key]: next },
                );
            });
        });
    }, []);

    const measureTutorialAnchors = useCallback(() => {
        recordTutorialAnchor('hand', handTutorialRef.current);
        recordTutorialAnchor('properties', propertiesTutorialRef.current);
        recordTutorialAnchor('bank', bankTutorialRef.current);
        recordTutorialAnchor('action', actionTutorialRef.current);
        recordTutorialAnchor('controls', endTurnTutorialRef.current);
        recordTutorialAnchor('card', tutorialCardRef.current);
    }, [recordTutorialAnchor]);

    useEffect(() => {
        if (!live) router.replace('/');
        else if (live.game.state === 'waiting') router.replace('/lobby');
    }, [live, router]);

    // A prediction that the server never confirms has to expire, or a refused
    // move would leave the table permanently lying to the player.
    useEffect(() => {
        if (!guess) return;
        const timer = setTimeout(() => setGuess(null), 4000);
        return () => clearTimeout(timer);
    }, [guess]);

    useEffect(() => {
        if (!sent) return;
        const timer = setTimeout(() => setSent(null), 1400);
        return () => clearTimeout(timer);
    }, [sent]);

    useEffect(() => {
        setTutorialNext(false);
        setSelected(null);
        setSent(null);
        setTutorialAnchors((current) => ({ ...current, card: undefined }));
    }, [live?.game.tutorial?.step]);

    // Completion is durable as soon as the server finishes the scripted
    // table, even if the app backgrounds before the six-second exit runs.
    useEffect(() => {
        if (live?.game.state === 'finished' && live.game.mode === 'tutorial') {
            setTutorialDone(true);
        }
    }, [live?.game.mode, live?.game.state, setTutorialDone]);

    // Retire the prediction the moment the real state agrees with it.
    useEffect(() => {
        if (live && guess && moveSettled(live, guess)) setGuess(null);
    }, [live, guess]);

    const room: RoomView | null = useMemo(() => {
        if (!live) return null;
        return guess ? applyOptimistic(live, guess) : live;
    }, [live, guess]);

    const tutorialSourceCardId = useMemo(() => {
        const tutorial = room?.game.tutorial ?? null;
        const me = room ? youOf(room.game) : null;
        if (!tutorial || !tutorial.task || tutorial.done || !me?.hand) return null;
        return me.hand.find((card) => card.id !== sent && tutorialAllowsCard(card, tutorial))?.id ?? null;
    }, [room, sent]);

    useEffect(() => {
        if (!tutorialSourceCardId) {
            setTutorialAnchors((current) =>
                current.card ? { ...current, card: undefined } : current,
            );
            return;
        }
        // The whole hand is visible, but the fan's transforms settle after its
        // layout pass. Measure on the next two frames so the tutorial ring is
        // attached to the card's final tilted position.
        let second: ReturnType<typeof requestAnimationFrame> | null = null;
        const first = requestAnimationFrame(() => {
            second = requestAnimationFrame(measureTutorialAnchors);
        });
        return () => {
            cancelAnimationFrame(first);
            if (second !== null) cancelAnimationFrame(second);
        };
    }, [measureTutorialAnchors, tutorialSourceCardId, live?.game.tutorial?.step]);

    const ownTurn = room ? isYourTurn(room.game) : false;
    const hasPending = Boolean(room?.game.pending);
    const [boardOpen, setBoardOpen] = useState(true);
    const [handOpen, setHandOpen] = useState(true);
    // Measured rather than derived from the window: the fan lays its rows out
    // to an exact width, and guessing the panel's padding wrong pushes the
    // outermost cards under the panel's clip.
    const [fanWidth, setFanWidth] = useState(0);
    // Bubbles carry what players *said*. What they did is on the felt and in
    // the log; narrating it over their head as well made the table chatter.
    const said = useChatBubbles(room?.chat ?? EMPTY_CHAT, room?.id);
    useEffect(() => { setBoardOpen(ownTurn); }, [ownTurn, room?.id]);
    useEffect(() => { setHandOpen(ownTurn || hasPending); }, [ownTurn, hasPending, room?.id]);

    const act = useCallback(
        (msg: Parameters<typeof send>[0], cardId?: string, optimistic?: PendingMove) => {
            audio.play('tap');
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (cardId) setSent(cardId);
            if (optimistic) setGuess(optimistic);
            setSelected(null);
            setDialog(null);
            send(msg);
        },
        [audio, send],
    );

    const leaveTutorial = useCallback(() => {
        setTutorialDone(true);
        leave();
    }, [leave, setTutorialDone]);

    // Leaving clears `room` before the router replaces this screen. Keep this
    // hook above the empty-room return so that transition never changes the
    // number of hooks rendered by TableBody.
    const autoEndLeft = useAutoEndTurn(room, sent, skewMs, send);

    if (!room) return null;

    const g = room.game;
    const me = youOf(g);
    const rivals = opponents(g);
    const pending = g.pending;
    const tutorial = g.tutorial ?? null;
    const tutorialActive = g.mode === 'tutorial' && Boolean(tutorial);
    const spectating = !room.you_seated || !me;
    const myTurn = isYourTurn(g);
    const canPlay = myTurn && !pending && g.plays_left > 0 && (!tutorial || (tutorial.task && !tutorial.done));
    const hand = (me?.hand ?? []).filter((c) => c.id !== sent);
    const cardEnabled = (card: CardT) => canPlay && tutorialAllowsCard(card, tutorial) &&
        (!tutorial || card.id === tutorialSourceCardId);
    const handFanWidth = fanWidth || windowWidth - 34;
    const overLimit = (me?.hand?.length ?? 0) > 7;

    // The deck offers Pass Go when playing one is legal right now — `canPlay`
    // already carries the turn, the plays left and the pending check, and
    // `hand` has dropped anything already sent. Not during the tutorial: the
    // coach is pointing at the move it wants, and a second thing pulsing for
    // attention argues with it.
    const passGo = !tutorialActive && canPlay
        ? hand.find((c) => c.action === 'pass_go') ?? null
        : null;

    const target = myTarget(g);
    const role: PendingViewerRole | null = !pending
        ? null
        : target
          ? pending.by_id === room.you
              ? 'blocked_instigator'
              : pending.kind === 'payment'
                ? 'payer'
                : 'target'
          : 'bystander';

    const lastEvent = [...g.log].reverse().find((e) => e.key !== 'log.turn' && e.key !== 'log.tutorial_lesson');
    const eventText = lastEvent ? tLog(lastEvent) : t('table.shared_space');

    function openCard(card: CardT) {
        const playable = canPlay && tutorialAllowsCard(card, tutorial) &&
            (!tutorial || card.id === tutorialSourceCardId);
        // Off-turn, a tap is only a peek: it pops the card clear of the fan so
        // it can be read. The coach is the exception — while it is pointing at
        // one card, popping another argues with it.
        if (!playable) {
            if (!tutorial) setSelected((prev) => (prev?.id === card.id ? null : card));
            return;
        }
        const colors = card.colors ?? [];

        // A two-colour wildcard aims itself by tapping — the player picks which
        // set it will join before committing to the move.
        if (card.type === 'property_wildcard' && colors.length === 2) {
            const current = wildColor[card.id] ?? colors[0];
            const next = colors[current === colors[0] ? 1 : 0];
            setWildColor((prev) => ({ ...prev, [card.id]: next }));
            setSelected(card);
            return;
        }
        setSelected((prev) => (prev?.id === card.id ? null : card));
    }

    function playAction(card: CardT) {
        if (needsTargeting(card)) {
            setDialog({ card, intent: 'action' });
            return;
        }
        act({ type: 'play_action', card_id: card.id }, card.id);
    }

    function placeProperty(card: CardT) {
        const colors = playableColors(card, g.colors);
        const chosen = wildColor[card.id] ?? (colors.length === 1 ? colors[0] : null);
        if (!chosen) {
            setDialog({ card, intent: 'property' });
            return;
        }
        act({ type: 'play_property', card_id: card.id, color: chosen }, card.id, {
            type: 'play_property',
            cardId: card.id,
            color: chosen,
        });
    }

    // Which zones light up, decided from the card in the air. The spec is
    // explicit that this is settled the instant the card leaves the hand and
    // never re-aimed mid-drag — a target that moves under a thumb is worse
    // than a small one.
    const carried = dragLayer.dragging;
    const boardShown = roomyPlayerStation || boardOpen || Boolean(carried);
    const handShown = roomyPlayerStation || handOpen || carried?.from === 'hand';
    const turnPlayer = g.players[g.current_turn % g.players.length];
    const carriedCard = carried?.card ?? null;
    const carriedTargets = carriedCard ? dropTargets(carriedCard, g.colors) : null;

    const propertyActive =
        !!carried && canPlay && tutorialAllowsZone(tutorial, 'properties') &&
        (carried.from === 'board' || !!carriedTargets?.colors.length);
    const bankActive = !!carried && canPlay && tutorialAllowsZone(tutorial, 'bank') &&
        carried.from === 'hand' && !!carriedTargets?.bankable;
    const actionActive =
        !!carried && canPlay && tutorialAllowsZone(tutorial, 'action') &&
        carried.from === 'hand' && !!carriedCard && isPlayableAction(carriedCard);

    // The eligible zone still leans towards the thumb, but the other one keeps
    // enough width to stay readable — a crushed tile looked broken, not inert.
    const growFor = (active: boolean) => (!carried ? 1 : active ? 1.45 : 0.55);

    const payable = me
        ? assets(me).map((a) => ({ card: a.card, source: (a.fromColor ?? 'bank') as 'bank' | Color }))
        : [];

    const renderTurnControls = (roomy: boolean) => (
        <GlassPanel style={[styles.controls, roomy && styles.controlsRoomy]}>
            {roomy ? (
                <View style={styles.controlToolsRoomy}>
                    <Pressable disabled={tutorialActive} onPress={() => setMenu(true)} style={({ pressed }) => [styles.talkBtn, styles.talkBtnRoomy, tutorialActive && styles.controlDisabled, pressed && styles.talkBtnPressed]} accessibilityRole="button" accessibilityLabel={t('table.menu')}>
                        <Icon name="gearshape.fill" fallback="☰" size={16} color={ink.muted60} />
                    </Pressable>
                    <Pressable disabled={tutorialActive} onPress={() => setLogOpen(true)} style={({ pressed }) => [styles.talkBtn, styles.talkBtnRoomy, tutorialActive && styles.controlDisabled, pressed && styles.talkBtnPressed]} accessibilityRole="button" accessibilityLabel={t('panel.log')}>
                        <Icon name="list.bullet.rectangle" fallback="≡" size={16} color={ink.muted60} />
                    </Pressable>
                    <Pressable disabled={tutorialActive} onPress={() => setTalk(true)} style={({ pressed }) => [styles.talkBtn, styles.talkBtnRoomy, tutorialActive && styles.controlDisabled, pressed && styles.talkBtnPressed]} accessibilityRole="button" accessibilityLabel={t('panel.chat')}>
                        <Icon name="bubble.left.and.bubble.right.fill" fallback="…" size={16} color={ink.muted60} />
                    </Pressable>
                </View>
            ) : (
                <>
                    <Pressable disabled={tutorialActive} onPress={() => setMenu(true)} style={({ pressed }) => [styles.talkBtn, tutorialActive && styles.controlDisabled, pressed && styles.talkBtnPressed]} accessibilityRole="button" accessibilityLabel={t('table.menu')}>
                        <Icon name="gearshape.fill" fallback="☰" size={18} color={ink.muted60} />
                    </Pressable>
                    <Pressable disabled={tutorialActive} onPress={() => setLogOpen(true)} style={({ pressed }) => [styles.talkBtn, tutorialActive && styles.controlDisabled, pressed && styles.talkBtnPressed]} accessibilityRole="button" accessibilityLabel={t('panel.log')}>
                        <Icon name="list.bullet.rectangle" fallback="≡" size={18} color={ink.muted60} />
                    </Pressable>
                </>
            )}

            <View style={[styles.turnChip, roomy && styles.turnChipRoomy]}>
                <Text style={styles.turnText} numberOfLines={1}>
                    {spectating
                        ? t('table.watching')
                        : myTurn
                          ? t('table.your_turn')
                          : t('table.turn_of', {
                                name: g.players[g.current_turn % g.players.length]?.name ?? '',
                            })}
                </Text>
                {myTurn ? <View style={styles.plays} accessibilityLabel={`${t('table.plays_hint')}: ${g.plays_left}`}>
                    {Array.from({ length: 3 }, (_, i) => <View key={i} style={[styles.play, i < g.plays_left && styles.playLeft]} />)}
                </View> : null}
            </View>

            {g.deadline_kind !== 'respond' ? (
                <CountdownTimer
                    deadlineMs={g.deadline_ms}
                    totalSeconds={g.deadline_seconds}
                    skewMs={skewMs}
                    kind={g.deadline_kind === 'starting' ? 'starting' : 'turn'}
                    compact={roomy}
                />
            ) : null}

            {!roomy ? (
                <Pressable disabled={tutorialActive} onPress={() => setTalk(true)} style={({ pressed }) => [styles.talkBtn, tutorialActive && styles.controlDisabled, pressed && styles.talkBtnPressed]} accessibilityRole="button" accessibilityLabel={t('panel.chat')}>
                    <Icon name="bubble.left.and.bubble.right.fill" fallback="…" size={18} color={ink.muted60} />
                </Pressable>
            ) : null}

            {myTurn && !pending && !spectating ? (
                <View
                    ref={endTurnTutorialRef}
                    collapsable={false}
                    onLayout={() => recordTutorialAnchor('controls', endTurnTutorialRef.current)}
                    style={roomy ? styles.endTurnRoomyWrap : undefined}
                >
                    <Btn
                        label={autoEndLeft > 0 ? t('table.auto_end', { seconds: autoEndLeft }) : t('table.end_turn')}
                        variant="red"
                        disabled={Boolean(tutorial && (tutorial.id !== 'end_turn' || tutorial.done))}
                        onPress={() => act({ type: 'end_turn' })}
                        style={[styles.endTurn, roomy && styles.endTurnRoomy]}
                    />
                </View>
            ) : null}
        </GlassPanel>
    );

    return (
        <TableGlassProvider target={feltTarget}>
        {/* The bar is a floating pill now, so it sits in the home-indicator
            gutter rather than above it — the indicator is its bottom padding. */}
        <View
            ref={tableRootRef}
            collapsable={false}
            onLayout={measureTutorialAnchors}
            style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: Math.max(6, insets.bottom - 14) }]}
        >
            <BlurTargetView ref={feltTarget} pointerEvents="box-none" style={[styles.feltBackground, { top: feltTop, height: feltHeight }]}>
                <FeltTable
                    players={g.players}
                    you={room.you}
                    layoutKey={`${room.id}:${g.start_id || g.starts_at_ms || 'match'}`}
                    cardAreaHeight={cardAreaHeight}
                    deckCount={g.deck_count}
                    discardCount={g.discard_count}
                    discardTop={g.discard_top}
                    onOpenDiscard={() => {
                        if (!tutorialActive) setDiscardOpen(true);
                    }}
                    onDrawTwo={
                        passGo ? () => act({ type: 'play_action', card_id: passGo.id }, passGo.id) : undefined
                    }
                    turnId={turnPlayer?.id}
                    playsLeft={g.plays_left}
                    onSeats={setSeatHits}
                    debugSeats={showHits}
                    tilted={roomyPlayerStation}
                    chip={roomyPlayerStation ? chairChip : undefined}
                    onChairs={setChairs}
                />
            </BlurTargetView>
            {notice ? (
                <Text style={styles.notice}>{notice.key ? t(notice.key, notice.args) : notice.text}</Text>
            ) : null}

            {/* ---- opponents ----
                A row, not a rail: four opponents is the most this game can seat
                (`game.MaxPlayers` is five), and they all belong on screen at
                once. Scrolling hid a player behind a gesture, which is a poor
                way to learn somebody just completed a set. */}
            {!roomyPlayerStation ? <View style={styles.opponentRail}>
                {rivals.map((p) => {
                    const isTurn = g.players[g.current_turn % g.players.length]?.id === p.id;
                    return (
                        <View
                            key={p.id}
                            style={styles.railSlot}
                        >
                            <PlayerChip
                                player={p}
                                isTurn={isTurn}
                                isTargeted={!!pending?.targets?.some((x) => !x.settled && x.player_id === p.id)}
                                isOwner={p.id === room.owner_id}
                                isYou={false}
                                playBubbleText={said[p.id]?.text ?? null}
                                onPress={() => {
                                    if (!tutorialActive) setSheetPlayer(p.id);
                                }}
                            />
                        </View>
                    );
                })}
            </View> : null}

            {/* This space grows above the local sections, keeping them bottom-anchored. */}
            <View pointerEvents="box-none" style={styles.sharedTable}>
            {/* Live play: the whole of someone else's turn, full size, over the
                table. Opt-in — it is a large panel over the felt, and it covers
                the very seats it is describing. */}
            {livePlay && turnPlayer && turnPlayer.id !== me?.id && !myTurn ? (
                <ActiveBoard key={turnPlayer.id} player={turnPlayer} onOpen={() => setSheetPlayer(turnPlayer.id)} />
            ) : null}

            {/* ---- what just happened ---- */}
            {/* Not interactive, and it sits directly over the far seats: left
                tappable it swallowed every tap and long-press aimed at the two
                piles across the table. */}
            {!roomyPlayerStation || !me ? (
                <Text pointerEvents="none" style={styles.event} numberOfLines={2} accessibilityLiveRegion="polite">
                    {eventText}
                </Text>
            ) : null}
            </View>

            {me ? <>
            <PlayerBoardRow
                roomy={roomyPlayerStation}
                expanded={boardShown}
                onLayout={(e) => setLocalTop(e.nativeEvent.layout.y)}
            >
            {/* ---- my board ---- */}
            <GlassPanel
                style={[styles.board, roomyPlayerStation && styles.boardRoomy, !boardShown && styles.boardFolded]}
            >
                <Pressable style={({ pressed }) => [styles.boardHead, styles.foldHead, pressed && styles.foldHeadPressed]} accessibilityRole="button"
                    accessibilityState={{ expanded: boardShown }} disabled={roomyPlayerStation || !!carried || tutorialActive}
                    accessibilityLabel={t(boardShown ? 'table.board_fold' : 'table.board_unfold')}
                    onPress={() => {
                        void Haptics.selectionAsync();
                        setBoardOpen(open => !open);
                    }}>
                    {roomyPlayerStation ? (
                        <>
                            <View style={styles.boardHeaderLabelRoomy}>
                                <LabelCaps>{t('table.your_properties')}</LabelCaps>
                            </View>
                            <Text
                                pointerEvents="none"
                                style={[styles.event, styles.boardEvent]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                accessibilityLiveRegion="polite"
                            >
                                {eventText}
                            </Text>
                            <Text style={[styles.progress, styles.boardProgressRoomy]}>
                                {t('table.sets_progress', { done: me?.complete_sets ?? 0 })}
                            </Text>
                        </>
                    ) : (
                        <>
                            <LabelCaps>{t('table.your_properties')}</LabelCaps>
                            {!boardShown ? <View style={[styles.swatches, styles.inlineSwatches]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                                {me?.sets.map(set => <View key={set.color} style={[styles.swatch, { backgroundColor: colorMeta(set.color).hex, flex: set.cards.length, opacity: set.complete ? 1 : 0.55 }]} />)}
                            </View> : null}
                            <Text style={styles.progress}>
                                {t('table.sets_progress', { done: me?.complete_sets ?? 0 })}
                            </Text>
                            <DisclosureIcon expanded={boardShown} />
                        </>
                    )}
                </Pressable>
                <DropZone
                    id="properties"
                    targetRef={propertiesTutorialRef}
                    active={propertyActive}
                    grow={1}
                    hint={t('table.play_it')}
                    onLayout={() => recordTutorialAnchor('properties', propertiesTutorialRef.current)}
                    onDrop={(card) => {
                        // A board wildcard has no single obvious destination, so
                        // dropping it asks which set rather than guessing.
                        if (carried?.from === 'board') {
                            setDialog({ card, intent: 'move', fromColor: carried.fromColor });
                            return;
                        }
                        placeProperty(card);
                    }}
                    style={[styles.propertyZone, !boardShown && styles.hidden]}
                >
                <ScrollView style={styles.boardScroll}>
                    <PropertySets
                        sets={me?.sets ?? []}
                        size="propertyZone"
                        density={propertyDensityForLayout(roomyPlayerStation, me?.sets.length ?? 0)}
                        onCardPress={
                            canPlay && !tutorial
                                ? (card, set) => {
                                      if (card.type === 'property_wildcard') {
                                          setDialog({ card, intent: 'move', fromColor: set.color });
                                      }
                                  }
                                : undefined
                        }
                    />
                </ScrollView>
                </DropZone>

            </GlassPanel>

                {/* The two landing places a card can go that are not a set. */}
                <View style={[styles.dropRow, roomyPlayerStation && styles.dropRowRoomy]}>
                    <DropZone
                        id="bank"
                        targetRef={bankTutorialRef}
                        glass
                        active={bankActive}
                        grow={roomyPlayerStation ? 1 : growFor(bankActive)}
                        hint={t('table.bank_drop', { amount: carriedCard?.value ?? 0 })}
                        onDrop={(card) =>
                            act({ type: 'play_bank', card_id: card.id }, card.id, {
                                type: 'play_bank',
                                cardId: card.id,
                            })
                        }
                        onLayout={() => recordTutorialAnchor('bank', bankTutorialRef.current)}
                        style={styles.zoneTile}
                    >
                        {/* Tapping the tile opens the pile; dragging still drops
                            onto it, because the drag gesture lives on the card. */}
                        <Pressable
                            style={styles.zoneHead}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('table.bank')}: ${t('table.bank_cards', { count: me?.bank.length ?? 0 })}`}
                            disabled={!!carried || tutorialActive}
                            onPress={() => {
                                void Haptics.selectionAsync();
                                setBankOpen(true);
                            }}
                        >
                            <ZoneGlyph name="banknote" fallback="$" />
                            <View style={styles.zoneText}>
                                <LabelCaps>{t('table.bank')}</LabelCaps>
                                <Text style={styles.zoneMeta} numberOfLines={1}>
                                    {t('table.bank_cards', { count: me?.bank.length ?? 0 })}
                                </Text>
                            </View>
                            <Text style={styles.bankTotal}>${me?.bank_total ?? 0}M</Text>
                        </Pressable>
                    </DropZone>

                    {/* Action is intentionally hidden on roomy screens for now.
                        Phones retain the native drop target and its mechanics. */}
                    {!roomyPlayerStation ? (
                        <DropZone
                            id="action"
                            targetRef={actionTutorialRef}
                            glass
                            active={actionActive}
                            grow={growFor(actionActive)}
                            hint={t('table.play_it')}
                            onDrop={(card) => playAction(card)}
                            onLayout={() => recordTutorialAnchor('action', actionTutorialRef.current)}
                            style={styles.zoneTile}
                        >
                            <View style={styles.zoneHead}>
                                <ZoneGlyph name="sparkles" fallback="✦" />
                                <View style={styles.zoneText}>
                                    <LabelCaps>{t('table.action_space')}</LabelCaps>
                                    <Text style={styles.zoneMeta} numberOfLines={1}>{t('table.action_hint')}</Text>
                                </View>
                            </View>
                        </DropZone>
                    ) : null}
                </View>
            </PlayerBoardRow>

            {/* ---- hand ---- */}
            <View style={roomyPlayerStation ? styles.roomyHandRow : undefined}>
                <GlassPanel
                    targetRef={handTutorialRef}
                    withGlass={!roomyPlayerStation}
                    style={[
                        styles.handZone,
                        roomyPlayerStation && styles.handZoneRoomy,
                    ]}
                    onLayout={() => recordTutorialAnchor('hand', handTutorialRef.current)}
                >
                {/* The hand folds like the board does, and a bare header row did
                    not read as something you could collapse. */}
                {!roomyPlayerStation ? <View style={styles.grabberRow} pointerEvents="none">
                    <View style={styles.grabber} />
                </View> : null}
                {!roomyPlayerStation ? <Pressable style={({ pressed }) => [styles.handHead, styles.foldHead, pressed && styles.foldHeadPressed]} accessibilityRole="button"
                    accessibilityState={{ expanded: handShown }} disabled={!!carried || tutorialActive}
                    accessibilityLabel={t(handShown ? 'table.hand_fold' : 'table.hand_unfold')}
                    onPress={() => {
                        void Haptics.selectionAsync();
                        setHandOpen(open => !open);
                        setSelected(null);
                    }}>
                    <LabelCaps>{t('table.hand', { count: hand.length })}</LabelCaps>
                {!handShown ? <View style={[styles.swatches, styles.inlineSwatches]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {hand.map(card => <View key={card.id} style={[styles.swatch, { backgroundColor: card.type === 'money' ? '#69cba5' : card.type === 'action' || card.type === 'rent' ? '#a855f7' : colorMeta(card.colors?.[0]).hex }]} />)}
                </View> : null}
                    {overLimit ? (
                        <Text style={styles.overLimit} numberOfLines={2}>{t('table.over_limit', { count: hand.length - 7 })}</Text>
                    ) : handShown ? (
                        <Text style={styles.handHint} numberOfLines={2}>
                            {t(tapTray ? 'table.hand_tap' : 'table.hand_drag_only')}
                        </Text>
                    ) : null}
                    <DisclosureIcon expanded={handShown} />
                </Pressable> : null}


                <View
                    style={[styles.handFan, !handShown && styles.hidden]}
                    onLayout={(e) => {
                        setFanWidth(e.nativeEvent.layout.width - 12);
                        measureTutorialAnchors();
                    }}
                    // Capture runs top-down, before any child can claim the
                    // touch, so this reports a touch that reaches the hand even
                    // when nothing in the hand ends up answering it. Returning
                    // false leaves the touch to the strips.
                    onStartShouldSetResponderCapture={showHits ? (e) => {
                        const { locationX, locationY, pageX, pageY } = e.nativeEvent;
                        // eslint-disable-next-line no-console
                        console.log(
                            `[hand] touch at local ${Math.round(locationX)},${Math.round(locationY)}`,
                            `page ${Math.round(pageX)},${Math.round(pageY)}`,
                            `fan width ${Math.round(handFanWidth)}`,
                        );
                        return false;
                    } : undefined}
                >
                    <HandFan
                        cards={hand}
                        width={handFanWidth}
                        selectedId={selected?.id ?? null}
                        carriedId={carriedCard?.id ?? null}
                        wildColor={wildColor}
                        isPlayable={cardEnabled}
                        onTapCard={openCard}
                        onDragStart={() => setSelected(null)}
                        debug={showHits}
                        anchorCardId={tutorialSourceCardId}
                        anchorRef={tutorialCardRef}
                        onAnchorLayout={() => requestAnimationFrame(() =>
                            recordTutorialAnchor('card', tutorialCardRef.current),
                        )}
                        scale={roomyPlayerStation ? 1.18 : 1}
                    />
                    {hand.length === 0 ? <Text style={styles.handHint}>{t('table.hand_empty')}</Text> : null}
                </View>
                </GlassPanel>
                {roomyPlayerStation ? renderTurnControls(true) : null}
            </View>

            </> : null}

            {/* ---- what can I do with the tapped card ---- */}
            {/* The options tray. Opt-in: dragging a card where it goes is the
                gesture the table is built around, and the tray covers the felt
                to say the same thing in buttons. */}
            {(tapTray || tutorial?.id === 'tapping') && selected && handShown && canPlay ? (
                <Panel style={[styles.tray, roomyPlayerStation && styles.playerStationRoomy]}>
                    <Text style={styles.trayTitle} numberOfLines={1}>
                        {tCard(selected)}
                    </Text>
                    <View style={styles.trayRow}>
                        {(selected.type === 'property' || selected.type === 'property_wildcard') && (
                            <Btn
                                label={t('table.place_property')}
                                variant="gold"
                                onPress={() => placeProperty(selected)}
                                style={styles.flex}
                            />
                        )}
                        {selected.type !== 'property' && selected.type !== 'property_wildcard' && (
                            <Btn
                                label={t('table.bank_card', { amount: selected.value })}
                                variant="blue"
                                onPress={() =>
                                    act({ type: 'play_bank', card_id: selected.id }, selected.id, {
                                        type: 'play_bank',
                                        cardId: selected.id,
                                    })
                                }
                                style={styles.flex}
                            />
                        )}
                        {isPlayableAction(selected) && (
                            <Btn
                                label={selected.type === 'rent' ? t('table.charge_rent') : t('table.play_action')}
                                variant="gold"
                                onPress={() => playAction(selected)}
                                style={styles.flex}
                            />
                        )}
                        <Btn label={t('common.close')} onPress={() => setSelected(null)} />
                    </View>
                    {selected.action === 'just_say_no' ? (
                        <Text style={styles.trayHint}>{t('table.just_say_no_hint')}</Text>
                    ) : null}
                    {selected.action === 'double_rent' ? (
                        <Text style={styles.trayHint}>{t('table.double_rent_hint')}</Text>
                    ) : null}
                </Panel>
            ) : null}

            {/* The compact, horizontal turn bar remains mobile-only. Roomy
                screens place the same controls beside the hand. */}
            {!roomyPlayerStation ? renderTurnControls(false) : null}

            {/* ---- seat taps ----
                Above every panel, deliberately. The piles are painted inside
                the felt, which is the first child of the screen and therefore
                the bottom layer: anything the layout puts over the middle of
                the table — the event line, an opponent's board panel, the
                shared-table spacer — took the touch first and the piles simply
                did not answer. These are the same rectangles, last in the tree.
                `box-none`, so only the rectangles themselves catch anything. */}
            <View
                pointerEvents={tutorialActive ? 'none' : 'box-none'}
                style={[
                    styles.feltBackground,
                    {
                        top: feltTop,
                        // Stops short of your own board. A seat rectangle that
                        // reached under the properties header took the tap that
                        // was meant to open it — the far seats are scenery, your
                        // own controls are the game.
                        height: localTop === null
                            ? feltHeight
                            : Math.max(60, Math.min(feltHeight, localTop - feltTop - 6)),
                    },
                    showHits && styles.hitBand,
                    styles.clip,
                ]}
            >
                {seatHits.map((seat) => (
                    <SeatTap
                        key={seat.id}
                        style={[
                            { position: 'absolute', left: seat.x, top: seat.y, width: seat.w, height: seat.h },
                            showHits && styles.hitBox,
                        ]}
                        label={showHits ? `${seat.name} ${Math.round(seat.x)},${Math.round(seat.y)}` : undefined}
                        accessibilityLabel={`${seat.name}: ${t('inspect.open_board')}`}
                        onOpen={() => setSheetPlayer(seat.id)}
                        onPreview={() => setSheetPlayer(seat.id)}
                        onPreviewEnd={() =>
                            setSheetPlayer((current) => (current === seat.id ? null : current))
                        }
                    />
                ))}

                {/* ---- opponents, at the table ----
                    Roomy screens stand each chip at its own chair, as the old
                    web table did: who a pile belongs to is where they sit, not
                    an entry in a list. Last, so a chip wins over a seat's tap
                    rectangle wherever the two touch. */}
                {roomyPlayerStation ? chairs.map((chair) => {
                    const p = g.players.find((x) => x.id === chair.id);
                    if (!p) return null;
                    const isTurn = turnPlayer?.id === p.id;
                    return (
                        <View
                            key={chair.id}
                            style={[styles.chair, {
                                left: chair.x + (chair.w - CHAIR_CHIP.w) / 2,
                                top: chair.y + (chair.h - CHAIR_CHIP.h) / 2,
                                width: CHAIR_CHIP.w,
                                height: CHAIR_CHIP.h,
                                transform: [{ scale: chipScale }],
                            }]}
                        >
                            <PlayerChip
                                player={p}
                                isTurn={isTurn}
                                isTargeted={!!pending?.targets?.some((x) => !x.settled && x.player_id === p.id)}
                                isOwner={p.id === room.owner_id}
                                isYou={false}
                                playBubbleText={said[p.id]?.text ?? null}
                                onPress={() => setSheetPlayer(p.id)}
                            />
                        </View>
                    );
                }) : null}
            </View>

            {/* ---- overlays ---- */}
            {dialog ? (
                <ActionDialog
                    open
                    intent={dialog.intent}
                    card={dialog.card}
                    fromColor={dialog.fromColor}
                    game={g}
                    you={room.you}
                    onClose={() => setDialog(null)}
                    onSubmit={(msg) => {
                        const optimistic: PendingMove | undefined =
                            msg.type === 'play_property'
                                ? { type: 'play_property', cardId: msg.card_id, color: msg.color }
                                : msg.type === 'move_wildcard'
                                  ? { type: 'move_wildcard', cardId: msg.card_id, color: msg.color }
                                  : undefined;
                        act(msg, msg.card_id, optimistic);
                    }}
                />
            ) : null}

            {pending && role ? (
                <PendingPanel
                    pending={pending}
                    role={role}
                    myTarget={target ?? null}
                    payableCards={role === 'payer' ? payable : undefined}
                    you={room.you}
                    deadlineMs={g.deadline_kind === 'respond' ? g.deadline_ms : 0}
                    deadlineSeconds={g.deadline_seconds}
                    skewMs={skewMs}
                    tutorialCopy={tutorial ? {
                        title: t(`lesson.${tutorial.id}.title`),
                        body: t(`lesson.${tutorial.id}.body`),
                        task: t(`lesson.${tutorial.id}.task`),
                        onSkip: leaveTutorial,
                    } : undefined}
                    onRespond={(msg) => act({ type: 'respond', ...msg })}
                />
            ) : null}

            <Sheet
                open={!!sheetPlayer}
                onClose={() => setSheetPlayer(null)}
                title={g.players.find((p) => p.id === sheetPlayer)?.name}
            >
                {(() => {
                    const p = g.players.find((x) => x.id === sheetPlayer);
                    if (!p) return null;
                    return (
                        <>
                            <Text style={styles.sheetStat}>
                                {t('board.bank')}: ${p.bank_total}M · {t('board.in_hand')}: {p.hand_count}
                            </Text>
                            <PropertySets sets={p.sets} size="propertyZone" />
                            {p.bank.length ? (
                                <>
                                    <LabelCaps>{t('board.bank')}</LabelCaps>
                                    <View style={styles.bankGrid}>
                                        {p.bank.map((card) => <Card key={card.id} card={card} size="bank" />)}
                                    </View>
                                </>
                            ) : null}
                        </>
                    );
                })()}
            </Sheet>

            <Sheet open={bankOpen} onClose={() => setBankOpen(false)} title={t('table.bank')}>
                <Text style={styles.sheetStat}>
                    ${me?.bank_total ?? 0}M · {t('table.bank_cards', { count: me?.bank.length ?? 0 })}
                </Text>
                {me?.bank.length ? (
                    <View style={styles.bankGrid}>
                        {me.bank.map((card) => <Card key={card.id} card={card} size="bank" />)}
                    </View>
                ) : (
                    <Text style={styles.trayHint}>{t('table.bank_empty')}</Text>
                )}
            </Sheet>

            <Sheet open={discardOpen} onClose={() => setDiscardOpen(false)} title={t('table.discard')}>
                <Text style={styles.sheetStat}>
                    {t('table.deck')}: {g.deck_count} · {t('table.discard_count', { count: g.discard_count })}
                </Text>
                {g.discard_top ? (
                    <View style={styles.bankGrid}>
                        <Card card={g.discard_top} size="bank" />
                    </View>
                ) : null}
            </Sheet>

            {/* `scroll={false}`: the chat scrolls itself, and a ScrollView
                inside the sheet's own would collapse its list to nothing. */}
            <Sheet open={talk} onClose={() => setTalk(false)} title={t('panel.chat')} scroll={false}>
                <ChatPanel
                    chat={room.chat}
                    you={room.you}
                    onSend={(text) => send({ type: 'chat', text })}
                />
            </Sheet>

            <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={t('panel.log')}>
                {g.log
                    .slice(-40)
                    .reverse()
                    .map((e, i) => (
                        <Text key={i} style={styles.logLine}>
                            {tLog(e)}
                        </Text>
                    ))}
            </Sheet>

            <Sheet open={menu} onClose={() => setMenu(false)} title={room.name || t('table.menu')}>
                <View style={styles.codeRow}>
                    <View style={styles.codeText}>
                        <LabelCaps>{t('invite.code')}</LabelCaps>
                        <Text style={styles.codeBig} selectable>{room.id}</Text>
                    </View>
                    <Pressable
                        onPress={async () => {
                            await Clipboard.setStringAsync(`deal://join/${room.id}`);
                            setCopied(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('invite.copy')}
                        style={({ pressed }) => [styles.talkBtn, pressed && styles.talkBtnPressed]}
                    >
                        <Icon name={copied ? 'checkmark' : 'doc.on.doc'} fallback={copied ? '✓' : '⧉'} size={16} color={copied ? brand.brass : ink.muted60} />
                    </Pressable>
                    <Pressable
                        onPress={() => Share.share({ message: `deal://join/${room.id}` })}
                        accessibilityRole="button"
                        accessibilityLabel={t('invite.open')}
                        style={({ pressed }) => [styles.talkBtn, pressed && styles.talkBtnPressed]}
                    >
                        <Icon name="square.and.arrow.up" fallback="↥" size={16} color={ink.muted60} />
                    </Pressable>
                </View>

                <GameSoundSettings />
                <Toggle
                    label={t('table.motion')}
                    value={motion}
                    onChange={(on) => {
                        void Haptics.selectionAsync();
                        setMotion(on);
                    }}
                />
                <Toggle
                    label={t('table.live_play')}
                    hint={t('table.live_play_hint')}
                    value={livePlay}
                    onChange={(on) => {
                        void Haptics.selectionAsync();
                        setLivePlay(on);
                    }}
                />
                <Toggle
                    label={t('table.tap_tray')}
                    hint={t('table.hand_drag_only')}
                    value={tapTray}
                    onChange={(on) => {
                        void Haptics.selectionAsync();
                        setTapTray(on);
                        if (!on) setSelected(null);
                    }}
                />
                {/* Leaving *is* quitting: a seat that walks away mid-hand ends
                    the game for everyone anyway, so the two buttons that used
                    to say that separately are one. */}
                <Btn
                    label={t('table.leave')}
                    variant="red"
                    onPress={() =>
                        Alert.alert(t('table.leave'), t('table.leave_confirm'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                                text: t('table.leave'),
                                style: 'destructive',
                                onPress: () => {
                                    setMenu(false);
                                    // Only the owner may end it; everyone else
                                    // just stands up and the server decides.
                                    if (room.is_owner && g.state === 'playing') {
                                        send({ type: 'terminate_game' });
                                    }
                                    leave();
                                },
                            },
                        ])
                    }
                />

                {/* Dev only: swap this table for a hand-built one. English on
                    purpose — these strings never reach a player. */}
                {__DEV__ ? (
                    <View style={styles.dev}>
                        <LabelCaps>Dev tables</LabelCaps>
                        <Btn
                            label={showHits ? 'Hide hitboxes' : 'Show hitboxes'}
                            onPress={() => {
                                setShowHits((on) => !on);
                                setMenu(false);
                            }}
                        />
                        {FIXTURES.map((fixture) => (
                            <Btn
                                key={fixture.id}
                                label={fixture.label}
                                onPress={() => {
                                    setDevRoom(fixture.build(room.you, me?.name ?? 'You'));
                                    setMenu(false);
                                }}
                            />
                        ))}
                        <Text style={styles.trayHint}>
                            Your moves apply locally; nobody else moves. Leave to go back.
                        </Text>
                    </View>
                ) : null}
            </Sheet>

            <TutorialCoach
                tutorial={tutorial}
                locked={Boolean(tutorial && !(tutorial.task && tutorial.done))}
                compact={Boolean(dialog || pending)}
                carrying={Boolean(carried)}
                paused={Boolean(selected && (tapTray || tutorial?.id === 'tapping'))}
                anchors={tutorialAnchors}
                screenWidth={windowWidth}
                screenHeight={windowHeight}
                safeTop={insets.top + 8}
                safeBottom={insets.bottom + 8}
                pendingNext={tutorialNext}
                onNext={() => {
                    setTutorialNext(true);
                    send({ type: 'tutorial_next' });
                }}
                onSkip={leaveTutorial}
            />

            {g.state === 'finished' && g.mode === 'tutorial' ? (
                <TutorialDone onLeave={leaveTutorial} />
            ) : null}

            {g.state === 'finished' && g.mode !== 'tutorial' ? (
                <View style={styles.winOverlay}>
                    <Text style={styles.winTitle}>
                        {g.winner_id === room.you
                            ? t('win.you')
                            : t('win.player', {
                                  name: g.players.find((p) => p.id === g.winner_id)?.name ?? t('win.someone'),
                              })}
                    </Text>
                    <View style={styles.winActions}>
                        {room.is_owner ? (
                            <Btn label={t('win.play_again')} variant="gold" onPress={() => send({ type: 'new_game' })} />
                        ) : null}
                        <Btn label={t('win.leave')} onPress={leave} />
                    </View>
                </View>
            ) : null}

            <StartWheel
                key={g.start_id || g.starts_at_ms || 'no-start'}
                game={g}
                skewMs={skewMs}
                onSpin={() => audio.play('spin')}
            />
        </View>
        </TableGlassProvider>
    );
}

function useAutoEndTurn(
    room: RoomView | null,
    sent: string | null,
    skewMs: number,
    send: UseGameConnection['send'],
): number {
    const sendRef = useRef(send);
    sendRef.current = send;
    const [secondsLeft, setSecondsLeft] = useState(0);

    const game = room?.game;
    const me = game ? youOf(game) : null;
    const handCount = (me?.hand ?? []).filter((card) => card.id !== sent).length;
    const startPending = Boolean(game?.starts_at_ms && Date.now() + skewMs < game.starts_at_ms);
    const autoEnd = Boolean(
        room &&
        game &&
        isYourTurn(game) &&
        !game.pending &&
        room.you_seated &&
        me &&
        !startPending &&
        game.state === 'playing' &&
        game.plays_left === 0 &&
        handCount <= 7
    );

    useEffect(() => {
        if (!autoEnd) {
            setSecondsLeft(0);
            return;
        }
        const until = Date.now() + AUTO_END_MS;
        setSecondsLeft(Math.ceil(AUTO_END_MS / 1000));
        const interval = setInterval(
            () => setSecondsLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000))),
            250,
        );
        const timer = setTimeout(() => sendRef.current({ type: 'end_turn' }), AUTO_END_MS);
        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, [autoEnd, game?.current_turn]);

    return secondsLeft;
}

/** Only the card a scripted lesson is teaching stays live. */
function tutorialAllowsCard(card: CardT, tutorial: TutorialState | null): boolean {
    if (!tutorial) return true;
    if (!tutorial.task || tutorial.done) return false;

    switch (tutorial.id) {
        case 'property':
        case 'tapping':
        case 'win':
            return card.type === 'property' || card.type === 'property_wildcard';
        case 'wildcard':
        case 'wildcard_any':
            return card.type === 'property_wildcard';
        case 'bank':
            return card.type === 'money';
        case 'rent':
        case 'double_rent':
            return card.type === 'rent';
        case 'pass_go':
        case 'sly_deal':
        case 'forced_deal':
        case 'deal_breaker':
        case 'house':
            return card.action === tutorial.id;
        default:
            return false;
    }
}

/** Destination gating is the native equivalent of the web tour's live holes. */
function tutorialAllowsZone(
    tutorial: TutorialState | null,
    zone: 'properties' | 'bank' | 'action',
): boolean {
    if (!tutorial) return true;
    if (!tutorial.task || tutorial.done) return false;
    if (zone === 'properties') {
        return ['property', 'wildcard', 'wildcard_any', 'tapping', 'win'].includes(tutorial.id);
    }
    if (zone === 'bank') return tutorial.id === 'bank';
    return ['pass_go', 'rent', 'double_rent', 'sly_deal', 'forced_deal', 'deal_breaker', 'house'].includes(tutorial.id);
}

function sameRect(a: LayoutRectangle | undefined, b: LayoutRectangle): boolean {
    if (!a) return false;
    return Math.abs(a.x - b.x) < 0.5 &&
        Math.abs(a.y - b.y) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5;
}

/**
 * One seat's tap target: a tap opens that player's board, a hold previews it
 * and releases back. Transparent — it sits over the pile painted on the felt.
 */
function SeatTap({ style, accessibilityLabel, label, onOpen, onPreview, onPreviewEnd }: {
    style: StyleProp<ViewStyle>;
    accessibilityLabel: string;
    /** Dev only: drawn inside the box so a hit target can be seen and named. */
    label?: string;
    onOpen: () => void;
    onPreview: () => void;
    onPreviewEnd: () => void;
}) {
    const holding = useRef(false);
    const suppressTap = useRef(false);

    return (
        <Pressable
            style={style}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            delayLongPress={260}
            onLongPress={() => {
                holding.current = true;
                suppressTap.current = true;
                onPreview();
            }}
            onPressOut={() => {
                if (!holding.current) return;
                holding.current = false;
                onPreviewEnd();
            }}
            onPress={() => {
                if (suppressTap.current) {
                    suppressTap.current = false;
                    return;
                }
                onOpen();
            }}
        >
            {label ? <Text style={styles.hitLabel} numberOfLines={1}>{label}</Text> : null}
        </Pressable>
    );
}

/** SF Symbol with a text fallback, sized for the drop-zone tiles. */
function ZoneGlyph({ name, fallback }: { name: string; fallback: string }) {
    return (
        <View style={styles.zoneGlyph} pointerEvents="none">
            <Icon name={name as never} fallback={fallback} size={14} color={ink.muted60} />
        </View>
    );
}

function DisclosureIcon({ expanded }: { expanded: boolean }) {
    return (
        <View style={styles.disclosure} pointerEvents="none">
            <Icon
                name={expanded ? 'chevron.down' : 'chevron.up'}
                fallback={expanded ? '⌄' : '⌃'}
                size={12}
                color={ink.muted60}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    feltBackground: { position: 'absolute', left: 0, right: 0 },
    root: { flex: 1, backgroundColor: surface.bodyBase, paddingHorizontal: 8, gap: 5 },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
    codeText: { flex: 1, gap: 1 },
    codeBig: { fontFamily: displayFont(900), fontSize: 20, color: brand.inviteCode, letterSpacing: ls(0.1, 20) },
    notice: { fontFamily: uiFont(700), fontSize: 12, color: status.danger },
    opponentRail: { flexGrow: 0, flexShrink: 0, flexDirection: 'row', gap: 5 },
    // Equal shares on mobile, and `minWidth: 0` so a long name shrinks the slot
    // instead of pushing its neighbours off the screen.
    railSlot: { flex: 1, minWidth: 0 },
    chair: { position: 'absolute', justifyContent: 'center' },
    // Gives up height faster than your own board does: when the tray opens, the
    // shared table is the part you are least likely to be reading.
    // Longhands for the same reason as `board`: `flex: 1` sets a shrink of its
    // own, so pairing it with `flexShrink` left the faster shrink to whichever
    // of the two the platform happened to apply last.
    sharedTable: { flexGrow: 1, flexShrink: 1.6, flexBasis: 0, minHeight: 104, gap: 5, justifyContent: 'flex-start', overflow: 'hidden' },
    playerStationRoomy: { width: '60%', alignSelf: 'center' },
    hidden: { display: 'none' },
    // What `flex: 0` means on native — grow 0, shrink 0, basis auto — written
    // out, so the folded board is sized by its header on both platforms.
    // `flex: 0` itself cannot be used here: react-native-web compiles each
    // flex prop to its own class, so layered over the board's growth it zeroed
    // the grow but kept `flex-basis: 0`, collapsing the panel to its padding
    // with the header clipped away inside it.
    boardFolded: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 0, paddingVertical: 3 },
    foldHead: {
        minHeight: 48,
        gap: 8,
        paddingHorizontal: 11,
        borderRadius: 16,
        borderCurve: 'continuous',
    },
    foldHeadPressed: { backgroundColor: '#d8fff00d' },
    disclosure: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d8fff012',
        borderWidth: 1,
        borderColor: '#d8fff01f',
    },
    swatches: { flexDirection: 'row', gap: 3, height: 6 },
    swatch: { flex: 1, borderRadius: 3 },
    inlineSwatches: { flex: 1, marginHorizontal: 4 },
    event: {
        textAlign: 'center',
        fontFamily: uiFont(700),
        fontSize: 12,
        lineHeight: 16,
        color: ink.tableEvent,
        backgroundColor: surface.tableEvent,
        borderRadius: radius.md,
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    // The board is the only panel that gives up height when the tray opens, and
    // it clips: a squeezed ScrollView would otherwise paint its cards straight
    // through the bank row below it.
    // Longhands, not `flex: 1`, because `boardFolded` below overrides them: a
    // merged style holding both the shorthand and its parts has no defined
    // winner, and the two platforms did not pick the same one.
    board: { flexGrow: 1, flexShrink: 1, flexBasis: 0, padding: 4, gap: 6, minHeight: 96, overflow: 'hidden' },
    boardRoomy: { minWidth: 0, minHeight: 0 },
    boardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    // On roomy screens the current action shares the Properties header rather
    // than spending a separate line over the felt. The three header items use
    // the same row, so the message cannot overlap the label or set count.
    boardHeaderLabelRoomy: { flexShrink: 0 },
    boardEvent: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 3,
        fontSize: 11,
        lineHeight: 14,
    },
    boardProgressRoomy: { flexShrink: 0 },
    boardScroll: { flex: 1 },
    progress: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted60 },
    // No backgroundColor here: the zone animates its own, and anything set on
    // this style would be applied last and win.
    propertyZone: {
        flex: 1,
        flexShrink: 1,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        minHeight: 64,
        overflow: 'hidden',
    },
    dropRow: { flexDirection: 'row', gap: 6 },
    dropRowRoomy: { width: '20%', height: 112, flexShrink: 0, alignSelf: 'flex-end' },
    // The two tiles read as the same material as the board and hand panels, so
    // their contents follow the same head geometry as the fold headers.
    zoneTile: { minHeight: 56, minWidth: 104, alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 6 },
    zoneHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    zoneText: { flex: 1, gap: 1 },
    zoneMeta: { fontFamily: uiFont(700), fontSize: 10, color: ink.muted45 },
    zoneGlyph: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d8fff012',
        borderWidth: 1,
        borderColor: '#d8fff01f',
    },
    bankTotal: { fontFamily: displayFont(900), fontSize: 16, color: status.bank },
    handZone: { flexShrink: 0, gap: 2, paddingHorizontal: 4, paddingBottom: 4, paddingTop: 2, overflow: 'hidden' },
    handZoneRoomy: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        borderWidth: 0,
        borderRadius: 0,
        boxShadow: 'none',
        padding: 0,
        overflow: 'visible',
    },
    roomyHandRow: {
        width: '60%',
        minHeight: 200,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 8,
    },
    grabberRow: { alignItems: 'center', paddingTop: 2 },
    grabber: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#d8fff033' },
    handFan: { flexShrink: 0, alignItems: 'center', gap: 3, paddingTop: 0, paddingBottom: 4, paddingHorizontal: 6 },
    handHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    handHint: { flex: 1, textAlign: 'right', fontFamily: uiFont(700), fontSize: 10, color: ink.muted45 },
    overLimit: { fontFamily: uiFont(700), fontSize: 10, color: ink.endTurnHint },
    tray: { flexShrink: 0, padding: 10, gap: 8 },
    bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
    // Touches outside a clipped parent are not delivered, which is exactly the
    // guarantee wanted here: the layer cannot reach your panels.
    clip: { overflow: 'hidden' },
    hitBand: { borderWidth: 1, borderColor: '#00e5ff80', backgroundColor: '#00e5ff14' },
    hitBox: { borderWidth: 1.5, borderColor: '#ff2d6f', backgroundColor: '#ff2d6f26' },
    hitLabel: { fontFamily: uiFont(800), fontSize: 8, color: '#ffd7e4' },
    dev: { gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: line.seat, paddingTop: 12 },
    trayTitle: { fontFamily: uiFont(800), fontSize: 13, color: ink.body },
    trayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    trayHint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    flex: { flex: 1 },
    controls: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 22,
        paddingHorizontal: 8,
        paddingVertical: 7,
    },
    controlsRoomy: {
        width: 80,
        minHeight: 200,
        alignSelf: 'stretch',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 16,
        padding: 6,
    },
    controlToolsRoomy: { flexDirection: 'column', alignItems: 'center', gap: 4 },
    turnChip: { flex: 1, gap: 4 },
    turnChipRoomy: { flexGrow: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center' },
    turnText: { fontFamily: uiFont(800), fontSize: 12, color: ink.body },
    // Dots rather than glyphs: ●/○ sit on different baselines in the UI face
    // and the row jittered as plays were spent.
    plays: { flexDirection: 'row', gap: 5, alignItems: 'center' },
    play: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d8fff02e' },
    playLeft: { backgroundColor: brand.brass },
    talkBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d8fff012',
        borderWidth: 1,
        borderColor: '#d8fff01f',
    },
    talkBtnRoomy: { width: 24, height: 24, borderRadius: 12 },
    talkBtnPressed: { backgroundColor: '#d8fff026' },
    controlDisabled: { opacity: 0.34 },
    // Concentric with the bar: the bar's radius minus its padding, so the red
    // edge never crosses the glass border behind it.
    endTurn: { borderRadius: 15, paddingHorizontal: 14, minHeight: 40 },
    endTurnRoomyWrap: { width: '100%' },
    endTurnRoomy: { width: '100%', minHeight: 32, paddingHorizontal: 4, borderRadius: 12 },
    sheetStat: { fontFamily: uiFont(700), fontSize: 13, color: ink.muted60 },
    logLine: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60, lineHeight: 18 },
    winOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: '#000102e6',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
    },
    winTitle: {
        fontFamily: displayFont(900),
        fontSize: 32,
        color: brand.brass,
        textAlign: 'center',
    },
    winActions: { flexDirection: 'row', gap: 8 },
});
