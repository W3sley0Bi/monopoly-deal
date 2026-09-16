import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { PropertySetsProps } from '../../../lib/contracts';
import type { CardSizeKey } from '../../../lib/theme';
import { brand, ink, radius } from '../../../lib/theme';
import { colorMeta } from '../../game/meta';
import { Card } from '../../ui/card';
import { Icon } from '../../ui/kit';
import { money } from '../../i18n/format';
import { useI18n } from '../../i18n';
import { uiFont } from '../../../lib/fonts';

const SIZE_FOR: Record<string, CardSizeKey> = {
    normal: 'propertyZone',
    dense: 'dense',
    tight: 'tight',
};

/**
 * A player's property sets, one overlapping stack per colour.
 *
 * Cards overlap hard because the colour stripe is the only part that has to
 * stay readable — you are counting colours towards a set, not reading names.
 */
function PropertySetsImpl({
    sets,
    size,
    onCardPress,
    enabledIds,
    selectedIds,
    pickTone,
    density = 'normal',
    liveColor,
}: PropertySetsProps) {
    const { t, tColor } = useI18n();
    const cardSize = density === 'normal' ? size : SIZE_FOR[density];

    if (!sets.length) {
        return <Text style={styles.empty}>{t('sets.empty')}</Text>;
    }

    return (
        <View style={styles.wrap}>
            {sets.map((set) => {
                const cm = colorMeta(set.color);
                const live = liveColor === set.color;
                return (
                    <View
                        key={set.color}
                        style={[
                            styles.stack,
                            size === 'activeBoard' && { backgroundColor: `${cm.hex}18`, borderColor: '#b9eee326', padding: 6 },
                            set.complete && styles.complete,
                            live && styles.live,
                        ]}
                    >
                        <View style={styles.stackHead}>
                            <View style={[styles.swatch, { backgroundColor: cm.hex }]} />
                            {size === 'activeBoard' ? <Text style={styles.colorName}>{tColor(set.color).toUpperCase()}</Text> : null}
                            <Text style={styles.count}>
                                {set.cards.length}/{set.size}
                            </Text>
                            {size === 'activeBoard' ? <Text style={styles.rent}>{money(t, set.rent)}</Text> : null}
                        </View>

                        <View style={styles.cards}>
                            {set.cards.map((card, i) => {
                                const pickable = !enabledIds || enabledIds.has(card.id);
                                return (
                                    <View key={card.id} style={i > 0 ? styles.overlap : undefined}>
                                        <Card
                                            card={card}
                                            size={cardSize}
                                            activeColor={set.color}
                                            selected={selectedIds?.has(card.id)}
                                            pickTone={selectedIds?.has(card.id) ? pickTone : null}
                                            dimmed={!!enabledIds && !pickable}
                                            disabled={!pickable}
                                            onPress={
                                                onCardPress && pickable ? () => onCardPress(card, set) : undefined
                                            }
                                        />
                                    </View>
                                );
                            })}
                        </View>

                        {set.buildings.length ? (
                            <View style={styles.buildings}>
                                {set.buildings.map((b) => (
                                    <Icon
                                        key={b.id}
                                        name={b.action === 'hotel' ? 'building.2.fill' : 'house.fill'}
                                        fallback={b.action === 'hotel' ? '▥' : '⌂'}
                                        size={12}
                                        color={brand.brass}
                                    />
                                ))}
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    colorName: { fontFamily: uiFont(900), fontSize: 9, color: ink.body },
    rent: { fontFamily: uiFont(800), fontSize: 10, color: '#74e8bd' },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    stack: {
        padding: 4,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    complete: { borderColor: brand.brass },
    live: { borderColor: brand.brass, backgroundColor: brand.brassGlow12 },
    stackHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
    swatch: { width: 10, height: 6, borderRadius: radius.xs },
    count: { fontFamily: uiFont(800), fontSize: 9, color: ink.muted60 },
    cards: { flexDirection: 'row' },
    // Only the stripe needs to stay visible, so the overlap is aggressive.
    overlap: { marginLeft: -28 },
    buildings: { flexDirection: 'row', gap: 2, marginTop: 3 },
    empty: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
});

export const PropertySets = memo(PropertySetsImpl);
export default PropertySets;
