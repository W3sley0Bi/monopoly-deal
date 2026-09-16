import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { useDragShared } from './DragLayer';
import { useDragLayer, type DragState } from './registry';

interface Props {
    state: DragState;
    /** `vertical` for hand cards, so a sideways swipe still scrolls the rail;
     *  `free` for a wildcard already on the board. */
    axis?: 'vertical' | 'free';
    enabled?: boolean;
    onTap?: () => void;
    children: React.ReactNode;
}

/**
 * Wraps a card in the pan that lifts it.
 *
 * The axis rule is the whole reason this is not a plain pan: the hand is a
 * horizontally scrolling rail, so a hand card may only start a drag on an
 * upward pull, and a sideways movement has to fail the gesture and hand the
 * touch back to the ScrollView. That is the native expression of the web's
 * `vertical` axis hack.
 */
export function Draggable({ state, axis = 'vertical', enabled = true, onTap, children }: Props) {
    const layer = useDragLayer();
    const shared = useDragShared();
    const ref = useRef<View>(null);

    // Measured on pickup rather than on layout: the rail may have scrolled.
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

    // The axis rule above is a native one, and on the web half of it is taken
    // away before it can apply: gesture-handler writes `touch-action: none`
    // straight onto this node, so a finger that starts on a card can no longer
    // pan the hand rail — the browser has been told this element owns every
    // direction. `pan-x` hands sideways movement back to the scroller and
    // leaves the upward pull, which no scroller wants, to the pan.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const node = ref.current as unknown as HTMLElement | null;
        if (!node?.style) return;
        node.style.touchAction = axis === 'vertical' ? 'pan-x' : 'none';
    }, [axis, enabled]);

    const pan = Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY(axis === 'vertical' ? [-8, 8] : [-8, 8])
        // Only the hand rail needs to win horizontal movement back.
        .failOffsetX(axis === 'vertical' ? [-8, 8] : [-10000, 10000])
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
