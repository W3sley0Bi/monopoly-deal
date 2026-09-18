import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SocketStatus } from '../../lib/net/socket';
import { brand, ink, line, radius } from '../../lib/theme';
import { uiFont } from '../../lib/fonts';
import { useI18n } from '../i18n';

export function ConnectionStatus({ status, onRetry }: { status: SocketStatus; onRetry: () => void }) {
    const { t } = useI18n();
    if (status === 'open') return null;

    const connecting = status === 'connecting';
    return (
        <View style={styles.row} accessibilityRole="alert">
            {connecting ? <ActivityIndicator size="small" color={ink.endTurnHint} /> : null}
            <Text style={styles.text}>{t(connecting ? 'home.connecting' : 'home.offline_status')}</Text>
            {!connecting ? (
                <Pressable
                    accessibilityRole="button"
                    onPress={onRetry}
                    style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
                >
                    <Text style={styles.retryText}>{t('home.retry_connection')}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        borderRadius: radius.md,
        backgroundColor: '#ffffff0a',
    },
    text: { flex: 1, fontFamily: uiFont(700), fontSize: 11, color: ink.endTurnHint },
    retry: {
        minHeight: 30,
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRadius: radius.sm,
        backgroundColor: '#ffffff12',
    },
    retryPressed: { opacity: 0.72 },
    retryText: { fontFamily: uiFont(800), fontSize: 11, color: brand.brass },
});
