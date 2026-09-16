import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useGameConnectionContext } from '../lib/net/messages';
import { useStore } from '../lib/store';
import { brand, ink, line, radius, status, surface } from '../lib/theme';
import { displayFont, ls, uiFont } from '../lib/fonts';
import { Btn, LabelCaps, Panel, Sheet } from '../src/ui/kit';
import { Card } from '../src/ui/card';
import { PlayerChip, PropertySets } from '../src/components/board';
import { DragLayer, Draggable, DropZone, useDragLayer } from '../src/game/drag';
import { ActionDialog } from '../src/components/table/ActionDialog';
import { PendingPanel } from '../src/components/table/PendingPanel';
import { useI18n } from '../src/i18n';
import {
    assets,
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
import type { Card as CardT, Color, RoomView } from '../src/types';
import type { ActionDialogIntent, PendingViewerRole } from '../lib/contracts';

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
    const { room: live, send, leave, notice } = useGameConnectionContext();
    const dragLayer = useDragLayer();

    const tapTray = useStore((s) => s.tapTray);

    const [guess, setGuess] = useState<PendingMove | null>(null);
    const [sent, setSent] = useState<string | null>(null);
    const [selected, setSelected] = useState<CardT | null>(null);
    const [dialog, setDialog] = useState<{ card: CardT; intent: ActionDialogIntent; fromColor?: Color } | null>(null);
    const [wildColor, setWildColor] = useState<Record<string, Color>>({});
    const [talk, setTalk] = useState(false);
    const [menu, setMenu] = useState(false);
    const [sheetPlayer, setSheetPlayer] = useState<string | null>(null);

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
    const carriedCard = carried?.card ?? null;
    const carriedTargets = carriedCard ? dropTargets(carriedCard, g.colors) : null;

    const propertyActive =
        !!carried && canPlay && (carried.from === 'board' || !!carriedTargets?.colors.length);
    const bankActive = !!carried && canPlay && carried.from === 'hand' && !!carriedTargets?.bankable;
    const actionActive =
        !!carried && canPlay && carried.from === 'hand' && !!carriedCard && isPlayableAction(carriedCard);

    const growFor = (active: boolean) => (!carried ? 1 : active ? 1.72 : 0.28);

    const payable = me
        ? assets(me).map((a) => ({ card: a.card, source: (a.fromColor ?? 'bank') as 'bank' | Color }))
        : [];

    return (
        <View style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: Math.max(6, insets.bottom) }]}>
            {/* ---- header ---- */}
            <View style={styles.header}>
                <Pressable onPress={leave} style={styles.iconBtn} accessibilityLabel={t('table.back_to_tables')}>
                    <Text style={styles.icon}>‹</Text>
                </Pressable>
                <Text style={styles.roomName} numberOfLines={1}>
                    {room.name}
                </Text>
                <Text style={styles.code}>{room.id}</Text>
                <Pressable onPress={() => setMenu(true)} style={styles.iconBtn} accessibilityLabel={t('table.menu')}>
                    <Text style={styles.icon}>⚙</Text>
                </Pressable>
            </View>

            {notice ? (
                <Text style={styles.notice}>{notice.key ? t(notice.key, notice.args) : notice.text}</Text>
            ) : null}

            {/* ---- opponents ---- */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                <View style={styles.deckChip}>
                    <Text style={styles.deckCount}>{g.deck_count}</Text>
                    <LabelCaps size={10}>{t('table.deck')}</LabelCaps>
                </View>
                {rivals.map((p) => (
                    <PlayerChip
                        key={p.id}
                        player={p}
                        isTurn={g.players[g.current_turn % g.players.length]?.id === p.id}
                        isTargeted={!!pending?.targets?.some((x) => !x.settled && x.player_id === p.id)}
                        isOwner={p.id === room.owner_id}
                        isYou={false}
                        onPress={() => setSheetPlayer(p.id)}
                    />
                ))}
            </ScrollView>

            {/* ---- what just happened ---- */}
            <Text style={styles.event} numberOfLines={2}>
                {lastEvent ? tLog(lastEvent) : t('table.shared_space')}
            </Text>

            {/* ---- my board ---- */}
            <Panel style={styles.board}>
                <View style={styles.boardHead}>
                    <LabelCaps>{t('table.your_properties')}</LabelCaps>
                    <Text style={styles.progress}>
                        {t('table.sets_progress', { count: me?.complete_sets ?? 0, need: 3 })}
                    </Text>
                </View>
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
                    style={styles.propertyZone}
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

                {/* The two landing places a card can go that are not a set. */}
                <View style={styles.dropRow}>
                    <DropZone
                        id="bank"
                        active={bankActive}
                        grow={growFor(bankActive)}
                        hint={t('table.bank_drop', { amount: carriedCard?.value ?? 0 })}
                        onDrop={(card) =>
                            act({ type: 'play_bank', card_id: card.id }, card.id, {
                                type: 'play_bank',
                                cardId: card.id,
                            })
                        }
                    >
                        {!carried ? (
                            <View style={styles.bankRow}>
                                <Text style={styles.bankLabel}>{t('table.bank')}</Text>
                                <Text style={styles.bankTotal}>${me?.bank_total ?? 0}M</Text>
                                <Text style={styles.bankCount}>
                                    {t('table.bank_cards', { count: me?.bank.length ?? 0 })}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.zoneLabel}>{t('table.bank')}</Text>
                        )}
                    </DropZone>

                    <DropZone
                        id="action"
                        active={actionActive}
                        grow={growFor(actionActive)}
                        hint={t('table.play_it')}
                        onDrop={(card) => playAction(card)}
                    >
                        <Text style={styles.zoneLabel}>✦ {t('table.action_space')}</Text>
                    </DropZone>
                </View>
            </Panel>

            {/* ---- hand ---- */}
            <View style={styles.handZone}>
                <View style={styles.handHead}>
                    <LabelCaps>{t('table.hand', { count: hand.length })}</LabelCaps>
                    {overLimit ? (
                        <Text style={styles.overLimit}>{t('table.over_limit', { count: hand.length - 7 })}</Text>
                    ) : (
                        <Text style={styles.handHint}>{t('table.hand_tap')}</Text>
                    )}
                </View>

                <ScrollView
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
            </View>

            {/* ---- what can I do with the tapped card ---- */}
            {selected ? (
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
            <View style={styles.controls}>
                <View style={styles.turnChip}>
                    <Text style={styles.turnText}>
                        {spectating
                            ? t('table.watching')
                            : myTurn
                              ? t('table.your_turn')
                              : t('table.turn_of', {
                                    name: g.players[g.current_turn % g.players.length]?.name ?? '',
                                })}
                    </Text>
                    {myTurn ? <Text style={styles.plays}>{t('table.plays', { count: g.plays_left })}</Text> : null}
                </View>

                <Pressable onPress={() => setTalk(true)} style={styles.iconBtn} accessibilityLabel={t('table.talk')}>
                    <Text style={styles.icon}>💬</Text>
                </Pressable>

                {myTurn && !pending && !spectating ? (
                    <Btn label={t('table.end_turn')} variant="gold" onPress={() => act({ type: 'end_turn' })} />
                ) : null}
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
                    skewMs={0}
                    onRespond={(msg) => act({ type: 'respond', ...msg })}
                />
            ) : null}

            <Sheet
                open={!!sheetPlayer}
                onClose={() => setSheetPlayer(null)}
                title={rivals.find((p) => p.id === sheetPlayer)?.name}
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
                        </>
                    );
                })()}
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
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: surface.bodyBase, paddingHorizontal: 8, gap: 5 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 6 },
    roomName: { flex: 1, fontFamily: uiFont(700), fontSize: 14, color: ink.headerTitle },
    code: { fontFamily: displayFont(900), fontSize: 13, color: brand.inviteCode, letterSpacing: ls(0.1, 13) },
    iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    icon: { fontSize: 18, color: ink.body },
    notice: { fontFamily: uiFont(700), fontSize: 12, color: status.danger },
    rail: { gap: 6, paddingVertical: 4, alignItems: 'stretch' },
    deckChip: {
        minWidth: 56,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.panel,
        backgroundColor: surface.panelOverlay,
        borderWidth: 1,
        borderColor: line.seat,
        padding: 7,
    },
    deckCount: { fontFamily: displayFont(900), fontSize: 18, color: ink.body },
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
    board: { flex: 1, padding: 8, gap: 6, minHeight: 125 },
    boardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    boardScroll: { flex: 1 },
    progress: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted60 },
    // No backgroundColor here: the zone animates its own, and anything set on
    // this style would be applied last and win.
    propertyZone: {
        flex: 1,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        minHeight: 90,
    },
    dropRow: { flexDirection: 'row', gap: 6 },
    zoneLabel: {
        fontFamily: uiFont(800),
        fontSize: 9,
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        color: ink.muted60,
        textAlign: 'center',
    },
    bankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: line.hairlineWhite10,
        paddingTop: 6,
    },
    bankLabel: { fontFamily: uiFont(800), fontSize: 11, color: ink.muted55, textTransform: 'uppercase' },
    bankTotal: { flex: 1, fontFamily: displayFont(900), fontSize: 16, color: status.bank },
    bankCount: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    handZone: { gap: 4 },
    handFan: { paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center' },
    handOverlap: { marginLeft: -12 },
    handHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    handHint: { fontFamily: uiFont(700), fontSize: 10, color: ink.muted45 },
    overLimit: { fontFamily: uiFont(700), fontSize: 10, color: ink.endTurnHint },
    tray: { padding: 10, gap: 8 },
    trayTitle: { fontFamily: uiFont(800), fontSize: 13, color: ink.body },
    trayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    trayHint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    flex: { flex: 1 },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: surface.mobileControls,
        borderRadius: radius.panel,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    turnChip: { flex: 1 },
    turnText: { fontFamily: uiFont(800), fontSize: 13, color: ink.body },
    plays: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted60 },
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
