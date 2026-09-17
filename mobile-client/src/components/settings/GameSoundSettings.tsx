import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStore } from '../../../lib/store';
import { brand, ink, line, radius, surface } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';
import { useI18n } from '../../i18n';
import { LabelCaps, Toggle } from '../../ui/kit';

const LEVELS = [0.25, 0.6, 1] as const;

function closestLevel(volume: number): number {
    return LEVELS.reduce((closest, level) =>
        Math.abs(level - volume) < Math.abs(closest - volume) ? level : closest,
    LEVELS[0]);
}

function GameSoundSettingsImpl() {
    const { t } = useI18n();
    const enabled = useStore((state) => state.audio.sfxEnabled);
    const volume = useStore((state) => state.audio.sfxVolume);
    const setAudio = useStore((state) => state.setAudio);
    const selectedLevel = closestLevel(volume);

    return (
        <View style={styles.group}>
            <LabelCaps>{t('audio.group')}</LabelCaps>
            <Toggle
                label={t('audio.sounds')}
                hint={t(enabled ? 'audio.mute_sounds' : 'audio.enable_sounds')}
                value={enabled}
                onChange={(next) => {
                    void Haptics.selectionAsync();
                    setAudio({ sfxEnabled: next });
                }}
            />

            {enabled ? (
                <View style={styles.volumeRow}>
                    <Text style={styles.volumeLabel}>{t('audio.sfx_volume')}</Text>
                    <View style={styles.levels} accessibilityRole="radiogroup">
                        {LEVELS.map((level) => {
                            const selected = level === selectedLevel;
                            const percentage = Math.round(level * 100);
                            return (
                                <Pressable
                                    key={level}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selected }}
                                    accessibilityLabel={`${t('audio.sfx_volume')}: ${percentage}%`}
                                    onPress={() => {
                                        void Haptics.selectionAsync();
                                        setAudio({ sfxVolume: level });
                                    }}
                                    style={({ pressed }) => [
                                        styles.level,
                                        selected && styles.levelSelected,
                                        pressed && styles.levelPressed,
                                    ]}
                                >
                                    <Text style={[styles.levelText, selected && styles.levelTextSelected]}>
                                        {percentage}%
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    group: { gap: 7 },
    volumeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.panel,
        backgroundColor: surface.panelOverlay,
    },
    volumeLabel: { flex: 1, fontFamily: uiFont(800), fontSize: 12, color: ink.body },
    levels: {
        flexDirection: 'row',
        gap: 3,
        padding: 3,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: line.seat,
        backgroundColor: '#00171c',
    },
    level: {
        minWidth: 42,
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
    },
    levelSelected: { backgroundColor: brand.brass },
    levelPressed: { opacity: 0.72 },
    levelText: { fontFamily: uiFont(900), fontSize: 10, color: ink.muted60 },
    levelTextSelected: { color: '#172000' },
});

export const GameSoundSettings = memo(GameSoundSettingsImpl);
export default GameSoundSettings;
