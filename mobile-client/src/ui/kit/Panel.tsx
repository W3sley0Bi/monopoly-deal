import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LabelCapsProps, PanelProps } from '../../../lib/contracts';
import { ink, line, radius, surface } from '../../../lib/theme';
import { Text } from 'react-native';
import { ls, uiFont } from '../../../lib/fonts';

function PanelImpl({ children, style, flat }: PanelProps) {
    return (
        <View
            style={[
                styles.panel,
                flat ? styles.flat : styles.raised,
                style,
            ]}
        >
            {children}
        </View>
    );
}

function LabelCapsImpl({ children, size = 10, color, style }: LabelCapsProps) {
    return (
        <Text
            style={[
                {
                    fontFamily: uiFont(800),
                    fontSize: size,
                    letterSpacing: ls(size === 10 ? 0.13 : 0.14, size),
                    textTransform: 'uppercase',
                    color: color ?? ink.muted55,
                },
                style,
            ]}
        >
            {children}
        </Text>
    );
}

const styles = StyleSheet.create({
    panel: {
        backgroundColor: surface.panel,
        borderRadius: radius.panel,
        borderWidth: 1,
        borderColor: line.panel,
    },
    raised: {
        shadowColor: '#000',
        shadowOpacity: 0.55,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 10 },
    },
    flat: {
        shadowColor: '#00090c',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
});

export const Panel = memo(PanelImpl);
export const LabelCaps = memo(LabelCapsImpl);
export default Panel;
