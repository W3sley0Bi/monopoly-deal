import { useEffect, useRef } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { measure, runOnJS, useAnimatedRef, useSharedValue } from 'react-native-reanimated';

import { useDragShared } from './DragLayer';
import { useDragLayer, type DragState } from './registry';

interface Props {
    state: DragState;
    /** `vertical` for hand cards; `free` for a wildcard on the board. */
    axis?: 'vertical' | 'free';
    enabled?: boolean;
    /** Fires when the handle is released without becoming a drag. */
    onTap?: () => void;
    /** Fires as the card leaves its resting place, before the ghost is shown. */
    onDragStart?: () => void;
    /** Explicit bounds for the native gesture host. */
    style?: StyleProp<ViewStyle>;
    testID?: string;
    /**
     * The card this handle stands for, when the two are not the same box. A
     * hand card is touched through a strip the width of the sliver you can see,
     * while the ghost has to be the whole card: `dx`/`dy` offset the strip to
     * the card's top-left, `w`/`h` are the card's own size.
     */
    ghost?: { dx: number; dy: number; w: number; h: number };
    children: React.ReactNode;
}

/**
 * Wraps a card in the pan that lifts it.
 *
 * A hand card starts only after a deliberate vertical pull. Horizontal drift
 * never hands the gesture to another interaction: the hand is a fixed fan, so
 * a quick diagonal lift must still pick up the card rather than cancel it.
 */
export function Draggable({
    state,
    axis = 'vertical',
    enabled = true,
    onTap,
    onDragStart,
    ghost,
    style,
    testID,
    children,
}: Props) {
    const layer = useDragLayer();
    const shared = useDragShared();
    const ref = useAnimatedRef<View>();
    const fallbackRef = useRef<View>(null);

    // Measured on pickup rather than on layout: the card may be transformed by
    // its hand fan or moved by a scrolling board.
    // The grab offset lives in shared values because the pan's `onUpdate` runs
    // on the UI thread, where a React ref is not readable.
    const grabX = useSharedValue(0);
    const grabY = useSharedValue(0);
    function pickUpFallback(absX: number, absY: number) {
        fallbackRef.current?.measureInWindow((wx, wy, w, h) => {
            const x = wx + (ghost ? ghost.dx : 0);
            const y = wy + (ghost ? ghost.dy : 0);
            grabX.value = absX - x;
            grabY.value = absY - y;
            layer.begin(state, {
                x,
                y,
                w: ghost ? ghost.w : w,
                h: ghost ? ghost.h : h,
            });
        });
    }

    // Gesture-handler owns the card touch on web as well. There is no rail
    // underneath to pan, so yielding the horizontal axis would only recreate
    // the old slide-versus-drag ambiguity.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const node = fallbackRef.current as unknown as HTMLElement | null;
        if (!node?.style) return;
        node.style.touchAction = 'none';
    }, [axis, enabled]);

    const pan = Gesture.Pan()
        .enabled(enabled)
        .activeOffsetY(axis === 'vertical' ? [-6, 6] : [-8, 8])
        .failOffsetX([-10000, 10000])
        .onStart((e) => {
            if (onDragStart) runOnJS(onDragStart)();
            const bounds = measure(ref);
            if (!bounds) {
                runOnJS(pickUpFallback)(e.absoluteX, e.absoluteY);
                return;
            }
            const x = bounds.pageX + (ghost ? ghost.dx : 0);
            const y = bounds.pageY + (ghost ? ghost.dy : 0);
            grabX.value = e.absoluteX - x;
            grabY.value = e.absoluteY - y;
            shared.x.value = x;
            shared.y.value = y;
            runOnJS(layer.begin)(state, {
                x,
                y,
                w: ghost ? ghost.w : bounds.width,
                h: ghost ? ghost.h : bounds.height,
            });
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
        // Reading a card is allowed even when picking it up is not.
        .enabled(!!onTap)
        .onEnd((_e, success) => {
            'worklet';
            if (success && onTap) runOnJS(onTap)();
        });

    // Keep tap and pan in the same native gesture state machine. Nesting a
    // React Native Pressable under the pan leaves two responders competing for
    // the strip; after a successful drag and the ensuing hand re-layout, that
    // can leave the next strip unable to begin a pan. The strips themselves no
    // longer overlap, so native composition now has an unambiguous hit target.
    const gesture = Gesture.Exclusive(pan, tap);

    return (
        <GestureDetector gesture={gesture}>
            <View
                ref={(node) => {
                    ref(node);
                    fallbackRef.current = node;
                }}
                collapsable={false}
                testID={testID}
                style={style}
            >
                {children}
            </View>
        </GestureDetector>
    );
}

export default Draggable;
