import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ChatMessage } from '../../types';
import { useI18n } from '../../i18n';
import { Avatar, Icon } from '../../ui/kit';
import { brand, ink, line, radius, surface } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';

function clock(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * The table's chat, as on the web minus the GIF picker.
 *
 * `tChat` is what keeps the two kinds of line apart: a server notice is a key
 * and renders in the reader's own language, a player's message is text and is
 * shown exactly as it was typed.
 */
export function ChatPanel({ chat, you, onSend }: {
    chat: ChatMessage[];
    you: string;
    onSend: (text: string) => void;
}) {
    const { t, tChat } = useI18n();
    const [draft, setDraft] = useState('');
    const list = useRef<ScrollView>(null);

    const submit = () => {
        const text = draft.trim();
        if (!text) return;
        onSend(text);
        setDraft('');
    };

    return (
        <View style={styles.wrap}>
            <ScrollView
                ref={list}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            >
                {chat.length === 0 ? <Text style={styles.empty}>{t('chat.empty')}</Text> : null}
                {chat.map((m) =>
                    m.system ? (
                        <Text key={m.id} style={styles.system}>{tChat(m)}</Text>
                    ) : (
                        <View key={m.id} style={[styles.row, m.player_id === you && styles.rowMine]}>
                            <Avatar id={m.player_id} name={m.name} size={22} />
                            <View style={[styles.bubble, m.player_id === you && styles.bubbleMine]}>
                                <View style={styles.meta}>
                                    <Text style={styles.name}>{m.name}</Text>
                                    <Text style={styles.time}>{clock(m.at_ms)}</Text>
                                </View>
                                <Text style={styles.text}>{tChat(m)}</Text>
                            </View>
                        </View>
                    ),
                )}
            </ScrollView>

            <View style={styles.composer}>
                <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={t('chat.placeholder')}
                    placeholderTextColor={ink.muted45}
                    style={styles.input}
                    maxLength={240}
                    returnKeyType="send"
                    onSubmitEditing={submit}
                    blurOnSubmit={false}
                />
                <Pressable
                    onPress={submit}
                    disabled={!draft.trim()}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.send')}
                    style={({ pressed }) => [styles.send, !draft.trim() && styles.sendOff, pressed && styles.sendPressed]}
                >
                    <Icon name="arrow.up" fallback="↑" size={16} color="#10261c" />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // The sheet sizes itself to its content, so the panel has to ask for the
    // room it wants; `maxHeight` on the sheet (and the keyboard) caps it.
    wrap: { flex: 1, minHeight: 300, gap: 8 },
    // No cap: the sheet decides how much room there is, and it already takes
    // the keyboard into account.
    list: { flex: 1 },
    listContent: { gap: 6, paddingBottom: 4 },
    empty: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted45, fontStyle: 'italic', paddingVertical: 8 },
    system: {
        textAlign: 'center',
        fontFamily: uiFont(700),
        fontSize: 10,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: ink.muted45,
        paddingVertical: 2,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    // Your own lines run the other way, the way every messaging app has taught
    // everyone to read a conversation.
    rowMine: { flexDirection: 'row-reverse' },
    bubble: {
        maxWidth: '80%',
        gap: 1,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: surface.panelOverlay,
    },
    bubbleMine: { backgroundColor: brand.brassGlow12 },
    meta: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    name: { fontFamily: uiFont(800), fontSize: 10, color: ink.muted60 },
    time: { fontFamily: uiFont(700), fontSize: 9, color: ink.muted45 },
    text: { fontFamily: uiFont(700), fontSize: 13, color: ink.body },
    composer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: line.seat,
        paddingTop: 8,
    },
    input: {
        flex: 1,
        minHeight: 42,
        paddingHorizontal: 12,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: surface.panelOverlay,
        borderWidth: 1,
        borderColor: line.seat,
        fontFamily: uiFont(700),
        fontSize: 14,
        color: ink.body,
    },
    send: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: brand.brass,
    },
    sendOff: { opacity: 0.35 },
    sendPressed: { opacity: 0.8 },
});

export default ChatPanel;
