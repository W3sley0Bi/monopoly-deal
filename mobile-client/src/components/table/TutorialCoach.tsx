import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import Animated, {
    Easing,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import type { TutorialProps } from '../../../lib/contracts';
import { brand, ink, line, radius, status, surface } from '../../../lib/theme';
import { displayFont, ls, uiFont } from '../../../lib/fonts';
import { useI18n } from '../../i18n';
import { Btn, LabelCaps } from '../../ui/kit';

export type TutorialFocus = 'hand' | 'properties' | 'bank' | 'action' | 'controls';

export interface TutorialAnchors {
    hand?: LayoutRectangle;
    /** Exact playable card in the hand, already translated into table space. */
    card?: LayoutRectangle;
    properties?: LayoutRectangle;
    bank?: LayoutRectangle;
    action?: LayoutRectangle;
    controls?: LayoutRectangle;
}

interface LessonHint {
    focus?: TutorialFocus;
    gesture?: 'drag' | 'tap';
}

const HINTS: Record<string, LessonHint> = {
    hand: { focus: 'hand' },
    property: { focus: 'properties', gesture: 'drag' },
    wildcard: { focus: 'properties', gesture: 'drag' },
    // Dropping the any-colour wildcard opens the native colour choice sheet.
    wildcard_any: { focus: 'properties', gesture: 'drag' },
    tapping: { focus: 'hand', gesture: 'tap' },
    bank: { focus: 'bank', gesture: 'drag' },
    pass_go: { focus: 'action', gesture: 'drag' },
    end_turn: { focus: 'controls', gesture: 'tap' },
    rent: { focus: 'action', gesture: 'drag' },
    double_rent: { focus: 'action', gesture: 'drag' },
    sly_deal: { focus: 'action', gesture: 'drag' },
    forced_deal: { focus: 'action', gesture: 'drag' },
    deal_breaker: { focus: 'action', gesture: 'drag' },
    house: { focus: 'action', gesture: 'drag' },
    win: { focus: 'properties', gesture: 'drag' },
};

type Props = TutorialProps & {
    anchors: TutorialAnchors;
    screenWidth: number;
    screenHeight: number;
    /** Insets are expressed in the same table-local coordinate space as the
     * anchors. They keep the coach below the Dynamic Island and above Home. */
    safeTop: number;
    safeBottom: number;
};

/**
 * Native coach for the scripted tutorial table.
 *
 * The backend owns the lesson and completion state. This layer owns the
 * pointing, touch vocabulary and pacing. It deliberately disappears while a
 * card, dialog or payment panel has the player's attention.
 */
export function TutorialCoach({
    tutorial,
    compact,
    carrying,
    paused,
    onNext,
    onSkip,
    pendingNext,
    anchors,
    screenWidth,
    screenHeight,
    safeTop,
    safeBottom,
}: Props) {
    const { t } = useI18n();
    const reducedMotion = useReducedMotion();
    const entrance = useSharedValue(0);
    const [coachHeight, setCoachHeight] = useState(230);

    const hint = tutorial ? (HINTS[tutorial.id] ?? {}) : {};
    const focus = hint.focus ? anchors[hint.focus] : undefined;
    // Only End Turn starts on a control. Card lessons wait for the exact card
    // measurement; falling back to the hand points at an unrelated card.
    const source = tutorial?.id === 'end_turn' ? focus : anchors.card;

    useEffect(() => {
        if (!tutorial) return;
        AccessibilityInfo.announceForAccessibility(
            `${t(`lesson.${tutorial.id}.title`)}. ${t(`lesson.${tutorial.id}.body`)}`,
        );
        entrance.value = 0;
        entrance.value = withTiming(1, {
            duration: reducedMotion ? 0 : 220,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
    }, [entrance, reducedMotion, t, tutorial?.id]);

    const cardMotion = useAnimatedStyle(() => ({
        opacity: entrance.value,
        transform: [{ translateY: interpolate(entrance.value, [0, 1], [-10, 0]) }],
    }));

    if (!tutorial || compact || carrying || paused) return null;

    const title = t(`lesson.${tutorial.id}.title`);
    const body = t(`lesson.${tutorial.id}.body`);
    const task = t(`lesson.${tutorial.id}.task`);
    const ready = !tutorial.task || tutorial.done;
    const gestureCopy = hint.gesture ? t(`tutorial.gesture.${hint.gesture}_touch`) : null;
    const cardWidth = Math.min(screenWidth - 24, screenWidth > screenHeight ? 360 : 420);
    const pad = 6;
    const pointing = !tutorial.task || !tutorial.done;
    const destinationHole = pointing && focus
        ? expandRect(focus, pad, screenWidth, screenHeight)
        : null;
    const sourceHole = tutorial.task && !tutorial.done && anchors.card
        ? expandRect(anchors.card, pad, screenWidth, screenHeight)
        : null;
    const holes = [destinationHole, sourceHole].filter((rect): rect is LayoutRectangle => rect !== null);
    const coachPlacement = placeCoach(holes, coachHeight, screenHeight, safeTop, safeBottom);

    return (
        <View pointerEvents="box-none" style={styles.overlay} accessibilityViewIsModal>
            <Spotlight holes={holes} width={screenWidth} height={screenHeight} />

            {destinationHole ? <View pointerEvents="none" style={[styles.focusRing, {
                left: destinationHole.x,
                top: destinationHole.y,
                width: destinationHole.width,
                height: destinationHole.height,
            }]} /> : null}
            {sourceHole ? <SourceRing rect={sourceHole} reducedMotion={reducedMotion} /> : null}

            {tutorial.task && !tutorial.done && hint.gesture && focus && source ? (
                <GestureCue
                    gesture={hint.gesture}
                    from={source}
                    to={focus}
                    reducedMotion={reducedMotion}
                />
            ) : null}

            <Animated.View
                style={[
                    styles.card,
                    {
                        width: cardWidth,
                        left: (screenWidth - cardWidth) / 2,
                        top: coachPlacement.top,
                        maxHeight: coachPlacement.maxHeight,
                    },
                    cardMotion,
                ]}
                onLayout={(e) => {
                    const height = e.nativeEvent.layout.height;
                    setCoachHeight((current) => Math.abs(current - height) > 1 ? height : current);
                }}
            >
                <View style={styles.kickerRow}>
                    <LabelCaps color={brand.brass}>
                        {t('tutorial.progress', { current: tutorial.step, total: tutorial.total })}
                    </LabelCaps>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('tutorial.skipTour')}
                        onPress={() => {
                            void Haptics.selectionAsync();
                            onSkip();
                        }}
                        hitSlop={10}
                        style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
                    >
                        <Text style={styles.skipText}>{t('tutorial.skipTour')}</Text>
                    </Pressable>
                </View>

                <ScrollView
                    style={styles.coachBody}
                    contentContainerStyle={styles.coachBodyContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    <Text style={styles.title} accessibilityRole="header">{title}</Text>
                    <Text style={styles.body}>{body}</Text>

                    {tutorial.task ? (
                        <View style={[styles.task, tutorial.done && styles.taskDone]}>
                            <SymbolView
                                name={tutorial.done ? 'checkmark.circle.fill' : 'arrow.right.circle.fill'}
                                size={16}
                                weight="semibold"
                                tintColor={tutorial.done ? status.take : ink.endTurnHint}
                                fallback={<Text style={[styles.taskIcon, tutorial.done && styles.taskIconDone]}>{tutorial.done ? '✓' : '→'}</Text>}
                                style={styles.taskSymbol}
                            />
                            <Text style={[styles.taskText, tutorial.done && styles.taskTextDone]} numberOfLines={2}>
                                {tutorial.done ? t('tutorial.taskDone') : task}
                            </Text>
                        </View>
                    ) : null}

                    {tutorial.task && !tutorial.done && gestureCopy ? (
                        <View style={styles.gestureRow}>
                            <SymbolView
                                name={hint.gesture === 'drag' ? 'hand.draw.fill' : 'hand.tap.fill'}
                                size={15}
                                weight="medium"
                                tintColor={ink.muted60}
                                fallback={<Text style={styles.gestureFallback}>☝︎</Text>}
                                style={styles.gestureSymbol}
                            />
                            <Text style={styles.gestureText}>{gestureCopy}</Text>
                        </View>
                    ) : null}

                    {ready ? (
                        <Text style={styles.readyText} accessibilityLiveRegion="polite">
                            {tutorial.step >= tutorial.total ? t('tutorial.pressFinish') : t('tutorial.pressNext')}
                        </Text>
                    ) : null}
                </ScrollView>

                <View style={styles.footer}>
                    <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                        {Array.from({ length: tutorial.total }, (_, i) => (
                            <View key={i} style={[styles.progressBit, i < tutorial.step && styles.progressBitOn]} />
                        ))}
                    </View>
                    <Btn
                        label={
                            tutorial.step >= tutorial.total
                                ? t('tutorial.finish')
                                : tutorial.task && !tutorial.done
                                  ? t('tutorial.skipStep')
                                  : t('common.next')
                        }
                        variant={ready ? 'gold' : 'ghost'}
                        pending={pendingNext}
                        disabled={pendingNext}
                        onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onNext();
                        }}
                        style={styles.next}
                    />
                </View>
            </Animated.View>
        </View>
    );
}

function expandRect(
    rect: LayoutRectangle,
    padding: number,
    width: number,
    height: number,
): LayoutRectangle {
    const x = Math.max(4, rect.x - padding);
    const y = Math.max(4, rect.y - padding);
    const right = Math.min(width - 4, rect.x + rect.width + padding);
    const bottom = Math.min(height - 4, rect.y + rect.height + padding);
    return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** Park in the larger free band, never directly over the lesson geometry. */
function placeCoach(
    holes: LayoutRectangle[],
    coachHeight: number,
    screenHeight: number,
    safeTop: number,
    safeBottom: number,
): { top: number; maxHeight: number } {
    const topEdge = Math.max(10, safeTop);
    const bottomEdge = Math.max(10, safeBottom);
    const gap = 12;
    const usableBottom = screenHeight - bottomEdge;
    if (holes.length === 0) {
        return { top: topEdge, maxHeight: Math.max(80, usableBottom - topEdge) };
    }

    const occupiedTop = Math.min(...holes.map((rect) => rect.y));
    const occupiedBottom = Math.max(...holes.map((rect) => rect.y + rect.height));
    const above = Math.max(0, occupiedTop - gap - topEdge);
    const below = Math.max(0, usableBottom - occupiedBottom - gap);

    if (above >= coachHeight || above >= below) {
        return { top: topEdge, maxHeight: Math.max(80, above) };
    }
    return { top: occupiedBottom + gap, maxHeight: Math.max(80, below) };
}

function Spotlight({
    holes,
    width,
    height,
}: {
    holes: LayoutRectangle[];
    width: number;
    height: number;
}) {
    if (holes.length === 0) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />;

    return (
        <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
            <Defs>
                <Mask
                    id="tutorial-spotlight-mask"
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    maskUnits="userSpaceOnUse"
                >
                    <Rect x={0} y={0} width={width} height={height} fill="white" />
                    {holes.map((hole, index) => (
                        <Rect
                            key={index}
                            x={hole.x}
                            y={hole.y}
                            width={hole.width}
                            height={hole.height}
                            rx={radius.xl}
                            fill="black"
                        />
                    ))}
                </Mask>
            </Defs>
            <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="#00080bb8"
                mask="url(#tutorial-spotlight-mask)"
            />
        </Svg>
    );
}

function SourceRing({ rect, reducedMotion }: { rect: LayoutRectangle; reducedMotion: boolean }) {
    const pulse = useSharedValue(0);

    useEffect(() => {
        pulse.value = reducedMotion
            ? 0
            : withRepeat(
                  withSequence(
                      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
                      withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) }),
                  ),
                  -1,
              );
        return () => cancelAnimation(pulse);
    }, [pulse, reducedMotion]);

    const animated = useAnimatedStyle(() => ({
        opacity: reducedMotion ? 1 : interpolate(pulse.value, [0, 1], [0.72, 1]),
        transform: [{ scale: reducedMotion ? 1 : interpolate(pulse.value, [0, 1], [1, 1.045]) }],
    }));

    // LayoutRectangle uses x/y (also accepted by SVG), whereas View styles
    // require left/top. Passing rect directly silently pins the ring to 0,0.
    return <Animated.View pointerEvents="none" style={[styles.sourceRing, {
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
    }, animated]} />;
}

