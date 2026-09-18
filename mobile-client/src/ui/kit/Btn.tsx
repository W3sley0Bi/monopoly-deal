import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { BtnProps } from '../../../lib/contracts';
import { brand, ink, radius, status } from '../../../lib/theme';
import { ls, uiFont } from '../../../lib/fonts';

/**
 * `.btn` and its variants (DESIGN-TOKENS Appendix).
 *
 * The web button carries a hard 3px bottom shadow that the press state eats by
 * moving the button down 1px — that trade is what makes it feel physical, so
 * the offset is animated here rather than dropped.
 */
const VARIANT = {
    gold: { bg: brand.brass, fg: status.goldInk, edge: status.goldShadow },
    green: { bg: brand.brass, fg: status.goldInk, edge: status.goldShadow },
    red: { bg: status.danger, fg: '#fff', edge: status.dangerShadow },
    blue: { bg: status.blue, fg: '#fff', edge: '#00456b' },
    ghost: { bg: '#ffffff12', fg: '#e8efeb', edge: 'transparent' },
} as const;

function BtnImpl({ label, onPress, variant = 'ghost', disabled, pending, icon, style, textStyle }: BtnProps) {
    const v = VARIANT[variant];
    const off = disabled || pending;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!off, busy: !!pending }}
            disabled={off}
            onPress={onPress}
            style={({ pressed }) => [
                styles.base,
                {
                    backgroundColor: v.bg,
                    // The edge shrinks as the button sinks, so the whole control
                    // keeps its height and nothing below it shifts.
                    borderBottomWidth: pressed ? 1 : 3,
                    borderBottomColor: v.edge,
                    marginTop: pressed ? 2 : 0,
                    opacity: off ? 0.42 : 1,
                },
                style,
            ]}
        >
            {pending ? <ActivityIndicator size="small" color={v.fg} /> : icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text style={[styles.label, { color: v.fg }, textStyle]} numberOfLines={1}>
                {label}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        minHeight: 40,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: '#00000059',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    label: {
        fontFamily: uiFont(700),
        fontSize: 13,
        letterSpacing: ls(0.01, 13),
    },
    icon: { marginRight: 2 },
});

export const Btn = memo(BtnImpl);
export default Btn;
