import { memo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ink, status, surface } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';

/**
 * A labelled setting row with the platform switch.
 *
 * The switch itself is the OS one — it carries the platform's own feel, its
 * accessibility and its haptics — tinted to the table's green rather than the
 * system blue, which belongs to no app in particular.
 *
 * The whole row is the target: a 51pt switch is a poor thing to aim at on a
 * phone, and the label says the same thing.
 */
function ToggleImpl({ label, hint, value, onChange }: {
    label: string;
    hint?: string;
    value: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            accessibilityLabel={label}
            accessibilityHint={hint}
            onPress={() => onChange(!value)}
        >
            <View style={styles.text}>
                <Text style={styles.label}>{label}</Text>
                {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
            <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: '#ffffff1f', true: status.success }}
                thumbColor="#ffffff"
                ios_backgroundColor="#ffffff1f"
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    row: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: surface.panelOverlay,
    },
    pressed: { backgroundColor: '#ffffff12' },
    text: { flex: 1, gap: 2 },
    label: { fontFamily: uiFont(800), fontSize: 13, color: ink.body },
    hint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
});

export const Toggle = memo(ToggleImpl);
export default Toggle;
