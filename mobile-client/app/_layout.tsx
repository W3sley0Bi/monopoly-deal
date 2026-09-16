// Polyfill first: RN's `URL` is incomplete on older Hermes and the invite
// deep link / GIF / radio validation all rely on a real one — SHELL-SPEC §9.
import 'react-native-url-polyfill/auto';

import { useEffect } from 'react';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';

import { useAppFonts } from '../lib/fonts';
import { useStore } from '../lib/store';
import { GameConnectionProvider } from '../lib/net/messages';
import { I18nProvider } from '../src/i18n';
import { surface } from '../lib/theme';

// Must run at module scope, before the first render — EXPO-57.md §2.
SplashScreen.preventAutoHideAsync();

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
                            <Stack
                                screenOptions={{
                                    headerShown: true,
                                    headerStyle: { backgroundColor: surface.room },
                                    headerTintColor: '#f4f2e9',
                                    contentStyle: { backgroundColor: surface.bodyBase },
                                }}
                            >
                                <Stack.Screen name="index" options={{ title: 'Deal' }} />
                                <Stack.Screen name="lobby" options={{ title: 'Lobby' }} />
                                {/* Full-bleed, no native header — the table draws
                                    its own header and owns the whole screen. */}
                                <Stack.Screen name="table" options={{ headerShown: false }} />
                            </Stack>
                            <StatusBar style="light" />
                        </ThemeProvider>
                    </GameConnectionProvider>
                </I18nProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
