import { memo } from 'react';
import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SheetProps } from '../../../lib/contracts';
import { ink, line, radius, surface } from '../../../lib/theme';
import { displayFont, ls, uiFont } from '../../../lib/fonts';

/**
 * The phone's answer to every desktop popover (DESIGN-TOKENS §6.1) — a bottom
 * sheet capped at 78% of the screen, dismissed by the backdrop or the swipe
 * handle. RN's own `Modal` supplies the presentation and the Android back
 * button; the entrance is its `slide` animation rather than a hand-rolled one,
 * because a native sheet that lags its own gesture reads as broken.
 */
function SheetImpl({ open, onClose, title, children, tabs, activeTab, onTabChange }: SheetProps) {
    const { height } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    return (
        <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.root}>
                <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
                <View
                    style={[
                        styles.sheet,
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
                </View>
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
