import { memo } from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { ink } from '../../../lib/theme';

/**
 * One icon, from SF Symbols.
 *
 * Emoji were doing this job, and emoji are a typeface the app does not control:
 * they change with the OS, carry their own colour, and sit off the text
 * baseline. `fallback` is what a platform without SF Symbols renders instead,
 * so every call site has to name one.
 */
function IconImpl({ name, fallback, size = 18, color = ink.body, style }: {
    name: SymbolViewProps['name'];
    fallback: string;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <SymbolView
            name={name}
            size={size}
            weight="semibold"
            tintColor={color}
            fallback={<Text style={[styles.fallback, { fontSize: size, lineHeight: size + 2, color }]}>{fallback}</Text>}
            style={[{ width: size, height: size }, style]}
        />
    );
}

const styles = StyleSheet.create({
    fallback: { textAlign: 'center' },
});

export const Icon = memo(IconImpl);
export default Icon;
