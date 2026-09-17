import { memo } from 'react';
import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { ModalProps } from '../../../lib/contracts';
import { ink, line, radius, surface } from '../../../lib/theme';
import { displayFont, ls, uiFont } from '../../../lib/fonts';

/**
 * A centred dialog. `accessibilityViewIsModal` does the focus containment the
 * web had to hand-roll, so there is no trap here.
 *
 * `onClose` is deliberately optional: a pending panel must be answered through
 * its own buttons and has no dismiss affordance at all.
 */
function ModalImpl({ open, onClose, wide, corner, title, children }: ModalProps) {
    const { width, height } = useWindowDimensions();

    return (
        <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose ?? (() => {})}>
            <View style={styles.root} accessibilityViewIsModal>
                <Pressable
                    style={styles.backdrop}
                    onPress={onClose}
                    // Without an onClose there is nothing to activate, so keep it
                    // out of the accessibility tree rather than offering a no-op.
                    accessibilityElementsHidden={!onClose}
                    pointerEvents={onClose ? 'auto' : 'none'}
                />
                <View
                    style={[
                        styles.card,
                        {
                            width: Math.min(width - 24, wide ? 520 : 380),
                            maxHeight: height * 0.86,
                        },
                    ]}
                >
                    {corner ? <View style={styles.corner}>{corner}</View> : null}

                    {title ? <Text style={styles.title}>{title}</Text> : null}

                    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                        {children}
                    </ScrollView>

                    {onClose ? (
                        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button">
                            <Text style={styles.closeLabel}>✕</Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </RNModal>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#000608b3' },
    card: {
        backgroundColor: surface.sheet,
        borderRadius: radius.modal,
        borderWidth: 1,
        borderColor: line.sheet,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.6,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 20 },
    },
    corner: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
    title: {
        fontFamily: displayFont(800),
        fontSize: 19,
        color: ink.headerTitle,
        letterSpacing: ls(0.02, 19),
        marginBottom: 10,
        paddingRight: 28,
    },
    body: { gap: 10, paddingBottom: 4 },
    close: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeLabel: { color: ink.muted60, fontFamily: uiFont(700), fontSize: 16 },
});

export const Modal = memo(ModalImpl);
export default Modal;
