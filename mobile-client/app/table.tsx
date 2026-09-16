import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurTargetView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { FeltTable } from '../src/components/table/FeltTable';
import { GlassPanel, TableGlassProvider } from '../src/components/table/TableGlass';

import { useGameConnectionContext } from '../lib/net/messages';
import { useStore } from '../lib/store';
import { brand, ink, line, radius, status, surface } from '../lib/theme';
import { displayFont, ls, uiFont } from '../lib/fonts';
import { Btn, Icon, LabelCaps, Panel, Sheet } from '../src/ui/kit';
import { Card } from '../src/ui/card';
import { PlayerChip, PropertySets } from '../src/components/board';
import { DragLayer, Draggable, DropZone, useDragLayer } from '../src/game/drag';
import { ActionDialog } from '../src/components/table/ActionDialog';
import { ActiveBoard } from '../src/components/board/ActiveBoard';
import { usePlayBubbles } from '../src/game/usePlayBubbles';
import { PendingPanel } from '../src/components/table/PendingPanel';
import { useI18n } from '../src/i18n';
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
import { applyOptimistic, moveSettled, type PendingMove } from '../src/game/optimistic';
import type { Card as CardT, Color, LogEntry, RoomView } from '../src/types';
import type { ActionDialogIntent, PendingViewerRole } from '../lib/contracts';

