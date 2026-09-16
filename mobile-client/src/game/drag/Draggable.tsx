import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { useDragShared } from './DragLayer';
import { useDragLayer, type DragState } from './registry';

interface Props {
    state: DragState;
    /** `vertical` for hand cards; `free` for a wildcard on the board. */
    axis?: 'vertical' | 'free';
    enabled?: boolean;
    onTap?: () => void;
    children: React.ReactNode;
}

/**
 * Wraps a card in the pan that lifts it.
 *
 * A hand card starts only after a deliberate vertical pull. Horizontal drift
 * never hands the gesture to another interaction: the hand is a fixed fan, so
 * a quick diagonal lift must still pick up the card rather than cancel it.
 */
export function Draggable({ state, axis = 'vertical', enabled = true, onTap, children }: Props) {
    const layer = useDragLayer();
    const shared = useDragShared();
    const ref = useRef<View>(null);

    // Measured on pickup rather than on layout: the card may be transformed by
    // its hand fan or moved by a scrolling board.
    // The grab offset lives in shared values because the pan's `onUpdate` runs
    // on the UI thread, where a React ref is not readable.
    const grabX = useSharedValue(0);
    const grabY = useSharedValue(0);
    function pickUp(absX: number, absY: number) {
        ref.current?.measureInWindow((wx, wy, w, h) => {
            grabX.value = absX - wx;
            grabY.value = absY - wy;
            layer.begin(state, { x: wx, y: wy, w, h });
        });
    }

    // Gesture-handler owns the card touch on web as well. There is no rail
    // underneath to pan, so yielding the horizontal axis would only recreate
    // the old slide-versus-drag ambiguity.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const node = ref.current as unknown as HTMLElement | null;
        if (!node?.style) return;
        node.style.touchAction = 'none';
    }, [axis, enabled]);

    const pan = Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY(axis === 'vertical' ? [-8, 8] : [-8, 8])
        .failOffsetX([-10000, 10000])
        .onStart((e) => {
            runOnJS(pickUp)(e.absoluteX, e.absoluteY);
        })
        .onUpdate((e) => {
            'worklet';
            shared.x.value = e.absoluteX - grabX.value;
            shared.y.value = e.absoluteY - grabY.value;

            // Point-in-rect on the UI thread. Every zone is measured, eligible
            // or not, so ineligible ones are skipped here rather than being
            // absent — an ineligible zone must not swallow the drop from a
            // legal one behind it.
            let hit: string | null = null;
            for (const r of shared.rects.value) {
                if (!r.active) continue;
                if (
                    e.absoluteX >= r.x &&
                    e.absoluteX <= r.x + r.w &&
                    e.absoluteY >= r.y &&
                    e.absoluteY <= r.y + r.h
                ) {
                    hit = r.id;
                    break;
                }
            }
            shared.hoveredId.value = hit;
        })
        .onEnd(() => {
            'worklet';
            runOnJS(shared.commit)(shared.hoveredId.value);
        })
        .onFinalize((_e, success) => {
            'worklet';
            if (!success) runOnJS(shared.cancel)();
        });

    const tap = Gesture.Tap()
        .enabled(enabled && !!onTap)
        .onEnd((_e, success) => {
            'worklet';
            if (success && onTap) runOnJS(onTap)();
        });

    // Exclusive, so a tap still selects and the drag never fires alongside it —
    // which is what the web needed its `swallowNextClick` hack for.
    const gesture = Gesture.Exclusive(pan, tap);

    return (
        <GestureDetector gesture={gesture}>
            <View ref={ref} collapsable={false}>
                {children}
            </View>
        </GestureDetector>
    );
}

export default Draggable;
