import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTableWindow } from '../../web/tableScale';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import type { GameView, PlayerView } from '../../types';
import { useI18n } from '../../i18n';
import { Avatar, LabelCaps } from '../../ui/kit';
import { brand, ink, line, radius, shadow, surface } from '../../../lib/theme';
import { displayFont, ls, uiFont } from '../../../lib/fonts';

const INTRO_MS = 4_500;
const SPIN_MS = 3_500;
const PLAYER_COLORS = ['#dce64e', '#78d6c8', '#f08a78', '#98a7ff', '#efc968'];

function point(center: number, radius: number, degrees: number) {
    const radians = (degrees - 90) * Math.PI / 180;
    return {
        x: center + radius * Math.cos(radians),
        y: center + radius * Math.sin(radians),
    };
}

function orderedPlayers(game: GameView): PlayerView[] {
    const byId = new Map(game.players.map((player) => [player.id, player]));
    return (game.start_sequence ?? [])
        .map((id) => byId.get(id))
        .filter((player): player is PlayerView => !!player);
}

function tickHaptic() {
    if (Platform.OS === 'android') {
        void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick).catch(() => undefined);
        return;
    }
    if (Platform.OS === 'ios') void Haptics.selectionAsync().catch(() => undefined);
}

function successHaptic() {
    if (Platform.OS === 'android') {
        void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
        return;
    }
    if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
}

function DialMarks({ size, count }: { size: number; count: number }) {
    const center = size / 2;
    const outerRadius = center - 11;
    const marks = Math.max(24, count * 8);

    return (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Circle
                cx={center}
                cy={center}
                r={outerRadius}
                fill="#042c33"
                stroke="#dce64e30"
                strokeWidth={1.5}
            />
            <Circle
                cx={center}
                cy={center}
                r={size * 0.335}
                fill="none"
                stroke="#9ee9d421"
                strokeWidth={1}
                strokeDasharray="3 7"
            />
            {Array.from({ length: marks }, (_, index) => {
                const degrees = index * (360 / marks);
                const major = index % 8 === 0;
                const from = point(center, outerRadius - (major ? 13 : 8), degrees);
                const to = point(center, outerRadius - 2, degrees);
                return (
                    <Line
                        key={index}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={major ? brand.brass : '#b8ccd05c'}
                        strokeWidth={major ? 2.5 : 1.5}
                        strokeLinecap="round"
                    />
                );
            })}
        </Svg>
    );
}

function DialSeat({
    player,
    index,
    count,
    size,
}: {
    player: PlayerView;
    index: number;
    count: number;
    size: number;
}) {
    const degrees = index * (360 / count) + (180 / count);
    const position = point(size / 2, size * 0.335, degrees);
    const avatarSize = Math.max(36, Math.min(48, size * 0.145));

    return (
        <View
            style={[
                styles.dialSeat,
                {
                    left: position.x - avatarSize / 2 - 4,
                    top: position.y - avatarSize / 2 - 4,
                    width: avatarSize + 8,
                    height: avatarSize + 8,
                    borderColor: PLAYER_COLORS[index % PLAYER_COLORS.length],
                },
            ]}
        >
            <Avatar id={player.id} name={player.name} size={avatarSize} />
        </View>
    );
}