const EMPTY_LOG: LogEntry[] = [];

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
    const { height: windowHeight } = useWindowDimensions();
    // The felt belongs to the viewport, not to the accordion's remaining space.
    const feltTop = insets.top + 132;
    const feltHeight = Math.max(180, windowHeight - feltTop - insets.bottom - 60);
    const cardAreaHeight = Math.max(120, feltHeight * 0.55);
    const { room: live, send, leave, notice } = useGameConnectionContext();
    const dragLayer = useDragLayer();

    const tapTray = useStore((s) => s.tapTray);
    const setDevRoom = useStore((s) => s.setDevRoom);

    const [guess, setGuess] = useState<PendingMove | null>(null);
    const [sent, setSent] = useState<string | null>(null);
    const [selected, setSelected] = useState<CardT | null>(null);
    const [dialog, setDialog] = useState<{ card: CardT; intent: ActionDialogIntent; fromColor?: Color } | null>(null);
    const [wildColor, setWildColor] = useState<Record<string, Color>>({});
    const [talk, setTalk] = useState(false);
    const [menu, setMenu] = useState(false);
    const [sheetPlayer, setSheetPlayer] = useState<string | null>(null);
    const [bankOpen, setBankOpen] = useState(false);
    const [discardOpen, setDiscardOpen] = useState(false);

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

    // Retire the prediction the moment the real state agrees with it.
    useEffect(() => {
        if (live && guess && moveSettled(live, guess)) setGuess(null);
    }, [live, guess]);

    const room: RoomView | null = useMemo(() => {
        if (!live) return null;
        return guess ? applyOptimistic(live, guess) : live;
    }, [live, guess]);

    const ownTurn = room ? isYourTurn(room.game) : false;
    const hasPending = Boolean(room?.game.pending);
    const [boardOpen, setBoardOpen] = useState(true);
    const [handOpen, setHandOpen] = useState(true);
    const plays = usePlayBubbles(room?.game.log ?? EMPTY_LOG, room?.id);
    useEffect(() => { setBoardOpen(ownTurn); }, [ownTurn, room?.id]);
    useEffect(() => { setHandOpen(ownTurn || hasPending); }, [ownTurn, hasPending, room?.id]);

    const act = useCallback(
        (msg: Parameters<typeof send>[0], cardId?: string, optimistic?: PendingMove) => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (cardId) setSent(cardId);
            if (optimistic) setGuess(optimistic);
            setSelected(null);
            setDialog(null);
            send(msg);
        },
        [send],
    );

    if (!room) return null;

    const g = room.game;
    const me = youOf(g);
    const rivals = opponents(g);
    const pending = g.pending;
    const spectating = !room.you_seated || !me;
    const myTurn = isYourTurn(g);
    const canPlay = myTurn && !pending && g.plays_left > 0;
    const hand = (me?.hand ?? []).filter((c) => c.id !== sent);
    const overLimit = (me?.hand?.length ?? 0) > 7;

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

    function openCard(card: CardT) {
        if (!canPlay) return;
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
    const boardShown = boardOpen || Boolean(carried);
    const handShown = handOpen || carried?.from === 'hand';
    const turnPlayer = g.players[g.current_turn % g.players.length];
    const carriedCard = carried?.card ?? null;
    const carriedTargets = carriedCard ? dropTargets(carriedCard, g.colors) : null;

    const propertyActive =
        !!carried && canPlay && (carried.from === 'board' || !!carriedTargets?.colors.length);
    const bankActive = !!carried && canPlay && carried.from === 'hand' && !!carriedTargets?.bankable;
    const actionActive =
        !!carried && canPlay && carried.from === 'hand' && !!carriedCard && isPlayableAction(carriedCard);

    // The eligible zone still leans towards the thumb, but the other one keeps
    // enough width to stay readable — a crushed tile looked broken, not inert.
    const growFor = (active: boolean) => (!carried ? 1 : active ? 1.45 : 0.55);

    const payable = me
        ? assets(me).map((a) => ({ card: a.card, source: (a.fromColor ?? 'bank') as 'bank' | Color }))
        : [];

    return (
        <TableGlassProvider target={feltTarget}>
        {/* The bar is a floating pill now, so it sits in the home-indicator
            gutter rather than above it — the indicator is its bottom padding. */}
        <View style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: Math.max(6, insets.bottom - 14) }]}>
            <BlurTargetView ref={feltTarget} pointerEvents="box-none" style={[styles.feltBackground, { top: feltTop, height: feltHeight }]}>
                <FeltTable
                    players={g.players}
                    you={room.you}
                    cardAreaHeight={cardAreaHeight}
                    deckCount={g.deck_count}
                    discardCount={g.discard_count}
                    discardTop={g.discard_top}
                    onOpenDiscard={() => setDiscardOpen(true)}
                    onOpenPlayer={setSheetPlayer}
                    onPreviewPlayer={setSheetPlayer}
                    onPreviewEnd={(playerId) =>
                        setSheetPlayer((current) => (current === playerId ? null : current))
                    }
                />
            </BlurTargetView>
            {/* ---- header ---- */}
            <View style={styles.header}>
                <Pressable onPress={leave} style={styles.iconBtn} accessibilityLabel={t('table.back_to_tables')}>
                    <Icon name="chevron.left" fallback="‹" size={20} />
                </Pressable>
                <Text style={styles.roomName} numberOfLines={1}>
                    {room.name}
                </Text>
                <Text style={styles.code}>{room.id}</Text>
                <Pressable onPress={() => setMenu(true)} style={styles.iconBtn} accessibilityLabel={t('table.menu')}>
                    <Icon name="gearshape.fill" fallback="☰" size={20} color={ink.muted60} />
                </Pressable>
            </View>

            {notice ? (
                <Text style={styles.notice}>{notice.key ? t(notice.key, notice.args) : notice.text}</Text>
            ) : null}

            {/* ---- opponents ---- */}
            <ScrollView horizontal style={styles.opponentRail} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {/* The deck and discard live on the felt now, where they read as
                    piles people draw from rather than as a status chip. */}
                {rivals.map((p) => (
                    <PlayerChip
                        key={p.id}
                        player={p}
                        isTurn={g.players[g.current_turn % g.players.length]?.id === p.id}
                        isTargeted={!!pending?.targets?.some((x) => !x.settled && x.player_id === p.id)}
                        isOwner={p.id === room.owner_id}
                        isYou={false}
                        playBubbleText={plays[p.name] ? tLog(plays[p.name].entry) : null}
                        onPress={() => setSheetPlayer(p.id)}
                    />
                ))}
            </ScrollView>

            {/* This space grows above the local sections, keeping them bottom-anchored. */}
            <View pointerEvents="box-none" style={styles.sharedTable}>
            {turnPlayer && turnPlayer.id !== me?.id && !myTurn ? (
                <ActiveBoard key={turnPlayer.id} player={turnPlayer} onOpen={() => setSheetPlayer(turnPlayer.id)} />
            ) : null}

            {/* ---- what just happened ---- */}
            <Text style={styles.event} numberOfLines={2} accessibilityLiveRegion="polite">
                {lastEvent ? tLog(lastEvent) : t('table.shared_space')}
            </Text>
            </View>

            {me ? <>
            {/* ---- my board ---- */}
            <GlassPanel style={[styles.board, !boardShown && styles.boardFolded]}>
                <Pressable style={({ pressed }) => [styles.boardHead, styles.foldHead, pressed && styles.foldHeadPressed]} accessibilityRole="button"
                    accessibilityState={{ expanded: boardShown }} disabled={!!carried}
                    accessibilityLabel={t(boardShown ? 'table.board_fold' : 'table.board_unfold')}
                    onPress={() => {
                        void Haptics.selectionAsync();
                        setBoardOpen(open => !open);
                    }}>
                    <LabelCaps>{t('table.your_properties')}</LabelCaps>
                {!boardShown ? <View style={[styles.swatches, styles.inlineSwatches]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {me?.sets.map(set => <View key={set.color} style={[styles.swatch, { backgroundColor: colorMeta(set.color).hex, flex: set.cards.length, opacity: set.complete ? 1 : 0.55 }]} />)}
                </View> : null}
                    <Text style={styles.progress}>
                        {t('table.sets_progress', { done: me?.complete_sets ?? 0 })}
                    </Text>
                    <DisclosureIcon expanded={boardShown} />
                </Pressable>
                <DropZone
                    id="properties"
                    active={propertyActive}
                    grow={1}
                    hint={t('table.play_it')}
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
                        density={(me?.sets.length ?? 0) > 6 ? 'tight' : (me?.sets.length ?? 0) > 4 ? 'dense' : 'normal'}
                        onCardPress={
                            canPlay
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
                <View style={styles.dropRow}>
                    <DropZone
                        id="bank"
                        glass
                        active={bankActive}
                        grow={growFor(bankActive)}
                        hint={t('table.bank_drop', { amount: carriedCard?.value ?? 0 })}
                        onDrop={(card) =>
                            act({ type: 'play_bank', card_id: card.id }, card.id, {
                                type: 'play_bank',
                                cardId: card.id,
                            })
                        }
                        style={styles.zoneTile}
                    >
                        {/* Tapping the tile opens the pile; dragging still drops
                            onto it, because the drag gesture lives on the card. */}
                        <Pressable
                            style={styles.zoneHead}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('table.bank')}: ${t('table.bank_cards', { count: me?.bank.length ?? 0 })}`}
                            disabled={!!carried}
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

                    <DropZone
                        id="action"
                        glass
                        active={actionActive}
                        grow={growFor(actionActive)}
                        hint={t('table.play_it')}
                        onDrop={(card) => playAction(card)}
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
                </View>

            {/* ---- hand ---- */}
            <GlassPanel style={styles.handZone}>
                {/* The hand folds like the board does, and a bare header row did
                    not read as something you could collapse. */}
                <View style={styles.grabberRow} pointerEvents="none">
                    <View style={styles.grabber} />
                </View>
                <Pressable style={({ pressed }) => [styles.handHead, styles.foldHead, pressed && styles.foldHeadPressed]} accessibilityRole="button"
                    accessibilityState={{ expanded: handShown }} disabled={!!carried}
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
                        <Text style={styles.handHint} numberOfLines={2}>{t('table.hand_tap')}</Text>
                    ) : null}
                    <DisclosureIcon expanded={handShown} />
                </Pressable>


                <ScrollView
                    style={[styles.handScroll, !handShown && styles.hidden]}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.handFan}
                >
                    {hand.map((card, i) => (
                        <View key={card.id} style={i > 0 ? styles.handOverlap : undefined}>
                            <Draggable
                                state={{ card, from: 'hand' }}
                                axis="vertical"
                                enabled={canPlay}
                                onTap={() => openCard(card)}
                            >
                                <Card
                                    card={card}
                                    size="hand"
                                    activeColor={wildColor[card.id] ?? null}
                                    selected={selected?.id === card.id}
                                    disabled={!canPlay}
                                    dimmed={!canPlay || carriedCard?.id === card.id}
                                />
                            </Draggable>
                        </View>
                    ))}
                    {hand.length === 0 ? <Text style={styles.handHint}>{t('table.hand_empty')}</Text> : null}
                </ScrollView>
            </GlassPanel>

            </> : null}

            {/* ---- what can I do with the tapped card ---- */}
            {selected && handShown ? (
                <Panel style={styles.tray}>
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

            {/* ---- bottom bar ---- */}
            <GlassPanel style={styles.controls}>
                <View style={styles.turnChip}>
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

                <Pressable onPress={() => setTalk(true)} style={({ pressed }) => [styles.talkBtn, pressed && styles.talkBtnPressed]} accessibilityRole="button" accessibilityLabel={t('table.talk')}>
                    <Icon name="bubble.left.and.bubble.right.fill" fallback="…" size={18} color={ink.muted60} />
                </Pressable>

                {myTurn && !pending && !spectating ? (
                    <Btn label={t('table.end_turn')} variant="red" onPress={() => act({ type: 'end_turn' })} style={styles.endTurn} />
                ) : null}
            </GlassPanel>

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
                    skewMs={0}
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

            <Sheet open={talk} onClose={() => setTalk(false)} title={t('panel.log')}>
                {g.log
                    .slice(-40)
                    .reverse()
                    .map((e, i) => (
                        <Text key={i} style={styles.logLine}>
                            {tLog(e)}
                        </Text>
                    ))}
            </Sheet>

            <Sheet open={menu} onClose={() => setMenu(false)} title={t('table.menu')}>
                <Btn
                    label={t('table.end_game')}
                    variant="red"
                    onPress={() =>
                        Alert.alert(t('table.end_game_confirm'), '', [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                                text: t('table.end_game'),
                                style: 'destructive',
                                onPress: () => {
                                    setMenu(false);
                                    send({ type: 'terminate_game' });
                                },
                            },
                        ])
                    }
                />
                <Btn label={t('table.leave')} onPress={leave} />

                {/* Dev only: swap this table for a hand-built one. English on
                    purpose — these strings never reach a player. */}
                {__DEV__ ? (
                    <View style={styles.dev}>
                        <LabelCaps>Dev tables</LabelCaps>
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

            {g.state === 'finished' ? (
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
        </View>
        </TableGlassProvider>
    );
}

/** SF Symbol with a text fallback, sized for the drop-zone tiles. */
function ZoneGlyph({ name, fallback }: { name: string; fallback: string }) {
    return (
        <View style={styles.zoneGlyph} pointerEvents="none">
            <SymbolView
                name={name as never}
                size={14}
                weight="semibold"
                tintColor={ink.muted60}
                fallback={<Text style={styles.zoneGlyphFallback}>{fallback}</Text>}
                style={styles.zoneGlyphSymbol}
            />
        </View>
    );
}

function DisclosureIcon({ expanded }: { expanded: boolean }) {
    return (
        <View style={styles.disclosure} pointerEvents="none">
            <SymbolView
                name={expanded ? 'chevron.down' : 'chevron.up'}
                size={12}
                weight="semibold"
                tintColor={ink.muted60}
                fallback={<Text style={styles.disclosureFallback}>{expanded ? '⌄' : '⌃'}</Text>}
                style={styles.disclosureSymbol}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    feltBackground: { position: 'absolute', left: 0, right: 0 },
    root: { flex: 1, backgroundColor: surface.bodyBase, paddingHorizontal: 8, gap: 5 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 6 },
    roomName: { flex: 1, fontFamily: uiFont(700), fontSize: 14, color: ink.headerTitle },
    code: { fontFamily: displayFont(900), fontSize: 13, color: brand.inviteCode, letterSpacing: ls(0.1, 13) },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 18, color: ink.body },
    notice: { fontFamily: uiFont(700), fontSize: 12, color: status.danger },
    opponentRail: { flexGrow: 0, flexShrink: 0, maxHeight: 128 },
    // Gives up height faster than your own board does: when the tray opens, the
    // shared table is the part you are least likely to be reading.
    sharedTable: { flex: 1, flexShrink: 1.6, minHeight: 104, gap: 5, justifyContent: 'flex-start', overflow: 'hidden' },
    handScroll: { flexGrow: 0, flexShrink: 0 },
    hidden: { display: 'none' },
    boardFolded: { flex: 0, minHeight: 0, paddingVertical: 3 },
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
    disclosureSymbol: { width: 14, height: 14 },
    disclosureFallback: { fontSize: 13, lineHeight: 14, color: ink.muted60, textAlign: 'center' },
    swatches: { flexDirection: 'row', gap: 3, height: 6 },
    swatch: { flex: 1, borderRadius: 3 },
    inlineSwatches: { flex: 1, marginHorizontal: 4 },
    rail: { gap: 6, paddingVertical: 4, alignItems: 'stretch' },
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
    board: { flex: 1, flexShrink: 1, padding: 4, gap: 6, minHeight: 96, overflow: 'hidden' },
    boardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
    zoneGlyphSymbol: { width: 14, height: 14 },
    zoneGlyphFallback: { fontSize: 12, lineHeight: 14, color: ink.muted60, textAlign: 'center' },
    bankTotal: { fontFamily: displayFont(900), fontSize: 16, color: status.bank },
    handZone: { flexShrink: 0, gap: 2, paddingHorizontal: 4, paddingBottom: 4, paddingTop: 2, overflow: 'hidden' },
    grabberRow: { alignItems: 'center', paddingTop: 2 },
    grabber: { width: 34, height: 4, borderRadius: 2, backgroundColor: '#d8fff033' },
    handFan: { paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center' },
    handOverlap: { marginLeft: -12 },
    handHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    handHint: { flex: 1, textAlign: 'right', fontFamily: uiFont(700), fontSize: 10, color: ink.muted45 },
    overLimit: { fontFamily: uiFont(700), fontSize: 10, color: ink.endTurnHint },
    tray: { flexShrink: 0, padding: 10, gap: 8 },
    bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
    dev: { gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: line.seat, paddingTop: 12 },
    trayTitle: { fontFamily: uiFont(800), fontSize: 13, color: ink.body },
    trayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    trayHint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    flex: { flex: 1 },
    controls: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 22,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    turnChip: { flex: 1, gap: 4 },
    turnText: { fontFamily: uiFont(800), fontSize: 13, color: ink.body },
    // Dots rather than glyphs: ●/○ sit on different baselines in the UI face
    // and the row jittered as plays were spent.
    plays: { flexDirection: 'row', gap: 5, alignItems: 'center' },
    play: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d8fff02e' },
    playLeft: { backgroundColor: brand.brass },
    talkBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d8fff012',
        borderWidth: 1,
        borderColor: '#d8fff01f',
    },
    talkBtnPressed: { backgroundColor: '#d8fff026' },
    // Concentric with the bar: the bar's radius minus its padding, so the red
    // edge never crosses the glass border behind it.
    endTurn: { borderRadius: 15, paddingHorizontal: 18, minHeight: 42 },
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
