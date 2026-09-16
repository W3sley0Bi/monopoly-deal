import { useCallback, useEffect, useRef, type Ref } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

import { useDragLayer } from './registry';
import { useDragShared } from './DragLayer';
import { GlassLayer } from '../../components/table/TableGlass';
import { ink, radius, status, surface } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';
import type { Card } from '../../types';

interface Props {
    id: string;
    /** Whether this zone can accept the card currently being carried. The
     *  caller computes it (`dropTargets()` / `moveColors()`), not the zone. */
    active: boolean;
    onDrop: (card: Card) => void;
    hint?: string;
    /** The eligible target grows and the ineligible one shrinks — decided once
     *  when the card leaves the hand, never re-aimed mid-drag. */
    grow?: number;
    children?: React.ReactNode;
    style?: object;
    /** Renders the table's glass fill behind the zone's own state tint, so a
     *  zone can sit next to the board and hand panels without reading as a
     *  different material. */
    glass?: boolean;
    /** Optional table-local geometry hook used by the native tutorial coach. */
    onLayout?: (event: LayoutChangeEvent) => void;
    /** Exposes the native zone only for cross-tree tutorial measurement. */
    targetRef?: Ref<View>;
}

export function DropZone({ id, active, onDrop, hint, grow, children, style, glass, onLayout, targetRef }: Props) {
    const layer = useDragLayer();
    const shared = useDragShared();
    const ref = useRef<View>(null);

    const carrying = !!layer.dragging;

    const measure = useCallback(
        () =>
            new Promise<{ id: string; x: number; y: number; w: number; h: number; active: boolean } | null>(
                (resolve) => {
                    const node = ref.current;
                    if (!node) return resolve(null);
                    node.measureInWindow((x, y, w, h) => {
                        if (!w || !h) return resolve(null);
                        // `active` rides along with the rect: the hit-test runs on
                        // the UI thread and cannot read the registry.
                        resolve({ id, x, y, w, h, active });
                    });
                },
            ),
        [id, active],
    );

    // Re-registered whenever eligibility or the handler changes, so the closure
    // the layer invokes on drop is always the current one.
    useEffect(() => layer.register({ id, active, onDrop, measure }), [layer, id, active, onDrop, measure]);

    // The zone resizes when it becomes eligible, so its rect has to be retaken.
    useEffect(() => {
        if (carrying) layer.refresh();
    }, [carrying, active, layer]);

    const over = useDerivedValue(() => (shared.hoveredId.value === id ? 1 : 0));
    const eligible = useSharedValue(0);
    const inert = useSharedValue(0);
    const pulse = useSharedValue(0);

    const attachRef = useCallback((node: View | null) => {
        ref.current = node;
        if (typeof targetRef === 'function') targetRef(node);
        else if (targetRef) targetRef.current = node;
    }, [targetRef]);

    useEffect(() => {
        const live = carrying && active;
        eligible.value = withTiming(live ? 1 : 0, { duration: 160 });
        // Carries the "not this one" signal, so the zone can say it in tone
        // rather than by shrinking itself out of legibility.
        inert.value = withTiming(carrying && !active ? 1 : 0, { duration: 160 });
        // A slow breath while a zone is merely available — enough to read as
        // "this one will take it" without competing with the card in the air.
        pulse.value = live
            ? withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true)
            : withTiming(0, { duration: 160 });
    }, [carrying, active, eligible, inert, pulse]);

    const animated = useAnimatedStyle(() => {
        const o = over.value;
        const e = eligible.value;
        return {
            borderWidth: interpolate(e + o, [0, 1, 2], [1, 2, 2.5]),
            borderColor: interpolateColor(
                o ? 2 : e * (0.65 + 0.35 * pulse.value),
                [0, 1, 2],
                ['#ffffff14', status.dropLive, status.dropOver],
            ),
            // A glass zone paints its state on top of the blur instead: a colour
            // on the container would sit behind it and never be seen.
            backgroundColor: glass
                ? surface.dropSlot
                : interpolateColor(e + o, [0, 1, 2], [surface.dropSlot, '#e5cc8914', '#f9d46029']),
            opacity: 1 - 0.45 * inert.value,
            transform: [{ scale: withTiming(o ? 1.06 : 1, { duration: 140 }) }],
        };
    });

    const fill = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(
            eligible.value + over.value,
            [0, 1, 2],
            ['transparent', '#e5cc8914', '#f9d46029'],
        ),
    }));

    const hintStyle = useAnimatedStyle(() => ({
        opacity: withTiming(eligible.value ? 1 : 0, { duration: 140 }),
        color: interpolateColor(over.value, [0, 1], [ink.endTurnHint, status.dropOver]),
    }));

    return (
        <Animated.View
            ref={attachRef}
            collapsable={false}
            onLayout={onLayout}
            style={[styles.zone, glass && styles.glassZone, { flexGrow: grow ?? 1 }, animated, style]}
        >
            {glass ? <>
                <GlassLayer radius={radius.lg - 1} />
                <Animated.View pointerEvents="none" style={[styles.glassFill, fill]} />
            </> : null}
            {children}
            {hint ? (
                <Animated.Text style={[styles.hint, hintStyle]} numberOfLines={1}>
                    {hint}
                </Animated.Text>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    zone: {
        minHeight: 52,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        gap: 2,
        // Anchors the scale to the bottom edge, so a zone growing under a thumb
        // never moves out from under it.
        transformOrigin: 'center bottom',
    },
    glassZone: {
        borderCurve: 'continuous',
        borderColor: '#d8fff044',
        boxShadow: '0 8px 24px #00181f52',
        // The reduced-transparency fallback: GlassLayer renders nothing then.
        backgroundColor: 'transparent',
    },
    glassFill: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: radius.lg - 1,
        borderCurve: 'continuous',
    },
    hint: {
        fontFamily: uiFont(800),
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
});

export default DropZone;
