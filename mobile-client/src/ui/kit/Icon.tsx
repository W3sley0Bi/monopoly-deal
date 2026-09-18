import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { ink } from '../../../lib/theme';

type SFName = Exclude<SymbolViewProps['name'], object>;
// `expo-symbols` does not export the Material name union on its own, and its
// package exports block the deep path it lives at. Read it off the prop.
type AndroidSymbol = NonNullable<Extract<SymbolViewProps['name'], object>['android']>;

/**
 * What each symbol is called in Material Symbols, which is the face
 * `expo-symbols` draws from everywhere that is not iOS — it bundles the font,
 * so this costs nothing but the name.
 *
 * Only pairs that mean the same thing belong here. An icon with no honest
 * counterpart is better left to its text fallback than given a near-miss: a
 * wrong icon is read as a different action, whereas a character is read as a
 * character.
 */
const MATERIAL: Partial<Record<SFName, AndroidSymbol>> = {
    'gearshape.fill': 'settings',
    'list.bullet.rectangle': 'list_alt',
    'bubble.left.and.bubble.right.fill': 'forum',
    banknote: 'payments',
    sparkles: 'auto_awesome',
    'chevron.down': 'keyboard_arrow_down',
    'chevron.up': 'keyboard_arrow_up',
    'chevron.right': 'keyboard_arrow_right',
    checkmark: 'check',
    'doc.on.doc': 'content_copy',
    'square.and.arrow.up': 'ios_share',
    'arrow.up': 'arrow_upward',
    'house.fill': 'home',
    'building.2.fill': 'apartment',
    'hand.draw.fill': 'swipe',
    'hand.tap.fill': 'touch_app',
    'checkmark.circle.fill': 'check_circle',
    'arrow.right.circle.fill': 'arrow_circle_right',
    'wifi.slash': 'wifi_off',
};

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
    // Naming both faces is what makes a real icon appear off iOS. Given a bare
    // string `expo-symbols` has nothing to draw anywhere else and goes straight
    // to the fallback character, which is why the web was a row of ≡ and ✦.
    const material = typeof name === 'string' ? MATERIAL[name] : undefined;
    const resolved: SymbolViewProps['name'] =
        typeof name === 'string' && material
            ? { ios: name, android: material, web: material }
            : name;

    return (
        <SymbolView
            name={resolved}
            size={size}
            weight="semibold"
            tintColor={color}
            fallback={
                // Off SF Symbols, expo-symbols renders `fallback` bare and
                // drops `style`, so the glyph had no box: it was centred on its
                // own advance width, which differs per character, and every
                // icon sat a little off inside its circle. The box is what the
                // symbol would have occupied.
                <View style={[styles.fallbackBox, { width: size, height: size }]}>
                    <Text style={[styles.fallback, { fontSize: size * 0.82, lineHeight: size, color }]}>
                        {fallback}
                    </Text>
                </View>
            }
            style={[{ width: size, height: size }, style]}
        />
    );
}

const styles = StyleSheet.create({
    fallbackBox: { alignItems: 'center', justifyContent: 'center' },
    fallback: { textAlign: 'center', includeFontPadding: false },
});

export const Icon = memo(IconImpl);
export default Icon;