function GestureCue({
    gesture,
    from,
    to,
    reducedMotion,
}: {
    gesture: 'drag' | 'tap';
    from: LayoutRectangle;
    to: LayoutRectangle;
    reducedMotion: boolean;
}) {
    const travel = useSharedValue(0);
    const start = useMemo(
        () => ({ x: from.x + from.width / 2, y: from.y + from.height / 2 }),
        [from.height, from.width, from.x, from.y],
    );
    const end = useMemo(
        () => ({ x: to.x + to.width / 2, y: to.y + to.height / 2 }),
        [to.height, to.width, to.x, to.y],
    );

    useEffect(() => {
        cancelAnimation(travel);
        if (reducedMotion) {
            travel.value = gesture === 'drag' ? 1 : 0;
            return;
        }
        travel.value = 0;
        travel.value = withRepeat(
            withSequence(
                withDelay(500, withTiming(1, { duration: gesture === 'drag' ? 950 : 240, easing: Easing.inOut(Easing.quad) })),
                withDelay(450, withTiming(0, { duration: 0 })),
            ),
            -1,
        );
        return () => cancelAnimation(travel);
    }, [gesture, reducedMotion, travel]);

    const motion = useAnimatedStyle(() => {
        const p = gesture === 'tap' ? 0 : travel.value;
        return {
            opacity: reducedMotion ? 0.85 : interpolate(travel.value, [0, 0.12, 0.85, 1], [0, 1, 1, 0]),
            transform: [
                { translateX: (end.x - start.x) * p },
                { translateY: (end.y - start.y) * p },
                { scale: gesture === 'tap' ? interpolate(travel.value, [0, 0.45, 1], [1, 0.78, 1]) : 1 },
            ],
        };
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[styles.gestureCue, { left: start.x - 20, top: start.y - 20 }, motion]}
        >
            <View style={styles.gestureHalo} />
            <SymbolView
                name={gesture === 'drag' ? 'hand.draw.fill' : 'hand.tap.fill'}
                size={25}
                weight="semibold"
                tintColor={ink.cream}
                fallback={<Text style={styles.gestureCueFallback}>☝︎</Text>}
                style={styles.gestureCueSymbol}
            />
        </Animated.View>
    );
}

