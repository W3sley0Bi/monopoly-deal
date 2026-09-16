import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    playBubbleText,
    reactionEmoji,
    onPress,
}: PlayerChipProps) {
    const { t } = useI18n();

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={player.name}
            style={[styles.chip, isTurn && styles.turn, isTargeted && styles.targeted]}
        >
            <View style={styles.head}>
                <Avatar id={player.id} name={player.name} size={20} active={isTurn} dimmed={!player.connected} />
                <View style={styles.names}>
                    <Text style={styles.name} numberOfLines={1}>
                        {player.name}
                        {isOwner ? ' 👑' : ''}
                        {player.bot ? ' 🤖' : ''}
                    </Text>
                    {!player.connected && !player.bot ? (
                        <Text style={styles.away} numberOfLines={1}>{t('opponent.away')}</Text>
                    ) : null}
                </View>
            </View>

            <View style={styles.stats}>
                <Text style={styles.bank} numberOfLines={1}>${player.bank_total}M</Text>
                <Text style={styles.stat} numberOfLines={1}>🂠{player.hand_count}</Text>
                <Text style={styles.stat} numberOfLines={1}>◼{player.complete_sets}</Text>
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
                <View style={styles.reaction}>
                    <Text style={styles.reactionText}>{reactionEmoji}</Text>
                </View>
            ) : playBubbleText ? (
                <View style={styles.bubble}>
                    <Text style={styles.bubbleText} numberOfLines={2}>
                        {playBubbleText}
                    </Text>
                </View>
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
    stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
    bank: { fontFamily: uiFont(800), fontSize: 10, color: status.bank },
    stat: { fontFamily: uiFont(700), fontSize: 9, color: ink.muted60 },
    // Share the width: eight colours at a fixed size would overflow a quarter
    // of the screen, so each one takes an equal slice of whatever there is.
    swatches: { flexDirection: 'row', gap: 2, height: 4 },
    swatch: { flex: 1, height: 4, borderRadius: radius.xs },
    swatchComplete: { borderWidth: 1, borderColor: brand.brass },
    bubble: {
        position: 'absolute',
        left: 4,
        right: 4,
        bottom: 4,
        paddingHorizontal: 5,
        paddingVertical: 3,
        borderRadius: 9,
        backgroundColor: '#f6f2e3',
    },
    bubbleText: { fontFamily: uiFont(700), fontSize: 9, color: ink.seatPlay, lineHeight: 12 },
    reaction: { position: 'absolute', right: 3, top: 3 },
    reactionText: { fontSize: 20 },
});

export const PlayerChip = memo(PlayerChipImpl);
export default PlayerChip;
