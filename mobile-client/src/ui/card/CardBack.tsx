import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CardBackProps } from '../../../lib/contracts';
import { displayFont, ls } from '../../../lib/fonts';

/** The red back, for every hand you are not allowed to see. */
function CardBackImpl({ width, height, borderWidth, radius, rotateDeg, style }: CardBackProps) {
    return (
        <View
            style={[
                styles.back,
                {
                    width,
                    height,
                    borderWidth,
                    borderRadius: radius,
                    transform: rotateDeg ? [{ rotate: `${rotateDeg}deg` }] : undefined,
                },
                style,
            ]}
        >
            {width >= 40 ? (
                <View style={styles.mark}>
                    <Text style={[styles.small, { fontSize: width * 0.1 }]}>MONOPOLY</Text>
                    <Text style={[styles.deal, { fontSize: width * 0.4, letterSpacing: ls(-0.07, width * 0.4) }]}>
                        DEAL
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    back: {
        backgroundColor: '#ba1d27',
        borderColor: '#f7f2df',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    // The whole mark is tilted, the way the printed card is.
    mark: { alignItems: 'center', transform: [{ rotate: '-22deg' }] },
    small: { fontFamily: displayFont(900), color: '#f9f5e6', letterSpacing: 0.4 },
    deal: {
        fontFamily: displayFont(900),
        color: '#f9f5e6',
        // Nunito has no true italic and RN will not synthesise one, so the
        // printed card's slant is a skew.
        transform: [{ skewX: '-9deg' }],
    },
});

export const CardBack = memo(CardBackImpl);
export default CardBack;