const LEAVE_MS = 6000;

/** The scripted table has no rematch; completion returns to the real tables. */
export function TutorialDone({ onLeave }: { onLeave: () => void }) {
    const { t } = useI18n();
    const [seconds, setSeconds] = useState(Math.round(LEAVE_MS / 1000));

    useEffect(() => {
        const tick = setInterval(() => setSeconds((n) => Math.max(0, n - 1)), 1000);
        const leaveTimer = setTimeout(onLeave, LEAVE_MS);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(t('tutorial.welcome'));
        return () => {
            clearInterval(tick);
            clearTimeout(leaveTimer);
        };
    }, [onLeave, t]);

    return (
        <View style={styles.doneOverlay} accessibilityViewIsModal>
            <View style={styles.doneCard}>
                <Image source={require('../../../assets/icon.png')} style={styles.doneIcon} contentFit="cover" />
                <LabelCaps color={brand.brass}>{t('tutorial.label')}</LabelCaps>
                <Text style={styles.doneTitle} accessibilityRole="header">{t('tutorial.welcome')}</Text>
                <Text style={styles.doneBody}>{t('tutorial.welcome_body')}</Text>
                <Btn label={t('tutorial.welcome_action')} variant="gold" onPress={onLeave} style={styles.doneButton} />
                <Text style={styles.doneSoon} accessibilityLiveRegion="polite">
                    {t('tutorial.welcome_soon', { seconds })}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFill, zIndex: 260, elevation: 30 },
    dim: { backgroundColor: '#00080bb8' },
    focusRing: {
        position: 'absolute',
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        borderWidth: 2,
        borderColor: brand.brass,
        boxShadow: `0 0 24px ${brand.brassGlow65}`,
    },
    sourceRing: {
        position: 'absolute',
        borderRadius: radius.card + 6,
        borderCurve: 'continuous',
        borderWidth: 3,
        borderColor: brand.brass,
        backgroundColor: brand.brassGlow12,
        boxShadow: `0 0 30px ${brand.brassGlow65}`,
    },
    card: {
        position: 'absolute',
        backgroundColor: surface.panelOverlay,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: brand.brassGlow65,
        padding: 14,
        gap: 7,
        shadowColor: '#00070a',
        shadowOpacity: 0.7,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 12 },
        elevation: 24,
    },
    coachBody: { flexShrink: 1 },
    coachBodyContent: { gap: 7 },
    kickerRow: { minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 8 },
    skip: { marginLeft: 'auto', minHeight: 28, justifyContent: 'center', paddingHorizontal: 7, borderRadius: radius.sm },
    skipPressed: { backgroundColor: '#ffffff12' },
    skipText: { fontFamily: uiFont(800), fontSize: 11, color: ink.muted60 },
    title: { fontFamily: displayFont(900), fontSize: 22, lineHeight: 24, color: brand.brass, letterSpacing: ls(0.015, 22) },
    body: { fontFamily: uiFont(700), fontSize: 13, lineHeight: 18, color: ink.muted60 },
    task: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        minHeight: 34,
        borderRadius: radius.md,
        paddingHorizontal: 10,
        paddingVertical: 7,
        backgroundColor: '#dce64e1a',
        borderWidth: 1,
        borderColor: '#dce64e33',
    },
    taskDone: { backgroundColor: '#0fbd5921', borderColor: '#63ea8942' },
    taskSymbol: { width: 16, height: 16 },
    taskIcon: { color: ink.endTurnHint, fontFamily: uiFont(900), fontSize: 15 },
    taskIconDone: { color: status.take },
    taskText: { flex: 1, fontFamily: uiFont(800), fontSize: 12, lineHeight: 16, color: ink.endTurnHint },
    taskTextDone: { color: status.take },
    gestureRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    gestureSymbol: { width: 16, height: 16 },
    gestureFallback: { color: ink.muted60, fontSize: 14 },
    gestureText: { flex: 1, fontFamily: uiFont(700), fontSize: 11, lineHeight: 15, color: ink.muted55 },
    readyText: { fontFamily: uiFont(800), fontSize: 11, color: brand.brass },
    footer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
    progress: { flex: 1, flexDirection: 'row', gap: 2 },
    progressBit: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#ffffff26' },
    progressBitOn: { backgroundColor: brand.brass },
    next: { minWidth: 92, minHeight: 38, paddingHorizontal: 12 },
    gestureCue: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gestureHalo: { ...StyleSheet.absoluteFill, borderRadius: 20, backgroundColor: '#dce64e42', borderWidth: 1, borderColor: brand.brass },
    gestureCueSymbol: { width: 26, height: 26 },
    gestureCueFallback: { color: ink.cream, fontSize: 24 },
    doneOverlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 400,
        elevation: 40,
        backgroundColor: surface.tourOverlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    doneCard: {
        width: '100%',
        maxWidth: 420,
        alignItems: 'center',
        gap: 10,
        padding: 22,
        borderRadius: radius.modal,
        borderCurve: 'continuous',
        backgroundColor: surface.panel,
        borderWidth: 1,
        borderColor: line.panel,
    },
    doneIcon: { width: 72, height: 72, borderRadius: 17, marginBottom: 2 },
    doneTitle: { fontFamily: displayFont(900), fontSize: 28, lineHeight: 31, color: brand.brass, textAlign: 'center' },
    doneBody: { fontFamily: uiFont(700), fontSize: 14, lineHeight: 20, color: ink.muted60, textAlign: 'center' },
    doneButton: { alignSelf: 'stretch', marginTop: 4 },
    doneSoon: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
});

export default TutorialCoach;
