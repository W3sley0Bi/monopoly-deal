import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
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
import { brand, ink, line, radius, status, surface } from '../lib/theme';
import { displayFont, ls, uiFont } from '../lib/fonts';
import { Btn, LabelCaps, Panel, Sheet, Toggle } from '../src/ui/kit';
import { useI18n } from '../src/i18n';
import { formatTurn } from '../src/i18n/format';
import type { Difficulty, Mode } from '../src/types';

export default function OnlineScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { status: sock, home, room, notice, send, name } = useGameConnectionContext();

    const [code, setCode] = useState('');
    const [creating, setCreating] = useState(false);
    const [tableName, setTableName] = useState('');
    const [privateRoom, setPrivateRoom] = useState(false);
    const [createMode, setCreateMode] = useState<Mode>('classic');
    const [turnSeconds, setTurnSeconds] = useState(0);
    const [createBots, setCreateBots] = useState(0);
    const [createLevel, setCreateLevel] = useState<Difficulty>('normal');

    const connected = sock === 'open';

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

    const rooms = home?.rooms ?? [];

    return (
        <>
            <Stack.Screen
                options={{
                    title: t('home.tables'),
                }}
            />

            <ScrollView
                contentContainerStyle={[
                    styles.wrap,
                    {
                        paddingBottom: insets.bottom + 24,
                        marginHorizontal: wideMargin,
                    },
                ]}
                refreshControl={
                    <RefreshControl
                        refreshing={false}
                        onRefresh={() => send({ type: 'hello' })}
                        tintColor={ink.muted60}
                    />
                }
            >
                {noticeText ? (
                    <View style={styles.notice}>
                        <Text style={styles.noticeText}>{noticeText}</Text>
                    </View>
                ) : null}

                {!connected ? <Text style={styles.reconnect}>{t('home.offline_status')}</Text> : null}

                <Panel style={styles.card}>
                    <LabelCaps>{t('home.tables')}</LabelCaps>
                    <Btn label={t('home.new_table')} variant="gold" onPress={() => setCreating(true)} />

                    <View style={styles.joinRow}>
                        <TextInput
                            value={code}
                            onChangeText={(v) => setCode(v.toUpperCase().trim())}
                            placeholder={t('home.code_placeholder')}
                            placeholderTextColor={ink.muted45}
                            maxLength={4}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            style={[styles.input, styles.codeInput]}
                        />
                        <Btn
                            label={t('home.join_by_code')}
                            disabled={code.length !== 4 || !connected}
                            onPress={() => send({ type: 'join_room', room_id: code })}
                            style={styles.joinBtn}
                        />
                    </View>

                    {rooms.length === 0 ? (
                        <Text style={styles.blurb}>{t('home.no_tables')}</Text>
                    ) : (
                        rooms.map((r) => (
                            <View key={r.id} style={styles.tableRow}>
                                <View style={styles.tableInfo}>
                                    <View style={styles.tableTitleRow}>
                                        <Text style={styles.code}>{r.id}</Text>
                                        <Text style={styles.tableName} numberOfLines={1}>
                                            {r.name}
                                        </Text>
                                    </View>
                                    <Text style={styles.meta} numberOfLines={1}>
                                        {t(`mode.${r.mode}`)} · {formatTurn(t, r.turn_seconds)} ·{' '}
                                        {t(`home.state.${r.state}`)} · {r.players.length}/5
                                        {r.abandoned ? ` · ${t('home.abandoned')}` : ''}
                                    </Text>
                                </View>

                                <View style={styles.tableActions}>
                                    {r.you_seated || r.you_spectating ? (
                                        <Btn
                                            label={t('home.return')}
                                            variant="gold"
                                            onPress={() => send({ type: 'join_room', room_id: r.id })}
                                        />
                                    ) : (
                                        <>
                                            <Btn
                                                label={t('home.take_seat')}
                                                variant="gold"
                                                disabled={r.state !== 'waiting' || r.seats_free <= 0}
                                                onPress={() => send({ type: 'join_room', room_id: r.id })}
                                            />
                                            <Btn
                                                label={t('home.watch')}
                                                onPress={() =>
                                                    send({ type: 'join_room', room_id: r.id, as_spectator: true })
                                                }
                                            />
                                        </>
                                    )}
                                    {r.you_may_close ? (
                                        <Btn
                                            label={t('home.close')}
                                            variant="red"
                                            onPress={() =>
                                                Alert.alert(
                                                    r.abandoned
                                                        ? t('home.close_abandoned_title')
                                                        : t('home.close_title'),
                                                    r.name,
                                                    [
                                                        { text: t('home.keep'), style: 'cancel' },
                                                        {
                                                            text: t('home.close_it'),
                                                            style: 'destructive',
                                                            onPress: () =>
                                                                send({ type: 'close_room', room_id: r.id }),
                                                        },
                                                    ],
                                                )
                                            }
                                        />
                                    ) : null}
                                </View>
                            </View>
                        ))
                    )}
                </Panel>
            </ScrollView>

            <Sheet open={creating} onClose={() => setCreating(false)} title={t('home.new_table')}>
                <LabelCaps>{t('home.table_name')}</LabelCaps>
                <TextInput
                    value={tableName}
                    onChangeText={setTableName}
                    placeholder={t('home.table_name_placeholder', { name })}
                    placeholderTextColor={ink.muted45}
                    maxLength={28}
                    autoCapitalize="sentences"
                    style={styles.input}
                />

                <LabelCaps>{t('invite.visibility')}</LabelCaps>
                <View style={styles.segmentWide}>
                    {[false, true].map((isPrivate) => (
                        <Pressable
                            key={String(isPrivate)}
                            onPress={() => setPrivateRoom(isPrivate)}
                            style={[styles.seg, styles.segWide, privateRoom === isPrivate && styles.segOn]}
                        >
                            <Text style={[styles.segText, privateRoom === isPrivate && styles.segTextOn]}>
                                {t(isPrivate ? 'invite.private' : 'invite.public')}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <LabelCaps>{t('home.game_mode')}</LabelCaps>
                <View style={styles.segmentWide}>
                    {(home?.modes ?? []).map((m) => (
                        <Pressable
                            key={m.id}
                            disabled={!m.available}
                            onPress={() => setCreateMode(m.id)}
                            style={[
                                styles.seg,
                                styles.segWide,
                                createMode === m.id && styles.segOn,
                                !m.available && styles.segOff,
                            ]}
                        >
                            <Text style={[styles.segText, createMode === m.id && styles.segTextOn]}>
                                {t(`mode.${m.id}`)}{!m.available ? ` · ${t('home.mode_soon')}` : ''}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <LabelCaps>{t('home.turn_timer')}</LabelCaps>
                <View style={styles.segmentWide}>
                    {(home?.turn_options ?? [0, 30, 60, 120]).map((seconds) => (
                        <Pressable
                            key={seconds}
                            onPress={() => setTurnSeconds(seconds)}
                            style={[styles.seg, styles.segWide, turnSeconds === seconds && styles.segOn]}
                        >
                            <Text style={[styles.segText, turnSeconds === seconds && styles.segTextOn]}>
                                {formatTurn(t, seconds)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={styles.hint}>{t('home.turn_hint')}</Text>

                <LabelCaps>{t('home.bots')}</LabelCaps>
                <View style={styles.segmentWide}>
                    {[0, 1, 2, 3, 4].map((count) => (
                        <Pressable
                            key={count}
                            onPress={() => setCreateBots(count)}
                            style={[styles.seg, styles.segWide, createBots === count && styles.segOn]}
                        >
                            <Text style={[styles.segText, createBots === count && styles.segTextOn]}>
                                {count === 0 ? t('home.bots_none') : count}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {createBots > 0 ? (
                    <>
                        <LabelCaps>{t('home.difficulty')}</LabelCaps>
                        <View style={styles.segmentWide}>
                            {(home?.difficulties ?? ['easy', 'normal', 'hard']).map((difficulty) => (
                                <Pressable
                                    key={difficulty}
                                    onPress={() => setCreateLevel(difficulty)}
                                    style={[styles.seg, styles.segWide, createLevel === difficulty && styles.segOn]}
                                >
                                    <Text style={[styles.segText, createLevel === difficulty && styles.segTextOn]}>
                                        {t(`difficulty.${difficulty}`)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </>
                ) : null}

                <Btn
                    label={t('home.open_table')}
                    variant="gold"
                    disabled={!connected}
                    onPress={() => {
                        send({
                            type: 'create_room',
                            room_name: tableName.trim() || t('home.table_name_placeholder', { name }),
                            private: privateRoom,
                            mode: createMode,
                            turn_seconds: turnSeconds,
                            bots: createBots,
                            bot_difficulty: createLevel,
                        });
                        setCreating(false);
                        setTableName('');
                    }}
                />
            </Sheet>
        </>
    );
}

const styles = StyleSheet.create({
    wrap: { padding: 12, gap: 12 },
    card: { padding: 14, gap: 10 },
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
    tableRow: {
        gap: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: line.hairlineWhite10,
    },
    tableInfo: { gap: 2 },
    tableTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    code: {
        fontFamily: displayFont(900),
        fontSize: 13,
        letterSpacing: ls(0.18, 13),
        color: brand.brass,
    },
    tableName: { flex: 1, fontFamily: uiFont(700), fontSize: 14, color: ink.body },
    meta: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    tableActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    notice: {
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: '#ea3c3c22',
        borderWidth: 1,
        borderColor: status.danger,
    },
    noticeText: { fontFamily: uiFont(700), fontSize: 12, color: ink.body },
    reconnect: { fontFamily: uiFont(700), fontSize: 11, color: ink.endTurnHint },
});
