import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LANGS, LANG_FLAG, LANG_LABEL, useI18n } from '../../i18n';
import { brand, ink, line, radius } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';

/**
 * Flag pills for the three catalogues.
 *
 * The language is per device, not per table — everyone at a table reads the
 * same game in their own language, which is why no server frame ever carries a
 * finished sentence. So this changes only what *you* see, and needs no message.
 */
function LanguagePickerImpl() {
    const { lang, setLang } = useI18n();

    return (
        <View style={styles.row}>
            {LANGS.map((l) => {
                const on = l === lang;
                return (
                    <Pressable
                        key={l}
                        onPress={() => setLang(l)}
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
});

export const LanguagePicker = memo(LanguagePickerImpl);
export default LanguagePicker;
