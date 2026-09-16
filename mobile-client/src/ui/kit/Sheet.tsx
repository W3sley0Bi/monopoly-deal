import { memo, useEffect, useState } from 'react';
import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
function SheetImpl({ open, onClose, title, children, tabs, activeTab, onTabChange }: SheetProps) {
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const reducedMotion = useReducedMotion();
    const [mounted, setMounted] = useState(open);
    const progress = useSharedValue(0);
    const duration = reducedMotion ? 0 : 220;
    const travel = Math.min(height * 0.78, height - 80) + 40;

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

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
    }));
    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(progress.value, [0, 1], [travel, 0]) }],
    }));

    return (
        <RNModal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
                </Animated.View>
                <Animated.View
                    style={[
                        styles.sheet,
                        sheetStyle,
                        { maxHeight: Math.min(height * 0.78, height - 80), paddingBottom: Math.max(12, insets.bottom) },
                    ]}
                >
                    <View style={styles.grabber} />
                    {title ? <Text style={styles.title}>{title}</Text> : null}

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

                    <ScrollView
                        style={styles.body}
                        contentContainerStyle={styles.bodyContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {children}
                    </ScrollView>
                </Animated.View>
            </View>
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
    bodyContent: { paddingBottom: 8, gap: 8 },
});

export const Sheet = memo(SheetImpl);
export default Sheet;
