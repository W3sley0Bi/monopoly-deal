import { StyleSheet, Text, View } from 'react-native';
import type { Card, Color } from '../../types';
import { colorMeta } from '../../game/meta';
import { useI18n } from '../../i18n';
import { money } from '../../i18n/format';
import { mix } from '../../../lib/color';
import { uiFont } from '../../../lib/fonts';
import PropertyArtwork from './PropertyArtwork';

export default function DualWildcard({ card, activeColor, width, em }: {
    card: Card; activeColor?: Color | null; width: number; em: number;
}) {
    const { t, tColor } = useI18n();
    const colors = [...(card.colors ?? [])];
    if (activeColor === colors[1]) colors.reverse();
    return <View style={styles.face}>
        {colors.map((color, index) => {
            const meta = colorMeta(color);
            return <View key={color} style={{ height: index === 0 ? '74%' : '26%', backgroundColor: mix(meta.hex, '#f7f2df', 16), transform: [{ rotate: index === 0 ? '0deg' : '180deg' }] }}>
                <View style={[styles.band, { backgroundColor: meta.hex, minHeight: em * 2.2 }]}>
                    <Text numberOfLines={1} style={[styles.label, { flex: 1, color: meta.ink, fontSize: em * 0.76 }]}>{tColor(color)}</Text>
                    {width > 40 ? <Text style={[styles.label, { color: meta.ink, fontSize: em * 0.76 }]}>{money(t, card.value)}</Text> : null}
                </View>
                {index === 0 && width > 40 ? <View style={styles.art}>
                    <PropertyArtwork color={color} size={em * 3.6} />
                    <Text style={[styles.label, { fontSize: em * 0.7, color: '#162f3a', flexShrink: 1 }]}>{t('card.type.wildcard')}</Text>
                </View> : null}
            </View>;
        })}
        <View style={[styles.pivot, { width: em * 2, height: em * 2, marginLeft: -em, marginTop: -em }]}><Text style={{ fontSize: em * 1.3, color: '#162f3a' }}>⇅</Text></View>
    </View>;
}

const styles = StyleSheet.create({
    face: { flex: 1 },
    band: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 4, gap: 3 },
    label: { fontFamily: uiFont(900) },
    art: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 3, gap: 2 },
    pivot: { position: 'absolute', top: '74%', left: '50%', borderRadius: 20, backgroundColor: '#f7f2df', borderWidth: 1, borderColor: '#162f3a33', alignItems: 'center', justifyContent: 'center' },
});
