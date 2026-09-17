import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { brand, radius, status, surface } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';
import { useI18n } from '../../i18n';

export type CountdownKind = 'turn' | 'respond' | 'starting';

export interface CountdownState {
    remainingMs: number;
    seconds: number;
    fraction: number;
    urgent: boolean;
}

/** Pure clock math shared by the UI and its unit tests. */
export function countdownState(
    deadlineMs: number,
    totalSeconds: number,
    skewMs: number,
    nowMs: number,
): CountdownState {
    const remainingMs = Math.max(0, deadlineMs - (nowMs + skewMs));
    return {
        remainingMs,
        seconds: Math.ceil(remainingMs / 1000),
        fraction: totalSeconds > 0 ? Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000))) : 0,
        urgent: remainingMs > 0 && remainingMs <= 5000,
    };
}

export function CountdownTimer({
    deadlineMs,
    totalSeconds,
    skewMs,
    kind = 'turn',
    compact = false,
}: {
    deadlineMs: number;
    totalSeconds: number;
    skewMs: number;
    kind?: CountdownKind;
    compact?: boolean;
}) {
    const { t } = useI18n();
    const [nowMs, setNowMs] = useState(Date.now());

    useEffect(() => {
        setNowMs(Date.now());
        if (!deadlineMs || !totalSeconds) return;
        const timer = setInterval(() => setNowMs(Date.now()), 100);
        return () => clearInterval(timer);
    }, [deadlineMs, totalSeconds]);

    if (!deadlineMs || !totalSeconds) return null;

    const state = countdownState(deadlineMs, totalSeconds, skewMs, nowMs);
    const tone = state.urgent ? status.danger : brand.brass;

    return (
        <View
            testID={`countdown-${kind}`}
            accessibilityRole="timer"
            accessibilityLabel={`${t(`timer.${kind}`)}: ${state.seconds}`}
            style={[styles.wrap, compact && styles.compact, state.urgent && styles.urgent]}
        >
            <Text testID={`countdown-${kind}-value`} style={[styles.value, { color: tone }]}>
                {state.seconds}s
            </Text>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${state.fraction * 100}%`, backgroundColor: tone }]} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        minWidth: 54,
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: surface.panelOverlay,
    },
    compact: { minWidth: 62, alignSelf: 'flex-start' },
    urgent: { backgroundColor: '#b3263e20' },
    value: { fontFamily: uiFont(900), fontSize: 12, lineHeight: 14, textAlign: 'center' },
    track: { height: 3, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#ffffff24' },
    fill: { height: 3, borderRadius: radius.pill },
});

export default CountdownTimer;
