import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerView } from '../../types';
import { useI18n } from '../../i18n';
import { money } from '../../i18n/format';
import { Avatar } from '../../ui/kit';
import { GlassPanel as Panel } from '../table/TableGlass';
import { Card, CardBack } from '../../ui/card';
import { PropertySets } from './PropertySets';
import { brand, ink } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';

/** Only public state is rendered here; an opponent's hand is always card backs. */
export function ActiveBoard({ player, onOpen }: { player: PlayerView; onOpen: () => void }) {
    const { t } = useI18n();
    const [fanned, setFanned] = useState(false);
    const backs = Math.min(player.hand_count, 7);
    return <Panel style={styles.panel}>
        <View style={styles.header}>
            <Pressable style={styles.identity} onPress={onOpen} accessibilityRole="button"
                accessibilityLabel={`${player.name}: ${t('table.their_board')}`}>
                <Avatar id={player.id} name={player.name} size={26} active />
                <View style={styles.title}>
                    <Text style={styles.name} numberOfLines={1}>{t('table.turn_of', { name: player.name })}</Text>
                    <Text style={styles.bank}>{t('board.bank')}: {money(t, player.bank_total)}</Text>
                </View>
                <Text style={styles.name}>›</Text>
            </Pressable>
            <Pressable onPress={() => setFanned(v => !v)} style={styles.hand} accessibilityRole="button"
                accessibilityState={{ expanded: fanned }} accessibilityLabel={`${t('opponent.hand_title')}: ${player.hand_count}`}>
                <View style={{ width: fanned ? 64 : 32, height: 38 }} pointerEvents="none">
                    {Array.from({ length: backs }, (_, i) => <CardBack key={i} width={23} height={33}
                        borderWidth={1} radius={3} rotateDeg={fanned ? (i - (backs - 1) / 2) * 7 : 0}
                        style={{ position: 'absolute', left: i * (fanned ? 6 : 1), top: fanned ? 2 : i * 0.5 }} />)}
                </View>
                <Text style={styles.name}>{player.hand_count}</Text>
            </Pressable>
        </View>
        <ScrollView style={styles.content} contentContainerStyle={styles.contents}>
            <PropertySets sets={player.sets} size="activeBoard" />
            {player.bank.length > 0 ? <View>
                <Text style={styles.bank}>{t('board.bank')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bankCards}>
                    {player.bank.map(card => <Card key={card.id} card={card} size="bank" />)}
                </ScrollView>
            </View> : null}
        </ScrollView>
    </Panel>;
}

const styles = StyleSheet.create({
    panel: { flex: 1, minHeight: 104, padding: 8, borderColor: brand.brassGlow65, gap: 6, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    identity: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
    title: { flex: 1 },
    name: { fontFamily: uiFont(800), fontSize: 12, color: ink.body },
    bank: { fontFamily: uiFont(700), fontSize: 10, color: ink.muted60 },
    hand: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
    content: { flex: 1 },
    contents: { gap: 8, paddingBottom: 6 },
    bankCards: { gap: 4, paddingVertical: 6 },
});
