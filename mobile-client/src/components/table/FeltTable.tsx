import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { PlayerView } from '../../types';
import { colorMeta, moneyMeta } from '../../game/meta';
import { useStore } from '../../../lib/store';
import { useI18n } from '../../i18n';
import { uiFont } from '../../../lib/fonts';

function MiniCard({ color, value, fresh, left, top, complete = false }: {
    color: string; value?: number; fresh: boolean; left: number; top: number; complete?: boolean;
}) {
    const reduced = useReducedMotion();
    const motion = useStore(s => s.motion);
    const progress = useSharedValue(fresh && motion && !reduced ? 0 : 1);
    useEffect(() => {
        progress.value = withTiming(1, { duration: motion && !reduced ? 240 : 0, easing: Easing.out(Easing.cubic) });
    }, [progress, motion, reduced]);
    const animated = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [{ translateY: -12 * (1 - progress.value) }, { scale: 0.75 + 0.25 * progress.value }],
    }));
    return <Animated.View style={[styles.card, { left, top, borderColor: complete ? '#dce64e' : '#21433c' }, animated]}>
        <View style={{ height: 5, backgroundColor: color }} />
        {value !== undefined ? <Text style={styles.value}>{value}</Text> : null}
    </Animated.View>;
}

// A mini card is 13x19 and each card in a stack is offset, so a stack is
// CARD_W+FAN wide and CARD_H+FAN tall. The grid pitch has to clear that or
// neighbouring colours sit on top of each other.
const CARD_W = 13;
const CARD_H = 19;
const FAN_STEPS = 2;
const FAN = FAN_STEPS * 2;
const STACK_W = CARD_W + FAN;
const STACK_H = CARD_H + FAN;
const GAP = 3;
const COL = STACK_W + GAP;
const ROW = STACK_H + GAP;
const COLS = 3;

/** Stable seats and public cards only, matching the web FeltCards layer. */
export function FeltTable({
    players,
    you,
    cardAreaHeight,
    onOpenPlayer,
    onPreviewPlayer,
    onPreviewEnd,
}: {
    players: PlayerView[];
    you: string;
    cardAreaHeight: number;
    onOpenPlayer: (id: string) => void;
    onPreviewPlayer: (id: string) => void;
    onPreviewEnd: (id: string) => void;
}) {
    const { t } = useI18n();
    const [size, setSize] = useState({ width: 0, height: 0 });
    const previous = useRef<Set<string> | null>(null);
    const ids = new Set(players.flatMap(p => [...p.bank, ...p.sets.flatMap(s => s.cards)].map(c => c.id)));
    const fresh = (id: string) => previous.current !== null && !previous.current.has(id);
    useEffect(() => { previous.current = ids; });
    const start = players.findIndex(p => p.id === you);
    const seats = start < 0 ? players : [...players.slice(start), ...players.slice(0, start)];
    return <View style={styles.scene} pointerEvents="box-none"
        onLayout={e => setSize(e.nativeEvent.layout)}>
        <LinearGradient pointerEvents="none" colors={['#005d60', '#00847c', '#00645f']} locations={[0, 0.45, 1]} style={[styles.felt, { borderTopLeftRadius: size.width * 0.5, borderTopRightRadius: size.width * 0.5 }]}>
            <View style={[styles.orbit, { width: size.width * 0.6, height: size.width * 0.6, left: size.width * 0.2, top: Math.max(30, cardAreaHeight * 0.5 - size.width * 0.15) }]} />
            
        </LinearGradient>
        {size.width > 0 && seats.map((player, seat) => {
            const angle = Math.PI / 2 + seat * 2 * Math.PI / seats.length;
            const rotation = Math.round((angle * 180 / Math.PI - 90) / 90) * 90;
            const bank = [...player.bank].sort((a, b) => a.value - b.value).slice(-4);
            const columns = Math.min(COLS, player.sets.length);
            const rows = Math.ceil(player.sets.length / COLS);
            const propertyWidth = columns ? (columns - 1) * COL + STACK_W + GAP : 0;
            const pileWidth = Math.max(14, propertyWidth + (bank.length ? STACK_W : 0));
            const pileHeight = Math.max(STACK_H, rows * ROW - GAP);
            if (!player.sets.length && !bank.length) return null;
            return <CardPileButton
                key={player.id}
                playerId={player.id}
                onOpen={onOpenPlayer}
                onPreview={onPreviewPlayer}
                onPreviewEnd={onPreviewEnd}
                accessibilityLabel={`${player.name}: ${t('inspect.open_board')}`}
                style={[styles.seat, {
                left: size.width * (0.5 + Math.cos(angle) * 0.26) - 43,
                top: Math.max(90, cardAreaHeight) * (0.56 + Math.sin(angle) * 0.23) - 24,
            }]}>
                <View pointerEvents="none" style={[styles.piles, { width: pileWidth, height: pileHeight, transform: [{ rotate: `${rotation}deg` }] }]}>
                    {player.sets.map((set, group) => <View key={set.color} style={{ position: 'absolute', left: (group % COLS) * COL, top: Math.floor(group / COLS) * ROW }}>
                        {set.cards.map((card, i) => <MiniCard key={card.id} color={colorMeta(set.color).hex}
                            left={Math.min(i, FAN_STEPS) * 2} top={Math.min(i, FAN_STEPS) * 2} fresh={fresh(card.id)} complete={set.complete} />)}
                    </View>)}
                    {bank.map((card, i) => <MiniCard key={card.id} color={moneyMeta(card.value).hex}
                        value={card.value} left={propertyWidth + Math.min(bank.length - 1 - i, FAN_STEPS) * 2}
                        top={Math.min(bank.length - 1 - i, FAN_STEPS) * 2} fresh={fresh(card.id)} />)}
                </View>
            </CardPileButton>;
        })}
    </View>;
}

function CardPileButton({
    playerId,
    onOpen,
    onPreview,
    onPreviewEnd,
    children,
    style,
    accessibilityLabel,
}: {
    playerId: string;
    onOpen: (id: string) => void;
    onPreview: (id: string) => void;
    onPreviewEnd: (id: string) => void;
    children: React.ReactNode;
    style: StyleProp<ViewStyle>;
    accessibilityLabel: string;
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
                onPreview(playerId);
            }}
            onPressOut={() => {
                if (!holding.current) return;
                holding.current = false;
                onPreviewEnd(playerId);
            }}
            onPress={() => {
                if (suppressTap.current) {
                    suppressTap.current = false;
                    return;
                }
                onOpen(playerId);
            }}
        >
            {children}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    scene: { flex: 1 },
    felt: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 2, borderColor: '#8ddfcb40' },
    orbit: { position: 'absolute', borderRadius: 200, borderWidth: 1, borderColor: '#a5e9d833', borderStyle: 'dashed' },
    seat: { position: 'absolute', width: 86, height: 76, gap: 7 },
    piles: { width: 86, height: 54 },
    card: { position: 'absolute', width: 13, height: 19, backgroundColor: '#f7f2df', borderWidth: 1, borderRadius: 2, overflow: 'hidden', boxShadow: '0px 2px 3px #001b2166' },
    value: { fontFamily: uiFont(900), fontSize: 8, color: '#183139', textAlign: 'center' },
});
