import * as Haptics from 'expo-haptics';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGS, LANG_FLAG, LANG_LABEL, useI18n } from '../../i18n';
import { brand, ink, line, radius } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';
import { Icon } from './Icon';
import { LabelCaps } from './Panel';

export interface LanguagePickerProps {
    variant?: 'pills' | 'dropdown';
    label?: boolean;
}

/**
 * Language picker supporting flag pills or a collapsible dropdown menu.
 *
 * The language is per device, not per table — everyone at a table reads the
 * same game in their own language, which is why no server frame ever carries a
 * finished sentence. So this changes only what *you* see, and needs no message.
 */
function LanguagePickerImpl({ variant = 'pills', label = true }: LanguagePickerProps) {
    const { lang, setLang, t } = useI18n();
    const [open, setOpen] = useState(false);

    if (variant === 'dropdown') {
        return (
            <View style={styles.dropdownGroup}>
                {label ? <LabelCaps>{t('common.language')}</LabelCaps> : null}

                <Pressable
                    onPress={() => setOpen((prev) => !prev)}
                    accessibilityRole="combobox"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={t('common.language')}
                    hitSlop={4}
                    style={[styles.dropdownTrigger, open && styles.dropdownTriggerOpen]}
                >
                    <View style={styles.dropdownValue}>
                        <Text style={styles.flag}>{LANG_FLAG[lang]}</Text>
                        <Text style={styles.dropdownValueText}>{LANG_LABEL[lang]}</Text>
                    </View>
                    <Icon
                        name={open ? 'chevron.up' : 'chevron.down'}
                        fallback={open ? '▴' : '▾'}
                        size={16}
                        color={ink.muted45}
                    />
                </Pressable>

                {open ? (
                    <View style={styles.dropdownMenu}>
                        {LANGS.map((l, index) => {
                            const on = l === lang;
                            return (
                                <Pressable
                                    key={l}
                                    onPress={() => {
                                        void Haptics.selectionAsync();
                                        setLang(l);
                                        setOpen(false);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: on }}
                                    accessibilityLabel={LANG_LABEL[l]}
                                    style={({ pressed }) => [
                                        styles.dropdownOption,
                                        index < LANGS.length - 1 && styles.dropdownOptionBorder,
                                        on && styles.dropdownOptionSelected,
                                        pressed && styles.dropdownOptionPressed,
                                    ]}
                                >
                                    <View style={styles.dropdownOptionLeft}>
                                        <Text style={styles.flag}>{LANG_FLAG[l]}</Text>
                                        <Text
                                            style={[
                                                styles.dropdownOptionText,
                                                on && styles.dropdownOptionTextSelected,
                                            ]}
                                        >
                                            {LANG_LABEL[l]}
                                        </Text>
                                    </View>
                                    {on ? (
                                        <Icon name="checkmark" fallback="✓" size={16} color={brand.brass} />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                ) : null}
            </View>
        );
    }

    return (
        <View style={styles.row}>
            {LANGS.map((l) => {
                const on = l === lang;
                return (
                    <Pressable
                        key={l}
                        onPress={() => {
                            void Haptics.selectionAsync();
                            setLang(l);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={LANG_LABEL[l]}
                        style={[styles.pill, on && styles.pillOn]}
                    >
                        <Text style={styles.flag}>{LANG_FLAG[l]}</Text>
                        <Text style={[styles.label, on && styles.labelOn]}>{LANG_LABEL[l]}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: 6 },
    pill: {
        flex: 1,
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        backgroundColor: '#ffffff0f',
    },
    pillOn: { borderColor: brand.brass, backgroundColor: brand.brassGlow12 },
    flag: { fontSize: 15 },
    label: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60 },
    labelOn: { color: ink.body },
    dropdownGroup: { gap: 7 },
    dropdownTrigger: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        backgroundColor: '#ffffff0f',
    },
    dropdownTriggerOpen: { borderColor: brand.brass },
    dropdownValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dropdownValueText: { fontFamily: uiFont(700), fontSize: 14, color: ink.body },
    dropdownMenu: {
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: line.seat,
        backgroundColor: '#00171c',
        overflow: 'hidden',
    },
    dropdownOption: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
    },
    dropdownOptionBorder: {
        borderBottomWidth: 1,
        borderBottomColor: line.hairlineWhite10,
    },
    dropdownOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dropdownOptionSelected: { backgroundColor: brand.brassGlow12 },
    dropdownOptionPressed: { opacity: 0.75 },
    dropdownOptionText: { fontFamily: uiFont(700), fontSize: 13, color: ink.muted60 },
    dropdownOptionTextSelected: { color: ink.body },
});

export const LanguagePicker = memo(LanguagePickerImpl);
export default LanguagePicker;
