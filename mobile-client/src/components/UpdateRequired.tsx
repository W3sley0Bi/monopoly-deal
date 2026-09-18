import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useGameConnectionContext } from '../../lib/net/messages';
import { ink, surface } from '../../lib/theme';
import { displayFont, ls, uiFont } from '../../lib/fonts';
import { Btn, Panel } from '../ui/kit';
import { useI18n } from '../i18n';

/**
 * Covers the whole app once the app and the server disagree on the protocol.
 * A two-second error banner is not enough here: every online move would fail
 * the same way, and nothing the player does inside the app can fix it.
 *
 * Solo play runs entirely on the device, so it stays one tap away rather than
 * being locked behind an update the player may not be able to install yet.
 */
export function UpdateRequired() {
    const { incompatible } = useGameConnectionContext();
    const { t } = useI18n();
    const [dismissed, setDismissed] = useState(false);

    // Coming back from solo play against a server that is still mismatched
    // raises the screen again.
    useEffect(() => {
        if (!incompatible) setDismissed(false);
    }, [incompatible]);

    if (!incompatible || dismissed) return null;

    const side = incompatible === 'client_outdated' ? 'client' : 'server';
    return (
        <View style={styles.backdrop} accessibilityViewIsModal>
            <Panel style={styles.card}>
                <Text style={styles.title} accessibilityRole="header">
                    {t(`update.${side}.title`)}
                </Text>
                <Text style={styles.body}>{t(`update.${side}.body`)}</Text>
                <Btn label={t('update.play_offline')} onPress={() => setDismissed(true)} />
            </Panel>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: surface.room,
        justifyContent: 'center',
        padding: 16,
    },
    card: { padding: 18, gap: 12, backgroundColor: surface.welcomeCard },
    title: { fontFamily: displayFont(900), fontSize: 26, color: ink.cream, letterSpacing: ls(-0.04, 26) },
    body: { fontFamily: uiFont(700), fontSize: 14, color: ink.muted60, lineHeight: 20 },
});
