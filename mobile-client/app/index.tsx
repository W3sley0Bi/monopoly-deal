import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGameConnectionContext } from '../lib/net/messages';
import { useStore } from '../lib/store';
import { brand, ink, line, radius, status, surface } from '../lib/theme';
import { displayFont, ls, uiFont } from '../lib/fonts';
import { Avatar, Btn, Icon, LabelCaps, LanguagePicker, Panel, Sheet } from '../src/ui/kit';
import { GameSoundSettings } from '../src/components/settings/GameSoundSettings';
import { useI18n } from '../src/i18n';
import { FIXTURES } from '../src/dev/fixtures';
import type { Difficulty } from '../src/types';

export default function HomeScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { status: sock, home, room, notice, send, myId, name, setName } = useGameConnectionContext();

    const tutorialDone = useStore((s) => s.tutorialDone);
    const setTutorialDone = useStore((s) => s.setTutorialDone);
    const setDevRoom = useStore((s) => s.setDevRoom);

    const [draft, setDraft] = useState(name);
    const [account, setAccount] = useState(false);
    const [bots, setBots] = useState(2);
    const [level, setLevel] = useState<Difficulty>('normal');

    // Captured once: the Learn button's label must not flip out from under the
    // player the moment they finish a tutorial.
    const [seenAtMount] = useState(tutorialDone);

    const connected = sock === 'open';

    const [offlineOpen, setOfflineOpen] = useState(!connected);
    const prevConnectedRef = useRef(connected);
    useEffect(() => {
        if (prevConnectedRef.current !== connected) {
            prevConnectedRef.current = connected;
            setOfflineOpen(!connected);
        }
    }, [connected]);

    // ---- responsive: constrain content on wide screens (iPad / web) ----------
    const { width: vw, height: vh } = useWindowDimensions();
    const wide = Math.min(vw, vh) >= 600 || (Platform.OS === 'web' && vw >= 900);
    const wideMargin = wide ? Math.min(vw * 0.2, 400) : 0;

    // The server decides which screen we belong on; the router just follows.
    useEffect(() => {
        if (room) router.replace(room.game.state === 'waiting' ? '/lobby' : '/table');
    }, [room, router]);

    const noticeText = useMemo(() => {
        if (!notice) return null;
        return notice.key ? t(notice.key, notice.args) : (notice.text ?? null);
    }, [notice, t]);

    // ---- welcome gate: nothing is reachable without a name -------------------
    if (!name) {
        return (
            <>
                <Stack.Screen options={{ headerRight: () => null }} />
                <ScrollView contentContainerStyle={[styles.welcomeWrap, { paddingBottom: insets.bottom + 24, marginHorizontal: wideMargin }]}>
                    <LanguagePicker />

                <Panel style={styles.welcomeCard}>
                    <Avatar id={myId} name={draft || t('common.you')} size={56} />
                    <Text style={styles.h1}>{t('home.title')}</Text>
                    <Text style={styles.tagline}>{t('home.tagline')}</Text>

                    <LabelCaps>{t('home.your_name')}</LabelCaps>
                    <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        placeholder={t('home.name_placeholder')}
                        placeholderTextColor={ink.muted45}
                        maxLength={16}
                        autoCapitalize="words"
                        autoCorrect={false}
                        returnKeyType="go"
                        onSubmitEditing={() => draft.trim() && setName(draft.trim())}
                        style={styles.input}
                    />
                    <Text style={styles.hint}>{t('home.avatar_note')}</Text>

                    <Btn
                        label={t('home.continue')}
                        variant="gold"
                        disabled={!draft.trim()}
                        onPress={() => setName(draft.trim())}
                    />
                    {!connected ? <Text style={styles.hint}>{t('home.offline_available')}</Text> : null}
                </Panel>
            </ScrollView>
        </>
    );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    headerRight: () => (
                        <Pressable
                            onPress={() => setAccount(true)}
                            accessibilityRole="button"
                            accessibilityLabel={t('home.account')}
                            hitSlop={8}
                            style={styles.headerAvatar}
                        >
                            <Avatar id={myId} name={name} size={32} />
                        </Pressable>
                    ),
                }}
            />
            <ScrollView
                contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + 24, marginHorizontal: wideMargin }]}
                refreshControl={
                    // There is nothing to re-fetch — the server pushes a snapshot on
                    // every change — so the pull just nudges a reconnecting socket.
                    <RefreshControl refreshing={false} onRefresh={() => send({ type: 'hello' })} tintColor={ink.muted60} />
                }
            >
                {noticeText ? (
                    <View style={styles.notice}>
                        <Text style={styles.noticeText}>{noticeText}</Text>
                    </View>
                ) : null}

                {!connected ? <Text style={styles.reconnect}>{t('home.offline_status')}</Text> : null}

                {/* ---- learn ---- */}
                <Panel style={styles.card}>
                    <LabelCaps>{t('home.learn.title')}</LabelCaps>
                    <Text style={styles.blurb}>{t('home.learn.blurb')}</Text>
                    <Btn
                        label={seenAtMount ? t('home.learn.again') : t('home.learn.start')}
                        disabled={!connected}
                        onPress={() => {
                            setTutorialDone(false);
                            send({
                                type: 'create_room',
                                room_name: t('home.learn.table_name', { name }),
                                mode: 'tutorial',
                                turn_seconds: 0,
                                bots: 1,
                                auto_start: true,
                            });
                        }}
                    />
                </Panel>

                {/* ---- play online ---- */}
                <Panel style={styles.card}>
                    <LabelCaps>{t('home.tables')}</LabelCaps>
                    <Btn
                        label={t('home.tables')}
                        variant="gold"
                        style={styles.bigPlayBtn}
                        textStyle={styles.bigPlayText}
                        disabled={!connected}
                        onPress={() => router.push('/online')}
                    />
                </Panel>

                {/* ---- play offline ---- */}
                <Panel style={styles.card}>
                    <Pressable
                        onPress={() => setOfflineOpen((o) => !o)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: offlineOpen }}
                        accessibilityLabel={t('home.solo.title')}
                        hitSlop={8}
                        style={styles.accordionHeader}
                    >
                        <LabelCaps>{t('home.solo.title')}</LabelCaps>
                        <Icon
                            name={offlineOpen ? 'chevron.up' : 'chevron.down'}
                            fallback={offlineOpen ? '▴' : '▾'}
                            size={16}
                            color={ink.muted45}
                        />
                    </Pressable>

                    {offlineOpen ? (
                        <>
                            <Text style={styles.blurb}>{t('home.solo.blurb')}</Text>

                            <View style={styles.rowBetween}>
                                <Text style={styles.rowLabel}>{t('home.solo.robots')}</Text>
                                <View style={styles.segment}>
                                    {[1, 2, 3, 4].map((n) => (
                                        <Pressable
                                            key={n}
                                            onPress={() => setBots(n)}
                                            style={[styles.seg, bots === n && styles.segOn]}
                                        >
                                            <Text style={[styles.segText, bots === n && styles.segTextOn]}>{n}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.segmentWide}>
                                {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                                    <Pressable
                                        key={d}
                                        onPress={() => setLevel(d)}
                                        style={[styles.seg, styles.segWide, level === d && styles.segOn]}
                                    >
                                        <Text style={[styles.segText, level === d && styles.segTextOn]}>
                                            {t(`difficulty.${d}`)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Btn
                                label={t('home.solo.play')}
                                variant="gold"
                                onPress={() =>
                                    send({
                                        type: 'create_room',
                                        room_name: t('home.solo.table_name', { name }),
                                        mode: 'classic',
                                        turn_seconds: 0,
                                        bots,
                                        bot_difficulty: level,
                                        auto_start: true,
                                    })
                                }
                            />
                        </>
                    ) : null}
                </Panel>

                <Text style={styles.footer}>{t('home.footer')}</Text>
            </ScrollView>

            <Sheet open={account} onClose={() => setAccount(false)} title={t('home.account')}>
                <LabelCaps>{t('home.change_name')}</LabelCaps>
                <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    maxLength={16}
                    autoCapitalize="words"
                    autoCorrect={false}
                    style={styles.input}
                />
                <Btn
                    label={t('common.save')}
                    variant="gold"
                    disabled={!draft.trim() || draft.trim() === name}
                    onPress={() => {
                        setName(draft.trim());
                        setAccount(false);
                    }}
                />
                <LanguagePicker variant="dropdown" />
                <GameSoundSettings />

                {/* Dev only: frozen tables for looking at the UI without
                    playing a game to get there. English on purpose — these
                    strings never reach a player. */}
                {__DEV__ ? (
                    <View style={styles.dev}>
                        <LabelCaps>Dev tables</LabelCaps>
                        {FIXTURES.map((fixture) => (
                            <Btn
                                key={fixture.id}
                                label={fixture.label}
                                onPress={() => {
                                    setDevRoom(fixture.build(myId, name));
                                    setAccount(false);
                                    router.push('/table');
                                }}
                            />
                        ))}
                        <Text style={styles.devHint}>
                            Your moves apply locally; nobody else moves. Leave to go back.
                        </Text>
                    </View>
                ) : null}
            </Sheet>
        </>
    );
}

const styles = StyleSheet.create({
    wrap: { padding: 12, gap: 12 },
    welcomeWrap: { padding: 16, gap: 14, flexGrow: 1, justifyContent: 'center' },
    welcomeCard: { padding: 18, gap: 10, alignItems: 'stretch', backgroundColor: surface.welcomeCard },
    h1: { fontFamily: displayFont(900), fontSize: 34, color: ink.cream, letterSpacing: ls(-0.05, 34) },
    tagline: { fontFamily: uiFont(700), fontSize: 13, color: ink.muted60, marginBottom: 6 },
    card: { padding: 14, gap: 10 },
    bigPlayBtn: {
        minHeight: 52,
        paddingVertical: 14,
    },
    bigPlayText: {
        fontFamily: uiFont(900),
        fontSize: 16,
        letterSpacing: ls(0.04, 16),
    },
    blurb: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60, lineHeight: 17 },
    input: {
        minHeight: 44,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        backgroundColor: '#ffffff0f',
        paddingHorizontal: 12,
        color: ink.body,
        fontFamily: uiFont(700),
        fontSize: 15,
    },
    codeInput: { flex: 1, letterSpacing: ls(0.4, 15), textAlign: 'center' },
    hint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 28,
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    rowLabel: { fontFamily: uiFont(700), fontSize: 13, color: ink.body },
    segment: { flexDirection: 'row', gap: 4 },
    segmentWide: { flexDirection: 'row', gap: 4 },
    seg: {
        minWidth: 40,
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: '#ffffff0f',
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
    },
    segWide: { flex: 1 },
    segOn: { backgroundColor: brand.brassGlow12, borderColor: brand.brass },
    segOff: { opacity: 0.42 },
    segText: { fontFamily: uiFont(700), fontSize: 13, color: ink.muted60 },
    segTextOn: { color: ink.body },
    joinRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    joinBtn: { flexShrink: 0 },
    dev: { gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: line.seat, paddingTop: 12 },
    devHint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    tableRow: {
        gap: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: line.hairlineWhite10,
    },
    tableInfo: { gap: 3 },
    tableTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    code: {
        fontFamily: displayFont(900),
        fontSize: 15,
        color: brand.inviteCode,
        letterSpacing: ls(0.1, 15),
    },
    tableName: { flex: 1, fontFamily: uiFont(700), fontSize: 14, color: ink.body },
    meta: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    tableActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    headerAvatar: {
        padding: 4,
        marginRight: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notice: {
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: '#ea3c3c22',
        borderWidth: 1,
        borderColor: status.danger,
    },
    noticeText: { fontFamily: uiFont(700), fontSize: 12, color: ink.body },
    reconnect: { fontFamily: uiFont(700), fontSize: 11, color: ink.endTurnHint },
    footer: { fontFamily: uiFont(700), fontSize: 10, color: ink.muted42, textAlign: 'center', marginTop: 4 },
});
