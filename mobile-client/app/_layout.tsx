// Polyfill first: RN's `URL` is incomplete on older Hermes and the invite
// deep link / GIF / radio validation all rely on a real one — SHELL-SPEC §9.
import 'react-native-url-polyfill/auto';

import { useEffect } from 'react';
import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { lockViewport } from '../src/web/lockViewport';
import { useAppFonts } from '../lib/fonts';
import { useStore } from '../lib/store';
import { GameConnectionProvider } from '../lib/net/messages';
import { I18nProvider } from '../src/i18n';
import { UpdateRequired } from '../src/components/UpdateRequired';
import { surface } from '../lib/theme';

// Must run at module scope, before the first render — EXPO-57.md §2.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Same reason, and a no-op off the web: the page has to stop being zoomable
// before it has been painted, not after the player has already pinched it.
lockViewport();

/** Last-resort recovery for render and route failures. This intentionally has
 * no app-context dependencies because a provider itself may be what failed. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    return (
        <View style={errorStyles.screen} accessibilityViewIsModal>
            <Text style={errorStyles.title} accessibilityRole="header">Something went wrong</Text>
            <Text style={errorStyles.body}>The game hit an unexpected problem. Your saved name and settings are still safe.</Text>
            {__DEV__ ? <Text style={errorStyles.detail}>{error.message}</Text> : null}
            <Pressable
                accessibilityRole="button"
                onPress={() => void retry()}
                style={({ pressed }) => [errorStyles.button, pressed && errorStyles.buttonPressed]}
            >
                <Text style={errorStyles.buttonText}>Try again</Text>
            </Pressable>
        </View>
    );
}

export default function RootLayout() {
    const hydrated = useStore((s) => s.hydrated);
    const hydrate = useStore((s) => s.hydrate);
    const fontsLoaded = useAppFonts();

    useEffect(() => {
        void hydrate();
    }, [hydrate]);

    useEffect(() => {
        if (hydrated && fontsLoaded) {
            void SplashScreen.hideAsync();
        }
    }, [hydrated, fontsLoaded]);

    // Keep the splash on screen — no flash of an unstyled or unhydrated app.
    if (!hydrated || !fontsLoaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <I18nProvider>
                    <GameConnectionProvider>
                        {/* Always dark — the room is a near-black teal in both
                            OS themes; there is no light variant of this app. */}
                        <ThemeProvider value={DarkTheme}>
                            {/*
                              * Every move between these screens is a `replace`,
                              * because the server — not the back stack — decides
                              * where you belong. Without `animationTypeForReplace`
                              * a replace animates as a pop whichever way it goes,
                              * which is why screens appeared to arrive from the
                              * same side and pile up: going deeper looked
                              * identical to coming back. Each screen declares the
                              * direction it should arrive from instead.
                              */}
                            <Stack
                                screenOptions={{
                                    headerShown: true,
                                    headerStyle: { backgroundColor: surface.room },
                                    headerTintColor: '#f4f2e9',
                                    contentStyle: { backgroundColor: surface.bodyBase },
                                    animation: 'slide_from_right',
                                    animationDuration: 260,
                                }}
                            >
                                {/* Home is always a step back. */}
                                <Stack.Screen
                                    name="index"
                                    options={{ title: 'Deal', animationTypeForReplace: 'pop' }}
                                />
                                <Stack.Screen
                                    name="online"
                                    options={{ title: 'Play Online', animationTypeForReplace: 'push' }}
                                />
                                <Stack.Screen
                                    name="lobby"
                                    options={{ title: 'Lobby', animationTypeForReplace: 'push' }}
                                />
                                {/* Full-bleed, no native header — the table draws
                                    its own header and owns the whole screen. It
                                    fades rather than slides: it is a place you
                                    arrive at, and a slide fought with the felt
                                    animating in underneath. The back swipe is off
                                    — leaving a table goes through `leave`, so the
                                    server hears about it. */}
                                <Stack.Screen
                                    name="table"
                                    options={{
                                        headerShown: false,
                                        animation: 'fade',
                                        animationDuration: 220,
                                        animationTypeForReplace: 'push',
                                        gestureEnabled: false,
                                    }}
                                />
                            </Stack>
                            <UpdateRequired />
                            <StatusBar style="light" />
                        </ThemeProvider>
                    </GameConnectionProvider>
                </I18nProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const errorStyles = StyleSheet.create({
    screen: {
        flex: 1,
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        backgroundColor: surface.bodyBase,
    },
    title: { color: '#f4f2e9', fontSize: 24, fontWeight: '800' },
    body: { color: '#c2ccc7', fontSize: 15, lineHeight: 21 },
    detail: { color: '#e9a9a9', fontSize: 12, lineHeight: 17 },
    button: {
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: '#d4bd3e',
        paddingHorizontal: 18,
    },
    buttonPressed: { opacity: 0.8 },
    buttonText: { color: '#24240e', fontSize: 15, fontWeight: '800' },
});
