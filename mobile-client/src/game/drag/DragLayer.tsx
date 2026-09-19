import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    Easing,
    type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Card } from '../../ui/card';
import { useTableWindow } from '../../web/tableScale';
import { DragContext, type DragApi, type DragState, type ZoneEntry, type ZoneRect } from './registry';

const SNAP_BACK_MS = 260;

/**
 * The drag engine.
 *
 * The web version hit-tested `document.elementFromPoint` every frame; there is
 * no such thing here, so drop zones register their measured window rects and
 * the pan gesture hit-tests point-in-rect against them on the UI thread. Rects
 * are re-measured when a drag begins rather than cached at layout, because the
 * seat rail and the board both scroll underneath.
 *
 * The carried card is a real `<Card>` in an overlay at this component's root,
 * driven by shared values — nothing is cloned.
 */
export function DragLayer({ children }: { children: React.ReactNode }) {
    // Positions stay in window points — that is what the pan and every zone's
    // `measureInWindow` report. Only the ghost converts, because it is drawn
    // inside the table, which may be scaled (see `TableScaleFrame`).
    const { scale } = useTableWindow();
    const zones = useRef(new Map<string, ZoneEntry>());
    const rects = useSharedValue<ZoneRect[]>([]);
    const hoveredId = useSharedValue<string | null>(null);

    const [drag, setDrag] = useState<DragState | null>(null);
    const dragRef = useRef<DragState | null>(null);

    // Where the card sits right now, and where it came from (for the snap back).
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const originX = useSharedValue(0);
    const originY = useSharedValue(0);
    const width = useSharedValue(0);
    const height = useSharedValue(0);
    const opacity = useSharedValue(0);

    const register = useCallback((entry: ZoneEntry) => {
        zones.current.set(entry.id, entry);
        return () => {
            zones.current.delete(entry.id);
        };
    }, []);

    /**
     * Re-reads every zone's rect — including the ineligible ones, whose
     * eligibility may flip while a card is in the air.
     *
     * This must never be filtered by `active` at call time: eligibility is
     * derived from the carried card, so at the instant a drag begins every zone
     * is still inactive. Filtering here is what makes drops silently impossible.
     */
    const refresh = useCallback(() => {
        const entries = [...zones.current.values()];
        void Promise.all(entries.map((z) => z.measure())).then((measured) => {
            rects.value = measured.filter((r): r is ZoneRect => r !== null);
        });
    }, [rects]);

    const begin = useCallback(
        (state: DragState, origin: { x: number; y: number; w: number; h: number }) => {
            dragRef.current = state;
            setDrag(state);
            originX.value = origin.x;
            originY.value = origin.y;
            width.value = origin.w;
            height.value = origin.h;
            x.value = origin.x;
            y.value = origin.y;
            opacity.value = 1;
            hoveredId.value = null;
            void Haptics.selectionAsync();
        },
        [originX, originY, width, height, x, y, opacity, hoveredId],
    );

    // Measured only after the drag has rendered: eligibility drives `flexGrow`,
    // so the zones physically resize, and a rect taken before that is wrong.
    useEffect(() => {
        if (drag) refresh();
    }, [drag, refresh]);

    const clear = useCallback(() => {
        dragRef.current = null;
        setDrag(null);
        hoveredId.value = null;
    }, [hoveredId]);

    /** Refusal is an explicit gesture — the card goes home rather than
     *  vanishing, so a rejected drop never reads as a dropped frame. */
    const cancel = useCallback(() => {
        x.value = withTiming(originX.value, { duration: SNAP_BACK_MS, easing: Easing.out(Easing.cubic) });
        y.value = withTiming(originY.value, { duration: SNAP_BACK_MS, easing: Easing.out(Easing.cubic) });
        opacity.value = withTiming(0, { duration: SNAP_BACK_MS }, (done) => {
            if (done) runOnJS(clear)();
        });
    }, [x, y, originX, originY, opacity, clear]);

    const commit = useCallback(
        (zoneId: string | null) => {
            const state = dragRef.current;
            if (!state) return;
            const zone = zoneId ? zones.current.get(zoneId) : null;
            if (zone?.active) {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                opacity.value = 0;
                clear();
                zone.onDrop(state.card);
                return;
            }
            cancel();
        },
        [cancel, clear, opacity],
    );

    // A tick as the card crosses into a live zone — the phone's replacement for
    // the web's hover highlight, which a finger covering the card cannot see.
    useAnimatedReaction(
        () => hoveredId.value,
        (now, before) => {
            if (now && now !== before) runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        },
    );

    const ghostStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: x.value / scale,
        top: y.value / scale,
        width: width.value / scale,
        opacity: opacity.value,
        transform: [{ rotate: '3deg' }, { scale: 1.05 }],
    }));

    const api = useMemo<DragApi>(
        () => ({ register, refresh, begin, cancel, dragging: drag, hoveredId }),
        [register, refresh, begin, cancel, drag, hoveredId],
    );

    // Handed to <Draggable> so its pan worklet can move the ghost and hit-test
    // without going through React.
    const shared = useMemo(
        () => ({ x, y, rects, hoveredId, commit, cancel }),
        [x, y, rects, hoveredId, commit, cancel],
    );

    return (
        <DragContext.Provider value={api}>
            <DragSharedContext.Provider value={shared}>
                {/* The wrapper has to start at the window origin and carry no
                    padding of its own — the ghost is positioned in the window
                    coordinates `measureInWindow` reports. */}
                <View style={styles.root}>
                    {children}
                    {drag ? (
                        <Animated.View pointerEvents="none" style={[styles.ghost, ghostStyle]}>
                            <Card card={drag.card} size="hand" activeColor={drag.fromColor ?? null} />
                        </Animated.View>
                    ) : null}
                </View>
            </DragSharedContext.Provider>
        </DragContext.Provider>
    );
}

// ---------------------------------------------------------------------------

interface DragShared {
    x: SharedValue<number>;
    y: SharedValue<number>;
    rects: SharedValue<ZoneRect[]>;
    hoveredId: SharedValue<string | null>;
    commit: (zoneId: string | null) => void;
    cancel: () => void;
}

export const DragSharedContext = createContext<DragShared | null>(null);

export function useDragShared(): DragShared {
    const v = useContext(DragSharedContext);
    if (!v) throw new Error('useDragShared must be used inside <DragLayer>');
    return v;
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    ghost: { zIndex: 200, elevation: 20 },
});

export default DragLayer;
