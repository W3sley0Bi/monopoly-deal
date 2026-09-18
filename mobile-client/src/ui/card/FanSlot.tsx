import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, withSpring, withTiming } from 'react-native-reanimated';

import {
    FAN_HEADROOM,
    FAN_NUDGE,
    HAND_CARD_HEIGHT,
    HAND_CARD_WIDTH,
    fanNudge,
    fanTilt,
} from '../../game/handFan';

const POP_SCALE = 1.09;

interface Props {
    index: number;
    count: number;
    /** Left edge of this card's box inside the row, before any nudge. */
    left: number;
    /** Index of the popped card in this row, or null when none is. */
    popped: number | null;
    /** Roomy screens scale the fan geometry and its painted card together. */
    scale?: number;
    children: ReactNode;
}

/**
 * One card's place in the fan.
 *
 * The fan overlaps, so most of a card sits behind its right-hand neighbour and
 * cannot be read. Popping the touched card out — above every other card, lifted
 * and enlarged, its neighbours leaning away — is what makes a crowded hand
 * legible without spending the vertical space a second row would cost.
 *
 * It paints and nothing else: the touch that pops it belongs to a strip in the
 * layer above, so nothing here needs to be reachable.
 */
export function FanSlot({ index, count, left, popped, scale = 1, children }: Props) {
    const reduced = useReducedMotion();
    const isPopped = popped === index;
    const nudge = fanNudge(index, popped) * scale;
    const tilt = fanTilt(index, count);

    const animated = useAnimatedStyle(() => {
        const to = (value: number) =>
            reduced
                ? withTiming(value, { duration: 0 })
                : withSpring(value, { damping: 17, stiffness: 240, mass: 0.6 });
        return {
            transform: [
                { translateX: to(nudge) },
                { translateY: to((tilt.lift + (isPopped ? -FAN_HEADROOM : 0)) * scale) },
                // Inside the animated array, not beside it: a second `transform`
                // on the same view replaces this one rather than adding to it.
                { rotate: `${tilt.rotate}deg` },
                { scale: to(isPopped ? POP_SCALE : 1) },
            ],
        };
    }, [isPopped, nudge, tilt.lift, tilt.rotate, reduced]);

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: left + FAN_NUDGE * scale,
                    top: FAN_HEADROOM * scale,
                    width: HAND_CARD_WIDTH * scale,
                    height: HAND_CARD_HEIGHT * scale,
                },
                animated,
            ]}
        >
            <Animated.View
                style={scale === 1 ? undefined : { transform: [{ scale }], transformOrigin: 'top left' }}
            >
                {children}
            </Animated.View>
        </Animated.View>
    );
}

export default FanSlot;
