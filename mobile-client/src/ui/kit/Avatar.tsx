import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { AvatarProps } from '../../../lib/contracts';
import { avatarFor } from '../../game/avatar';
import { brand, radius } from '../../../lib/theme';

function AvatarImpl({ id, name, size, active, dimmed }: AvatarProps) {
    const xml = useMemo(() => avatarFor(id || name || '?'), [id, name]);

    return (
        <View
            accessibilityLabel={name}
            style={[
                styles.wrap,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    opacity: dimmed ? 0.45 : 1,
                },
                // The active ring is the one place the deprecated warm gold
                // survives — it reads as "whose turn" against the lime accent.
                active && {
                    borderWidth: 2,
                    borderColor: brand.legacyGold,
                    shadowColor: brand.legacyGold,
                    shadowOpacity: 0.9,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                },
            ]}
        >
            <SvgXml xml={xml} width={size} height={size} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        overflow: 'hidden',
        backgroundColor: '#0b2b30',
        borderRadius: radius.pill,
    },
});

export const Avatar = memo(AvatarImpl);
export default Avatar;
