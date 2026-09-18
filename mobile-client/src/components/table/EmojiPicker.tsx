import { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { REACTIONS, type Reaction } from '../../game/reactions';
import { Icon } from '../../ui/kit';
import { ink, surface } from '../../../lib/theme';

interface EmojiPickerProps {
    onSend: (emoji: Reaction) => void;
    disabled?: boolean;
    roomy?: boolean;
}

export function EmojiPicker({ onSend, disabled, roomy }: EmojiPickerProps) {
    const [open, setOpen] = useState(false);
    const progress = useSharedValue(0);

    const toggle = useCallback(() => {
        if (disabled) return;
        const next = !open;
        setOpen(next);
        progress.value = withTiming(next ? 1 : 0, { duration: 150, easing: Easing.out(Easing.quad) });
    }, [open, disabled, progress]);

    const handleSend = useCallback((emoji: Reaction) => {
        onSend(emoji);
        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setOpen(false);
        progress.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) });
    }, [onSend, progress]);

    const BUTTON_SIZE = roomy ? 42 : 38;
    const GAP = 6;
    const PADDING = 2; // Extra padding inside the pill on the left
    
    // Total width when expanded: toggle button + 4 emojis + gaps between emojis + gap between emojis and toggle
    const EXPANDED_WIDTH = BUTTON_SIZE + 4 * BUTTON_SIZE + 4 * GAP + PADDING;

    const containerStyle = useAnimatedStyle(() => {
        return {
            width: BUTTON_SIZE + (progress.value * (EXPANDED_WIDTH - BUTTON_SIZE)),
            backgroundColor: progress.value > 0 ? surface.panelOverlay : 'transparent',
            borderRadius: BUTTON_SIZE / 2,
        };
    });

    const toggleBtnStyle = useAnimatedStyle(() => {
        return {
            backgroundColor: progress.value > 0 ? 'transparent' : '#d8fff012',
            borderWidth: 1,
            borderColor: progress.value > 0 ? 'transparent' : '#d8fff01f',
        };
    });

    const tooltipProps = (text: string) => Platform.OS === 'web' ? { title: text } as any : {};

    return (
        <View style={[styles.positioner, { width: BUTTON_SIZE, height: BUTTON_SIZE }]}>
            <Animated.View style={[styles.pill, containerStyle, { height: BUTTON_SIZE }]}>
                <View style={styles.emojisContainer} pointerEvents={open ? 'auto' : 'none'}>
                    {REACTIONS.map((emoji) => (
                        <Pressable
                            key={emoji}
                            onPress={() => handleSend(emoji)}
                            style={({ pressed }) => [
                                styles.btn,
                                roomy && styles.btnRoomy,
                                pressed && styles.btnPressed,
                            ]}
                        >
                            <Text style={styles.emojiText}>{emoji}</Text>
                        </Pressable>
                    ))}
                </View>

                <Animated.View style={[styles.btn, roomy && styles.btnRoomy, toggleBtnStyle]}>
                    <Pressable
                        disabled={disabled}
                        onPress={toggle}
                        accessibilityRole="button"
                        accessibilityLabel="Reactions"
                        style={({ pressed, hovered }: any) => [
                            styles.btn,
                            roomy && styles.btnRoomy,
                            disabled && styles.disabled,
                            (pressed || (Platform.OS === 'web' && hovered)) && !open && styles.btnPressed,
                            styles.toggleInner,
                        ]}
                    >
                        <View {...tooltipProps(open ? "Close" : "Reactions")}>
                            <Icon name={open ? "xmark" : "face.smiling"} fallback={open ? "✕" : "😀"} size={roomy ? 20 : 18} color={ink.muted60} />
                        </View>
                    </Pressable>
                </Animated.View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    positioner: {
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        position: 'absolute',
        right: 0,
    },
    emojisContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingRight: 6,
    },
    btn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleInner: {
        borderWidth: 0,
        backgroundColor: 'transparent',
    },
    btnRoomy: {
        width: 42,
        height: 42,
        borderRadius: 21,
    },
    btnPressed: {
        backgroundColor: '#d8fff026',
    },
    disabled: {
        opacity: 0.34,
    },
    emojiText: {
        fontSize: 20,
        lineHeight: Platform.OS === 'ios' ? 22 : 24,
    },
});
