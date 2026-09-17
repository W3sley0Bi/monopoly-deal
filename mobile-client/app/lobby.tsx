import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { useGameConnectionContext } from '../lib/net/messages';
import { brand, ink, line, radius, status } from '../lib/theme';
import { displayFont, ls, uiFont } from '../lib/fonts';
import { Avatar, Btn, LabelCaps, Panel, Sheet } from '../src/ui/kit';
import { useI18n } from '../src/i18n';
import { formatTurn } from '../src/i18n/format';
import type { Difficulty, Mode } from '../src/types';
import { ChatPanel } from '../src/components/table/ChatPanel';

export default function LobbyScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { room, send, leave, notice } = useGameConnectionContext();
    const [invite, setInvite] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!room) router.replace('/');
        else if (room.game.state !== 'waiting') router.replace('/table');
    }, [room, router]);

    if (!room) return null;

    const g = room.game;
    const host = room.is_owner;
    const link = `deal://join/${room.id}`;

    /**
     * Every option travels in one `set_options`, so each setter has to resend
     * the values it is not changing — otherwise changing the mode silently
     * resets the timers.
     */
    const options = (patch: {
        mode?: Mode;
        turn_seconds?: number;
        respond_seconds?: number;
        bot_difficulty?: Difficulty;
    }) =>
        send({
            type: 'set_options',
            mode: patch.mode ?? g.mode,
            turn_seconds: patch.turn_seconds ?? g.turn_seconds,
            ...(patch.respond_seconds !== undefined ? { respond_seconds: patch.respond_seconds } : {}),
            ...(patch.bot_difficulty ? { bot_difficulty: patch.bot_difficulty } : {}),
        });

    const botCount = g.players.filter((p) => p.bot).length;

    return (
        <>
            <ScrollView contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + 24 }]}>
                <View style={styles.headRow}>
                    <View style={styles.headText}>
                        <Text style={styles.code}>{room.id}</Text>
                        <Text style={styles.name} numberOfLines={1}>
                            {room.name}
                        </Text>
                    </View>
                    <View style={styles.headActions}>
                        <Btn label={t('lobby.chat')} onPress={() => setChatOpen(true)} />
                        <Btn label={t('invite.open')} onPress={() => setInvite(true)} />
                    </View>
                </View>

                {notice ? (
                    <Text style={styles.notice}>
                        {notice.key ? t(notice.key, notice.args) : notice.text}
                    </Text>
                ) : null}

                {/* ---- seats ---- */}
                <Panel style={styles.card}>
                    <LabelCaps>{t('lobby.players')}</LabelCaps>
                    {g.players.map((p, i) => (
                        <View key={p.id} style={styles.seat}>
                            <Text style={styles.seatNum}>{i + 1}</Text>
                            <Avatar id={p.id} name={p.name} size={30} dimmed={!p.connected && !p.bot} />
                            <Text style={styles.seatName} numberOfLines={1}>
                                {p.name}
                                {p.id === room.owner_id ? ' 👑' : ''}
                                {p.id === room.you ? ` (${t('common.you')})` : ''}
                            </Text>
                            {p.bot ? <Text style={styles.tag}>{t('lobby.robot_tag')}</Text> : null}
                            {!p.connected && !p.bot ? <Text style={styles.tag}>{t('lobby.away')}</Text> : null}

                            {host && p.id !== room.owner_id ? (
                                <Pressable
                                    accessibilityLabel={t('lobby.remove')}
                                    onPress={() =>
                                        Alert.alert(t('lobby.remove_from_table'), p.name, [
                                            { text: t('common.cancel'), style: 'cancel' },
                                            {
                                                text: t('lobby.remove'),
                                                style: 'destructive',
                                                onPress: () => send({ type: 'kick', target_player_id: p.id }),
                                            },
                                        ])
                                    }
                                    style={styles.kick}
                                >
                                    <Text style={styles.kickText}>✕</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ))}

                    {!room.you_seated ? (
                        <Btn
                            label={room.seats_free > 0 ? t('lobby.take_seat') : t('lobby.table_full')}
                            disabled={room.seats_free <= 0}
                            onPress={() => send({ type: 'take_seat' })}
                        />
                    ) : null}
                </Panel>

                {/* ---- robots ---- */}
                <Panel style={styles.card}>
                    <LabelCaps>{t('lobby.robots')}</LabelCaps>
                    <View style={styles.row}>
                        <Btn
                            label={t('lobby.add_bot')}
                            disabled={!host || room.seats_free <= 0}
                            onPress={() => send({ type: 'add_bot' })}
                            style={styles.flex}
                        />
                        <Btn
                            label={t('lobby.remove_bot')}
                            disabled={!host || botCount === 0}
                            onPress={() => send({ type: 'remove_bot' })}
                            style={styles.flex}
                        />
                    </View>

                    <LabelCaps>{t('lobby.difficulty')}</LabelCaps>
                    <View style={styles.row}>
                        {room.difficulties.map((d) => (
                            <Pressable
                                key={d}
                                disabled={!host}
                                onPress={() => options({ bot_difficulty: d })}
                                style={[styles.seg, g.bot_difficulty === d && styles.segOn, !host && styles.segOff]}
                            >
                                <Text style={[styles.segText, g.bot_difficulty === d && styles.segTextOn]}>
                                    {t(`difficulty.${d}`)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </Panel>

                {/* ---- rules ---- */}
                <Panel style={styles.card}>
                    <LabelCaps>{t('lobby.game_mode')}</LabelCaps>
                    <View style={styles.row}>
                        {room.modes.map((m) => (
                            <Pressable
                                key={m.id}
                                disabled={!host || !m.available}
                                onPress={() => options({ mode: m.id })}
                                style={[
                                    styles.seg,
                                    g.mode === m.id && styles.segOn,
                                    (!host || !m.available) && styles.segOff,
                                ]}
                            >
                                <Text style={[styles.segText, g.mode === m.id && styles.segTextOn]}>
                                    {t(`mode.${m.id}`)}
                                </Text>
                                {!m.available ? <Text style={styles.soon}>{t('lobby.mode_soon')}</Text> : null}
                            </Pressable>
                        ))}
                    </View>

                    <LabelCaps>{t('lobby.turn_timer')}</LabelCaps>
                    <View style={styles.row}>
                        {room.turn_options.map((s) => (
                            <Pressable
                                key={s}
                                disabled={!host}
                                onPress={() => options({ turn_seconds: s })}
                                style={[styles.seg, g.turn_seconds === s && styles.segOn, !host && styles.segOff]}
                            >
                                <Text style={[styles.segText, g.turn_seconds === s && styles.segTextOn]}>
                                    {formatTurn(t, s)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <LabelCaps>{t('lobby.respond_timer')}</LabelCaps>
                    <View style={styles.row}>
                        {room.respond_options.map((s) => (
                            <Pressable
                                key={s}
                                disabled={!host}
                                onPress={() => options({ respond_seconds: s })}
                                style={[styles.seg, g.respond_seconds === s && styles.segOn, !host && styles.segOff]}
                            >
                                <Text style={[styles.segText, g.respond_seconds === s && styles.segTextOn]}>
                                    {formatTurn(t, s)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {!host ? <Text style={styles.hint}>{t('lobby.host_only')}</Text> : null}
                </Panel>

                {host ? (
                    <Btn
                        label={
                            g.players.length >= 2
                                ? t('lobby.deal', { mode: t(`mode.${g.mode}`) })
                                : t('lobby.need_player')
                        }
                        variant="gold"
                        disabled={g.players.length < 2}
                        onPress={() => send({ type: 'start_game' })}
                    />
                ) : (
                    <Text style={styles.hint}>
                        {t('lobby.waiting_host.before')}
                        {room.owner_name}
                        {t('lobby.waiting_host.after')}
                    </Text>
                )}

                <Btn label={t('lobby.leave')} variant="red" onPress={leave} />
            </ScrollView>

            <Sheet open={invite} onClose={() => setInvite(false)} title={t('invite.title')}>
                <Text style={styles.inviteCode}>{room.id}</Text>
                <Text style={styles.hint}>{room.private ? t('invite.private_hint') : t('invite.public_hint')}</Text>
                <Text style={styles.hint}>{t('invite.auto_join')}</Text>
                <Text style={styles.link} selectable>
                    {link}
                </Text>
                <Btn
                    label={copied ? t('invite.copied') : t('invite.copy')}
                    onPress={async () => {
                        await Clipboard.setStringAsync(link);
                        setCopied(true);
                    }}
                />
                {/* The web client could only copy a link; a phone can hand it
                    straight to whoever you are playing with. */}
                <Btn
                    label={t('invite.open')}
                    variant="gold"
                    onPress={() => Share.share({ message: link })}
                />
            </Sheet>

            <Sheet open={chatOpen} onClose={() => setChatOpen(false)} title={t('lobby.chat')} scroll={false}>
                <ChatPanel
                    chat={room.chat}
                    you={room.you}
                    onSend={(text) => send({ type: 'chat', text })}
                />
            </Sheet>
        </>
    );
}

const styles = StyleSheet.create({
    wrap: { padding: 12, gap: 12 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headText: { flex: 1 },
    headActions: { flexDirection: 'row', gap: 6 },
    code: { fontFamily: displayFont(900), fontSize: 22, color: brand.inviteCode, letterSpacing: ls(0.12, 22) },
    name: { fontFamily: uiFont(700), fontSize: 13, color: ink.muted60 },
    card: { padding: 14, gap: 10 },
    row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    flex: { flex: 1 },
    seat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    seatNum: { fontFamily: uiFont(800), fontSize: 11, color: ink.muted45, width: 14 },
    seatName: { flex: 1, fontFamily: uiFont(700), fontSize: 14, color: ink.body },
    tag: { fontFamily: uiFont(700), fontSize: 10, color: ink.muted45 },
    kick: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    kickText: { color: status.danger, fontSize: 15, fontFamily: uiFont(700) },
    seg: {
        minHeight: 40,
        flexGrow: 1,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: '#ffffff0f',
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
    },
    segOn: { backgroundColor: brand.brassGlow12, borderColor: brand.brass },
    segOff: { opacity: 0.45 },
    segText: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60 },
    segTextOn: { color: ink.body },
    soon: { fontFamily: uiFont(700), fontSize: 9, color: ink.muted45 },
    hint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    notice: { fontFamily: uiFont(700), fontSize: 12, color: status.danger },
    inviteCode: {
        fontFamily: displayFont(900),
        fontSize: 44,
        color: brand.inviteCode,
        letterSpacing: ls(0.2, 44),
        textAlign: 'center',
    },
    link: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60 },
});
