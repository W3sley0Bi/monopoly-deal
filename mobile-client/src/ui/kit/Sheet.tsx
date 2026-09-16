import { memo, useCallback, useEffect, useState } from 'react';
import { Modal as RNModal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import type { SheetProps } from '../../../lib/contracts';
import { useKeyboardInset } from '../useKeyboardInset';
import { ink, line, radius, surface } from '../../../lib/theme';
import { displayFont, ls, uiFont } from '../../../lib/fonts';

const SHEET_EASING = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * The phone's answer to every desktop popover (DESIGN-TOKENS §6.1) — a bottom
 * sheet capped at 78% of the screen, dismissed by the backdrop or the swipe
 * handle. RN's own `Modal` supplies the presentation and the Android back
 * button. The backdrop fades in place while the sheet keeps the familiar
 * bottom-up movement. Both use GPU properties and finish before unmounting.
 */

function SheetImpl({ open, onClose, title, children, tabs, activeTab, onTabChange, scroll = true }: SheetProps) {
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const reducedMotion = useReducedMotion();
    const [mounted, setMounted] = useState(open);
    /**
     * 1 = fully open, 0 = fully off-screen. The drag writes to this same value
     * rather than adding an offset of its own: two animated styles both setting
     * the backdrop's opacity raced each frame, which is what made the dim layer
     * flash back on as the sheet was flung away.
     */
    const progress = useSharedValue(0);
    const duration = reducedMotion ? 0 : 220;
    const keyboard = useKeyboardInset();
    // `KeyboardAvoidingView` solves this for a normal screen, but a sheet is a
    // separate modal window whose own height is the thing that has to change —
    // padding it from below only pushes it off the top of the screen. So the
    // sheet rides above the keyboard and gives up whatever height that costs:
    // a composer you cannot see is the one part of a chat that has to work.
    //
    // webInsetNote: on the web `height` has already lost the keyboard, because
    // react-native-web measures `Dimensions` from the visual viewport and the
    // page is resized to match (see `lockViewport`). Subtracting it again here
    // collapsed the sheet to a sliver. The padding below still applies on both:
    // RN's `Modal` is fixed to the *window*, so the sheet is laid out in a box
    // that never shrank, and it is the padding that lifts it clear.
    const room = Math.min(height * 0.78, height - 80 - (Platform.OS === 'web' ? 0 : keyboard));
    const travel = room + 40;

    useEffect(() => {
        if (open) setMounted(true);
    }, [open]);

    useEffect(() => {
        if (!mounted) return;
        if (open) {
            progress.value = withTiming(1, { duration, easing: SHEET_EASING });
            return;
        }
        progress.value = withTiming(0, { duration, easing: SHEET_EASING }, (finished) => {
            if (finished) runOnJS(setMounted)(false);
        });
    }, [duration, mounted, open, progress]);

    const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(progress.value, [0, 1], [travel, 0]) }],
    }));

    const close = useCallback(() => onClose(), [onClose]);

    // Only the head takes the pan: the body is a ScrollView, and a sheet that
    // dismisses when you flick its content is a sheet you cannot read.
    const pan = Gesture.Pan()
        .onUpdate((e) => {
            // Downwards only — pulling up must not stretch the sheet past open.
            progress.value = Math.min(1, Math.max(0, 1 - Math.max(0, e.translationY) / travel));
        })
        .onEnd((e) => {
            if (e.velocityY > 700 || progress.value < 0.78) {
                // Runs to 0 first, so the backdrop is already gone by the time
                // the parent unmounts us.
                progress.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.quad) }, (done) => {
                    if (done) runOnJS(close)();
                });
                return;
            }
            progress.value = withTiming(1, { duration: 200, easing: SHEET_EASING });
        });

    return (
        <RNModal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
            {/* Gestures inside an RN Modal need their own root: the app's
                GestureHandlerRootView does not reach into the modal window. */}
            <GestureHandlerRootView style={styles.root}>
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.sheet,
                        sheetStyle,
                        {
                            maxHeight: room,
                            // Padding on native, a margin on the web. Padding
                            // only shrinks the content box while the sheet stays
                            // stuck to the bottom of the window, so a panel with
                            // a minimum height of its own — the chat is 300 —
                            // simply overflowed it and sat back under the
                            // keyboard. Moving the whole box up instead leaves
                            // every one of those points usable.
                            marginBottom: Platform.OS === 'web' ? keyboard : 0,
                            paddingBottom:
                                Math.max(12, insets.bottom) + (Platform.OS === 'web' ? 0 : keyboard),
                        },
                    ]}
                >
                    <GestureDetector gesture={pan}>
                        <View style={styles.head} accessible accessibilityRole="adjustable"
                            accessibilityLabel="Drag down to close">
                            <View style={styles.grabber} />
                            {title ? <Text style={styles.title}>{title}</Text> : null}
                        </View>
                    </GestureDetector>

                    {tabs?.length ? (
                        <View style={styles.tabs}>
                            {tabs.map((t) => {
                                const on = t.key === activeTab;
                                return (
                                    <Pressable
                                        key={t.key}
                                        onPress={() => onTabChange?.(t.key)}
                                        style={[styles.tab, on && styles.tabOn]}
                                        accessibilityRole="tab"
                                        accessibilityState={{ selected: on }}
                                    >
                                        <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{t.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    ) : null}

                    {scroll ? (
                        <ScrollView
                            style={styles.body}
                            contentContainerStyle={styles.bodyContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {children}
                        </ScrollView>
                    ) : (
                        <View style={styles.bodyOwn}>{children}</View>
                    )}

                </Animated.View>
            </GestureHandlerRootView>
        </RNModal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#00060899' },
    sheet: {
        backgroundColor: surface.sheet,
        borderTopLeftRadius: radius.modal,
        borderTopRightRadius: radius.modal,
        borderTopWidth: 1,
        borderColor: line.sheet,
        paddingHorizontal: 14,
        paddingTop: 8,
    },
    // A generous grab area: the 4pt pill alone is not a touch target.
    head: { paddingTop: 2, paddingBottom: 2 },
    grabber: {
        alignSelf: 'center',
        width: 38,
        height: 4,
        borderRadius: radius.pill,
        backgroundColor: '#ffffff2e',
        marginBottom: 10,
    },
    title: {
        fontFamily: displayFont(800),
        fontSize: 17,
        color: ink.headerTitle,
        letterSpacing: ls(0.02, 17),
        marginBottom: 10,
    },
    tabs: { flexDirection: 'row', gap: 6, marginBottom: 10 },
    tab: {
        flex: 1,
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: '#ffffff0f',
    },
    tabOn: { backgroundColor: '#ffffff1f' },
    tabLabel: { fontFamily: uiFont(700), fontSize: 13, color: ink.muted60 },
    tabLabelOn: { color: ink.body },
    body: { flexGrow: 0 },
    // The child scrolls itself and wants every point the sheet can give it.
    bodyOwn: { flexShrink: 1, flexGrow: 1 },
    bodyContent: { paddingBottom: 8, gap: 8 },
});

export const Sheet = memo(SheetImpl);
export default Sheet;
