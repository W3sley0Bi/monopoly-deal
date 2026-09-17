import { useEffect, useState } from 'react';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import type { Color } from '../../types';
import { useStore } from '../../../lib/store';

/**
 * Turns a two-colour wildcard the way you turn the real card: the whole card
 * rotates half a turn in the plane of the table, and the colour that was at the
 * bottom comes up.
 *
 * Why a half turn and not a flip: the card's two colours are printed on the
 * same face, the second one upside down (see `DualWildcard`). Turning the card
 * round is the physical gesture, and it means the end of the animation and the
 * newly-selected render are the *same picture* — so `shown` can be swapped at
 * the end and the rotation reset to zero without anything visibly jumping.
 *
 * The animation carries the card, not its contents: rotating only the artwork
 * would look like a label spinning inside a card that never moved.
 */
export function WildFlip({ active, children }: {
    /** The colour currently chosen; a change is what turns the card. */
    active: Color | null | undefined;
    /** Rendered with `shown`, which lags `active` by one animation. */
    children: (shown: Color | null | undefined) => React.ReactNode;
}) {
    const reduced = useReducedMotion();
    const motion = useStore(s => s.motion);
    const animate = motion && !reduced;

    const [shown, setShown] = useState(active);
    const spin = useSharedValue(0);

    useEffect(() => {
        if (active === shown) return;
        if (!animate) {
            setShown(active);
            return;
        }
        // `next` is a plain value captured here, never a ref read inside the
        // callback: a worklet that touches a ref freezes that object, and the
        // next write to `.current` warns and is dropped.
        const next = active;
        // Always start the turn from zero. A second tap arriving mid-turn found
        // `spin` already at (or near) 1, so `withTiming(1)` had nothing to do —
        // it completed instantly and the card stopped turning altogether.
        spin.value = 0;
        spin.value = withTiming(1, { duration: 260, easing: Easing.inOut(Easing.cubic) }, (done) => {
            if (done) runOnJS(setShown)(next);
        });
    }, [active, shown, animate, spin]);

    // Once `shown` has caught up, the turned card and the newly rendered one are
    // identical, so the rotation can go back to zero with no transition.
    useEffect(() => {
        spin.value = 0;
    }, [shown, spin]);

    const animated = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${spin.value * 180}deg` },
            // A touch of lift through the turn, so it reads as picked up and
            // put back down rather than pivoted on the spot.
            { scale: 1 + 0.06 * Math.sin(spin.value * Math.PI) },
        ],
    }));

    return <Animated.View style={animated}>{children(shown)}</Animated.View>;
}

export default WildFlip;
