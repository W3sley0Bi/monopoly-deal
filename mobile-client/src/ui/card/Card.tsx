import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { CardProps } from '../../../lib/contracts';
import type { Color } from '../../types';
import { CARD_ASPECT, CARD_SIZES, brand, ink, line, radius, status } from '../../../lib/theme';
import { mix } from '../../../lib/color';
import { ACTION_BLURB_KEY, colorMeta, moneyMeta } from '../../game/meta';
import { displayFont, ls, uiFont } from '../../../lib/fonts';
import { useI18n } from '../../i18n';
import { money } from '../../i18n/format';
import DualWildcard from './DualWildcard';
import PropertyArtwork from './PropertyArtwork';

/** The rainbow "any colour" band. CSS drew it as a conic-gradient, which has no
 *  React Native equivalent, so it is six pie wedges from 210°. */
const RAINBOW = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f87171'];

function wedge(cx: number, cy: number, r: number, from: number, to: number): string {
    const a = (deg: number) => ((deg - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a(from));
    const y1 = cy + r * Math.sin(a(from));
    const x2 = cx + r * Math.cos(a(to));
    const y2 = cy + r * Math.sin(a(to));
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

function RainbowBand({ width, height }: { width: number; height: number }) {
    // The wedges are drawn on a circle large enough to cover the band's corners,
    // then clipped by the parent's overflow.
    const r = Math.max(width, height);
    return (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
            <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {RAINBOW.map((c, i) => (
                    <Path
                        key={i}
                        d={wedge(width / 2, height / 2, r, 210 + i * 60, 210 + (i + 1) * 60)}
                        fill={c}
                    />
                ))}
            </Svg>
        </View>
    );
}

function CardImpl({
    card,
    size,
    activeColor,
    selected,
    dimmed,
    faceDown,
    onPress,
    onLongPress,
    pickTone,
    disabled,
}: CardProps) {
    const { t, tCard, tColor } = useI18n();
    const spec = CARD_SIZES[size];
    const em = useMemo(() => (n: number) => n * spec.em, [spec.em]);

    const colors = card.colors ?? [];
    // Only an any-colour wildcard collapses to its assigned stripe.
    // Two-colour wildcards keep both opposing ends visible.
    const shown: Color[] = colors.length === 1 && colors[0] === 'all' && activeColor ? [activeColor] : colors;
    const primary = activeColor ?? shown[0];
    const cm = colorMeta(primary);
    const cardColor = card.type === 'money' ? moneyMeta(card.value).hex : colors.length ? cm.hex : '#f5b643';

    const isMoney = card.type === 'money';
    const isAction = card.type === 'action';
    const isRent = card.type === 'rent';
    const isProperty = card.type === 'property' || card.type === 'property_wildcard';

    const ringColor = pickTone === 'take' ? status.take : pickTone === 'give' ? status.give : null;

    const body = (
        <View
            style={[
                styles.face,
                {
                    width: spec.w,
                    aspectRatio: CARD_ASPECT,
                    borderRadius: radius.card,
                    borderWidth: spec.w <= 24 ? 1 : spec.w <= 46 ? 2 : 3,
                    opacity: dimmed ? 0.4 : 1,
                },
                selected && { borderColor: brand.brass },
                ringColor && { borderColor: ringColor },
            ]}
        >
            {card.type === 'property_wildcard' && colors.length === 2 ? (
                <DualWildcard card={card} activeColor={activeColor} width={spec.w} em={spec.em} />
            ) : <>
            {/* --- band 1: the colour / money / action header, 26% of the card --- */}
            <View style={[styles.header, { borderBottomColor: line.cardHeaderDivider }]}>
                {isMoney ? (
                    <LinearGradient
                        colors={['#69cba5', '#69cba5']}
                        style={styles.headerFill}
                    >
                        <Text
                            style={[styles.headerLabel, { color: moneyMeta(card.value).ink, fontSize: em(0.85) }]}
                            numberOfLines={1}
                        >
                            {t('card.type.bank')}
                        </Text>
                        <Text style={[styles.headerGlyph, { color: moneyMeta(card.value).ink, fontSize: em(0.85) }]}>
                            $
                        </Text>
                    </LinearGradient>
                ) : isAction ? (
                    <View style={[styles.headerFill, { backgroundColor: '#f7b74e' }]}>
                        <Text style={[styles.headerLabel, { color: '#321c04', fontSize: em(0.85) }]} numberOfLines={1}>
                            {t('card.type.action')}
                        </Text>
                        <Text style={[styles.headerGlyph, { color: '#321c04', fontSize: em(1.1) }]}>✦</Text>
                    </View>
                ) : (
                    <View style={styles.headerSplit}>
                        {shown.map((c, i) => {
                            const m = colorMeta(c);
                            const single = shown.length === 1;
                            return (
                                <View key={`${c}-${i}`} style={[styles.headerCell, { backgroundColor: m.hex }]}>
                                    {c === 'all' ? <RainbowBand width={spec.w} height={spec.h * 0.26} /> : null}
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.headerColorLabel,
                                            {
                                                color: m.ink,
                                                fontSize: em(single ? 0.85 : 0.75),
                                                letterSpacing: ls(0.025, em(single ? 0.85 : 0.75)),
                                            },
                                        ]}
                                    >
                                        {single ? tColor(c) : t(`color.short.${c}`)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>

            {/* --- band 2: the body --- */}
            <View style={[styles.body, { padding: em(0.5), gap: em(0.25) }]}>
                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Defs><RadialGradient id="tint"><Stop offset="0" stopColor={cardColor} stopOpacity={0.16} /><Stop offset="0.75" stopColor={cardColor} stopOpacity={0} /></RadialGradient></Defs>
                    <Rect width="100%" height="100%" fill="url(#tint)" />
                    {isMoney ? <Ellipse cx="50%" cy="50%" rx="37%" ry="37%" fill="none" stroke="#388e6c4d" strokeWidth={2} /> : null}
                </Svg>
                {isProperty && spec.w > 40 ? (
                    <PropertyArtwork color={primary} size={em(4.7)} />
                ) : null}

                {(isAction || isRent) && spec.w > 34 ? (
                    <Text
                        style={{
                            fontSize: em(2.6),
                            lineHeight: em(2.6) * 1.05,
                            color: mix(cardColor, '#162f3a', 70),
                        }}
                    >
                        {isRent ? '↗' : card.action ? ({ pass_go: '➜', deal_breaker: '✦', sly_deal: '♠', forced_deal: '⇄', debt_collector: '$', birthday: '★', house: '⌂', hotel: '▥', just_say_no: '⊘', double_rent: '×2' })[card.action] : '✦'}
                    </Text>
                ) : null}

                {isRent && spec.w > 40 ? <Text style={{ backgroundColor: '#162f3a', color: '#faf5e3', borderRadius: 3, paddingHorizontal: 5, fontSize: em(0.8), fontFamily: uiFont(900) }}>{t('card.type.rent').toUpperCase()}</Text> : null}
                {isMoney ? (
                    <>
                        <Text
                            style={{
                                fontFamily: displayFont(900),
                                fontSize: em(2.8),
                                lineHeight: em(2.8),
                                color: mix(cardColor, '#000000', 78),
                            }}
                        >
                            {card.value}
                        </Text>
                        {spec.w > 40 ? (
                            <Text
                                style={{
                                    fontFamily: uiFont(700),
                                    fontSize: em(0.8),
                                    letterSpacing: ls(0.1, em(0.8)),
                                    textTransform: 'uppercase',
                                    opacity: 0.55,
                                    color: ink.card,
                                }}
                            >
                                {t('card.million')}
                            </Text>
                        ) : null}
                    </>
                ) : spec.w > 34 ? (
                    <Text
                        numberOfLines={3}
                        style={{
                            fontFamily: uiFont(700),
                            fontSize: em(1),
                            lineHeight: em(1.15),
                            textAlign: 'center',
                            color: ink.card,
                        }}
                    >
                        {isRent && colors.length ? colors.map(c => t(`color.short.${c}`)).join(' / ') : tCard(card)}
                    </Text>
                ) : null}
                {isAction && card.action && spec.w >= 72 ? <Text style={{ fontFamily: uiFont(700), fontSize: em(0.85), textAlign: 'center', color: ink.card, opacity: 0.65, fontStyle: 'italic' }}>{t(ACTION_BLURB_KEY[card.action])}</Text> : null}
                {isProperty && size === 'hand' ? <Text style={{ fontSize: em(0.85), color: ink.card, opacity: 0.55 }}>{t(card.type === 'property_wildcard' ? 'card.type.wildcard' : 'card.type.property')}</Text> : null}
            </View>

            {/* --- band 3: the value footer, every non-money card --- */}
            {!isMoney && spec.w > 34 ? (
                <View style={[styles.footer, { borderTopColor: line.cardFooterDivider, paddingHorizontal: em(0.75) }]}>
                    <Text
                        style={{
                            fontFamily: uiFont(700),
                            fontSize: em(0.8),
                            letterSpacing: ls(0.06, em(0.8)),
                            textTransform: 'uppercase',
                            opacity: 0.5,
                            color: ink.card,
                        }}
                    >
                        {t('card.value')}
                    </Text>
                    <Text
                        style={{
                            fontFamily: displayFont(900),
                            fontSize: em(1.15),
                            lineHeight: em(1.15),
                            color: ink.card,
                        }}
                    >
                        {money(t, card.value)}
                    </Text>
                </View>
            ) : null}
            </>}
        </View>
    );

    if (!onPress && !onLongPress) return body;

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={tCard(card)}
        >
            {body}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    face: {
        backgroundColor: '#f7f2df',
        borderColor: '#faf5e3',
        overflow: 'hidden',
        boxShadow: [
            { offsetX: 0, offsetY: 2, blurRadius: 0, color: '#c6c1b5' },
            { offsetX: 0, offsetY: 4, blurRadius: 0, color: '#6e6a5f' },
            { offsetX: 0, offsetY: 8, blurRadius: 8, color: '#000f1573' },
        ],
    },
    header: { height: '26%', borderBottomWidth: 1, overflow: 'hidden' },
    headerFill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
    },
    headerSplit: { flex: 1, flexDirection: 'row' },
    headerCell: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    headerLabel: { fontFamily: uiFont(900), textTransform: 'uppercase' },
    headerGlyph: { fontFamily: uiFont(900) },
    headerColorLabel: { fontFamily: uiFont(900), textTransform: 'uppercase', paddingHorizontal: 2 },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        backgroundColor: '#0000000d',
        paddingVertical: 2,
    },
});

export const Card = memo(CardImpl);
export default Card;