export function StartWheel({
    game,
    skewMs,
    onSpin,
}: {
    game: GameView;
    skewMs: number;
    onSpin?: () => void;
}) {
    const { t } = useI18n();
    const { width, height } = useTableWindow();
    const reducedMotion = useReducedMotion();
    const startsAt = game.starts_at_ms ?? 0;
    const [now, setNow] = useState(() => Date.now() + skewMs);
    const mountedAt = useRef(now);
    const played = useRef(false);
    const announced = useRef(false);
    const rotation = useSharedValue(0);
    const reveal = useSharedValue(0);

    const sectors = useMemo(
        () => [...game.players].sort((a, b) => a.id.localeCompare(b.id)),
        [game.players],
    );
    const order = useMemo(() => orderedPlayers(game), [game]);
    const winner = order[0] ?? game.players[0];
    const angle = sectors.length ? 360 / sectors.length : 360;
    const winnerIndex = Math.max(0, sectors.findIndex((player) => player.id === winner?.id));
    const targetRotation = 1_800 - (winnerIndex + 0.5) * angle;
    const stopAt = startsAt - (INTRO_MS - SPIN_MS);
    const landed = now >= stopAt;
    const landscape = width > height && height < 540;
    const wheelSize = Math.floor(Math.min(
        330,
        width * (landscape ? 0.43 : 0.82),
        height * (landscape ? 0.67 : 0.45),
    ));

    useEffect(() => {
        if (!startsAt) return;
        setNow(Date.now() + skewMs);
        const timer = setInterval(() => {
            const current = Date.now() + skewMs;
            setNow(current);
            if (current >= startsAt) clearInterval(timer);
        }, 80);
        return () => clearInterval(timer);
    }, [skewMs, startsAt]);

    useEffect(() => {
        const current = Date.now() + skewMs;
        const remaining = Math.max(0, stopAt - current);
        rotation.value = reducedMotion || remaining === 0
            ? targetRotation
            : withTiming(targetRotation, {
                  duration: remaining,
                  easing: Easing.bezier(0.12, 0.72, 0.14, 1),
              });
    }, [reducedMotion, rotation, skewMs, stopAt, targetRotation]);

    useEffect(() => {
        const introStartedAt = startsAt - INTRO_MS;
        if (played.current || mountedAt.current - introStartedAt > 400) return;
        played.current = true;
        onSpin?.();
    }, [onSpin, startsAt]);

    useEffect(() => {
        if (!landed) return;
        reveal.value = reducedMotion
            ? 1
            : withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
        if (!announced.current && now < startsAt) {
            announced.current = true;
            successHaptic();
        }
    }, [landed, now, reducedMotion, reveal, startsAt]);

    useAnimatedReaction(
        () => Math.floor((rotation.value + angle / 2) / angle),
        (slot, previousSlot) => {
            if (!reducedMotion && previousSlot !== null && slot !== previousSlot) runOnJS(tickHaptic)();
        },
        [angle, reducedMotion],
    );

    const dialStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));
    const revealStyle = useAnimatedStyle(() => ({
        opacity: reveal.value,
        transform: [{ translateY: (1 - reveal.value) * 8 }, { scale: 0.96 + reveal.value * 0.04 }],
    }));

    if (!startsAt || game.state !== 'playing' || now >= startsAt || !winner || sectors.length < 2) return null;

    return (
        <View
            style={styles.overlay}
            accessibilityViewIsModal
            accessibilityLabel={t('wheel.title')}
        >
            <View style={[styles.stage, landscape && styles.stageLandscape]}>
                <View style={[styles.heading, landscape && styles.headingLandscape]}>
                    <View style={styles.eyebrowRow}>
                        <View style={styles.liveDot} />
                        <LabelCaps color={brand.brass}>{t('wheel.eyebrow')}</LabelCaps>
                    </View>
                    <Text style={[styles.title, landscape && styles.titleLandscape]}>{t('wheel.title')}</Text>
                    <Text style={[styles.blurb, landscape && styles.blurbLandscape]}>{t('wheel.fair')}</Text>
                </View>

                <View style={[styles.dialFrame, { width: wheelSize, height: wheelSize }]}>
                    <View style={styles.pointerHousing}>
                        <View style={styles.pointerStem} />
                        <View style={styles.pointerKnob} />
                    </View>

                    <Animated.View style={[styles.dial, dialStyle]}>
                        <DialMarks size={wheelSize} count={sectors.length} />
                        {sectors.map((player, index) => (
                            <DialSeat
                                key={player.id}
                                player={player}
                                index={index}
                                count={sectors.length}
                                size={wheelSize}
                            />
                        ))}
                    </Animated.View>

                    <View style={styles.hubShadow} />
                    <View style={styles.hub}>
                        <Text style={styles.hubTop}>{landed ? '01' : '•••'}</Text>
                        <Text style={styles.hubText}>DEAL</Text>
                    </View>
                </View>

                <View style={[styles.statusArea, landscape && styles.statusAreaLandscape]}>
                    {landed ? (
                        <Animated.View style={[styles.resultCard, revealStyle]} accessibilityLiveRegion="polite">
                            <View style={styles.winnerAvatar}>
                                <Avatar id={winner.id} name={winner.name} size={46} />
                            </View>
                            <View style={styles.resultCopy}>
                                <Text style={styles.resultLabel}>{t('wheel.order')}</Text>
                                <Text style={styles.winner} numberOfLines={1}>
                                    {t('wheel.winner', { name: winner.name })}
                                </Text>
                            </View>
                        </Animated.View>
                    ) : (
                        <View style={styles.spinningRow} accessibilityLiveRegion="polite">
                            <View style={styles.spinningBars}>
                                <View style={styles.spinningBarShort} />
                                <View style={styles.spinningBarTall} />
                                <View style={styles.spinningBarShort} />
                            </View>
                            <Text style={styles.spinning}>{t('wheel.spinning')}</Text>
                        </View>
                    )}

                    <Animated.View
                        pointerEvents={landed ? 'auto' : 'none'}
                        style={[styles.orderRail, revealStyle]}
                    >
                        {order.map((player, index) => (
                            <View key={player.id} style={[styles.orderItem, index === 0 && styles.orderItemFirst]}>
                                <Text style={[styles.orderNumber, index === 0 && styles.orderNumberFirst]}>
                                    {index + 1}
                                </Text>
                                <Avatar id={player.id} name={player.name} size={24} />
                                <Text style={styles.orderName} numberOfLines={1}>{player.name}</Text>
                            </View>
                        ))}
                    </Animated.View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 200,
        elevation: 200,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        paddingVertical: 12,
        backgroundColor: surface.startWheelOverlay,
    },
    stage: {
        width: '100%',
        maxWidth: 620,
        alignItems: 'center',
        gap: 15,
    },
    stageLandscape: {
        maxWidth: 860,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
    },
    heading: { alignItems: 'center', maxWidth: 430, gap: 4 },
    headingLandscape: { width: 190, alignItems: 'flex-start' },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: radius.pill,
        backgroundColor: brand.brass,
        shadowColor: brand.brass,
        shadowOpacity: 0.65,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 0 },
    },
    title: {
        fontFamily: displayFont(900),
        fontSize: 27,
        lineHeight: 30,
        textAlign: 'center',
        color: ink.body,
        letterSpacing: ls(-0.035, 27),
    },
    titleLandscape: { fontSize: 23, lineHeight: 26, textAlign: 'left' },
    blurb: {
        maxWidth: 360,
        fontFamily: uiFont(700),
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'center',
        color: ink.wheelCopy,
    },
    blurbLandscape: { textAlign: 'left' },
    dialFrame: {
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: '#8bd6ca45',
        backgroundColor: '#021b21',
        ...shadow.panel,
    },
    dial: { ...StyleSheet.absoluteFill, borderRadius: radius.pill, overflow: 'hidden' },
    dialSeat: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 2,
        backgroundColor: '#06242a',
        shadowColor: '#000000',
        shadowOpacity: 0.45,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 3 },
    },
    pointerHousing: {
        position: 'absolute',
        zIndex: 5,
        top: -13,
        left: '50%',
        width: 34,
        height: 46,
        marginLeft: -17,
        alignItems: 'center',
    },
    pointerStem: {
        width: 10,
        height: 29,
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: '#071b20',
        backgroundColor: brand.brass,
        ...shadow.glow,
    },
    pointerKnob: {
        width: 20,
        height: 20,
        marginTop: -8,
        borderRadius: radius.pill,
        borderWidth: 4,
        borderColor: '#06242a',
        backgroundColor: ink.cream,
    },
    hubShadow: {
        position: 'absolute',
        left: '34%',
        right: '34%',
        top: '34%',
        bottom: '34%',
        borderRadius: radius.pill,
        backgroundColor: '#000b0e',
        transform: [{ translateY: 4 }],
    },
    hub: {
        position: 'absolute',
        left: '34%',
        right: '34%',
        top: '34%',
        bottom: '34%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: '#ffffff26',
        backgroundColor: '#0a3036',
    },
    hubTop: {
        marginBottom: -2,
        fontFamily: uiFont(900),
        fontSize: 9,
        letterSpacing: 2,
        color: brand.brass,
    },
    hubText: {
        fontFamily: displayFont(900),
        fontSize: 17,
        fontStyle: 'italic',
        letterSpacing: ls(-0.025, 17),
        color: ink.cream,
    },
    statusArea: { width: '100%', minHeight: 108, alignItems: 'center', gap: 9 },
    statusAreaLandscape: { width: 235, alignItems: 'stretch', justifyContent: 'center' },
    spinningRow: {
        minHeight: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
    },
    spinningBars: { height: 18, flexDirection: 'row', alignItems: 'center', gap: 3 },
    spinningBarShort: { width: 3, height: 8, borderRadius: radius.pill, backgroundColor: brand.brass },
    spinningBarTall: { width: 3, height: 16, borderRadius: radius.pill, backgroundColor: brand.brass },
    spinning: { fontFamily: uiFont(800), fontSize: 13, color: ink.wheelCopy },
    resultCard: {
        width: '100%',
        maxWidth: 390,
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: brand.brassGlow65,
        backgroundColor: '#082a30f2',
        ...shadow.glow,
    },
    winnerAvatar: {
        padding: 3,
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: brand.brass,
        backgroundColor: '#041b20',
    },
    resultCopy: { flex: 1, gap: 1 },
    resultLabel: {
        fontFamily: uiFont(900),
        fontSize: 9,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        color: brand.brass,
    },
    winner: { fontFamily: displayFont(900), fontSize: 18, color: ink.body },
    orderRail: {
        maxWidth: 470,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    orderItem: {
        maxWidth: 132,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 4,
        paddingLeft: 4,
        paddingRight: 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: line.seat,
        backgroundColor: '#ffffff08',
    },
    orderItemFirst: { borderColor: '#dce64e80', backgroundColor: brand.brassGlow12 },
    orderNumber: {
        width: 20,
        height: 20,
        borderRadius: radius.pill,
        textAlign: 'center',
        lineHeight: 20,
        fontFamily: uiFont(900),
        fontSize: 10,
        color: ink.subtle,
        backgroundColor: '#ffffff0d',
    },
    orderNumberFirst: { color: '#172000', backgroundColor: brand.brass },
    orderName: { flexShrink: 1, fontFamily: uiFont(800), fontSize: 11, color: ink.headerTitle },
});

export default StartWheel;
