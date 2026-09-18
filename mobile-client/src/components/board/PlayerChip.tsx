import { memo, useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import Animated, { ZoomIn, FadeOut, Easing } from 'react-native-reanimated';

import type { PlayerChipProps } from '../../../lib/contracts';
import { brand, ink, line, radius, status, surface } from '../../../lib/theme';
import { colorMeta } from '../../game/meta';
import { Avatar } from '../../ui/kit';
import { useI18n } from '../../i18n';
import { uiFont } from '../../../lib/fonts';

/**
 * One seat in the rail above the table.
 *
 * The phone has no room for opponents' boards, so a chip has to answer the only
 * three questions that matter mid-game: how close are they to winning, how much
 * can they pay, and how many cards are they holding.
 */
function PlayerChipImpl({
    player,
    isTurn,
    isTargeted,
    isOwner,
    isYou,
    reactionEmoji,
    onPress,
}: PlayerChipProps) {
    const { t } = useI18n();
    const [chipWidth, setChipWidth] = useState(0);
    const onLayout = useCallback((event: LayoutChangeEvent) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setChipWidth((current) => current === next ? current : next);
    }, []);
    // Four/five-player tables keep the compact baseline. With fewer players,
    // each seat gets wider and its primary data should grow with it.
    const typeScale = Math.max(1, Math.min(1.4, (chipWidth || 92) / 92));
    const accessibilityLabel = [
        player.name,
        t('board.banked', { amount: `$${player.bank_total}M` }),
        t('board.in_hand', { count: player.hand_count }),
        t('board.sets', { count: player.complete_sets }),
    ].join(', ');

    return (
        <Pressable
            onPress={onPress}
            onLayout={onLayout}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            style={[styles.chip, isTurn && styles.turn, isTargeted && styles.targeted]}
        >
            <View style={styles.head}>
                <Avatar id={player.id} name={player.name} size={20} active={isTurn} dimmed={!player.connected} />
                <View style={styles.names}>
                    <Text style={[styles.name, { fontSize: 11 * typeScale }]} numberOfLines={1}>
                        {player.name}
                        {isOwner ? ' 👑' : ''}
                        {player.bot ? ' 🤖' : ''}
                    </Text>
                    {!player.connected && !player.bot ? (
                        <Text style={[styles.away, { fontSize: 8 * typeScale }]} numberOfLines={1}>{t('opponent.away')}</Text>
                    ) : null}
                </View>
            </View>

            <View style={styles.stats}>
                <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { fontSize: 7 * typeScale }]} numberOfLines={1}>
                        {t('opponent.bank_short')}
                    </Text>
                    <Text style={[styles.bank, { fontSize: 11 * typeScale }]} numberOfLines={1}>
                        ${player.bank_total}M
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { fontSize: 7 * typeScale }]} numberOfLines={1}>
                        {t('opponent.hand_short')}
                    </Text>
                    <Text style={[styles.stat, { fontSize: 11 * typeScale }]} numberOfLines={1}>
                        {player.hand_count}
                    </Text>
                </View>
                <View style={styles.metric}>
                    <Text style={[styles.metricLabel, { fontSize: 7 * typeScale }]} numberOfLines={1}>
                        {t('opponent.sets_short')}
                    </Text>
                    <Text style={[styles.sets, { fontSize: 11 * typeScale }]} numberOfLines={1}>
                        {player.complete_sets}/3
                    </Text>
                </View>
            </View>

            {/* The colours they already hold — the only board information that
                survives at this size. Back on a line of its own: at a quarter
                of the screen it had no room beside the numbers. */}
            <View style={styles.swatches}>
                {player.sets.map((s) => (
                    <View
                        key={s.color}
                        style={[
                            styles.swatch,
                            { backgroundColor: colorMeta(s.color).hex },
                            s.complete && styles.swatchComplete,
                        ]}
                    />
                ))}
            </View>

            {reactionEmoji ? (
                <Animated.View entering={ZoomIn.duration(150).easing(Easing.out(Easing.quad))} exiting={FadeOut.duration(150)} style={styles.reactionBubble}>
                    <Text style={styles.reactionBubbleText}>{reactionEmoji}</Text>
                </Animated.View>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        // No minimum: the slot decides the width, and a minimum here would push
        // the last chip off the screen rather than making them all narrower.
        minHeight: 54,
        paddingHorizontal: 5,
        paddingVertical: 5,
        justifyContent: 'center',
        borderRadius: radius.panel,
        backgroundColor: surface.panelOverlay,
        borderWidth: 1,
        borderColor: line.seat,
        gap: 3,
    },
    turn: { borderColor: brand.brass, backgroundColor: brand.brassGlow12 },
    targeted: { borderColor: status.dangerSeat },
    head: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    names: { flex: 1, minWidth: 0 },
    name: { fontFamily: uiFont(700), fontSize: 11, color: ink.body },
    away: { fontFamily: uiFont(700), fontSize: 8, color: ink.muted45 },
    stats: { flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
    metric: { flex: 1, minWidth: 0, alignItems: 'center' },
    metricLabel: { fontFamily: uiFont(900), color: ink.muted45, textTransform: 'uppercase' },
    bank: { fontFamily: uiFont(800), color: status.bank },
    stat: { fontFamily: uiFont(800), color: ink.body },
    sets: { fontFamily: uiFont(900), color: brand.brass },
    // Share the width: eight colours at a fixed size would overflow a quarter
    // of the screen, so each one takes an equal slice of whatever there is.
    swatches: { flexDirection: 'row', gap: 2, height: 4 },
    swatch: { flex: 1, height: 4, borderRadius: radius.xs },
    swatchComplete: { borderWidth: 1, borderColor: brand.brass },

    reactionBubble: {
        position: 'absolute',
        top: -16,
        right: -8,
        backgroundColor: ink.cream,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    reactionBubbleText: { fontSize: 24, lineHeight: Platform.OS === 'ios' ? 26 : 28 },
});

export const PlayerChip = memo(PlayerChipImpl);
export default PlayerChip;
