import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

/** Long enough to read a two-line entry twice; short enough that the felt comes back between plays. */
const SHOW_MS = 5000;
const FADE_MS = 450;

/**
 * The last thing that happened, on a phone. It sits just above your own board,
 * where the eye already is, and it is only borrowing the felt behind it — the
 * near seat — so it steps aside once it has been read. A new entry brings it
 * back; the log sheet keeps the full history.
 *
 * `eventKey` must change with every new entry, not only with new text: two
 * identical plays in a row are two things to announce.
 */
export function TableEvent({ text, eventKey, style }: { text: string; eventKey: string; style: StyleProp<TextStyle> }) {
    const reduced = useReducedMotion();
    const opacity = useSharedValue(1);

    useEffect(() => {
        opacity.value = withSequence(
            withTiming(1, { duration: reduced ? 0 : 160 }),
            withDelay(SHOW_MS, withTiming(0, { duration: reduced ? 0 : FADE_MS, easing: Easing.out(Easing.quad) })),
        );
    }, [eventKey, opacity, reduced]);

    const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        // Never interactive: it covers the near seat, whose cards stay tappable.
        <Animated.Text pointerEvents="none" style={[style, styles.anchor, fade]} numberOfLines={2} accessibilityLiveRegion="polite">
            {text}
        </Animated.Text>
    );
}

const styles = StyleSheet.create({
    anchor: { position: 'absolute', left: 12, right: 12, bottom: 4 },
});
