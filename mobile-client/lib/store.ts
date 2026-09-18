/**
 * Persisted app state — zustand + AsyncStorage, per SHELL-SPEC.md §1.
 *
 * The web app's `persistentId()`, `initialLang()`, `readSaved()` and
 * `tutorialSeen()` are synchronous localStorage initialisers; AsyncStorage is
 * async, so this store does **not** read storage during render. Call
 * `hydrate()` once at boot (in the root layout) and gate first render on
 * `hydrated`. Nothing here throws if storage is unavailable — every read is
 * wrapped and falls back to the documented default.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { create } from 'zustand';

import type { RoomView } from '../src/types';

// ---- keys -------------------------------------------------------------------

const KEY_PLAYER_ID = 'md.playerId';
const KEY_PLAYER_NAME = 'md.playerName';
const KEY_ROOM_ID = 'md.roomId';
const KEY_TUTORIAL_DONE = 'md.tutorial.done';
const KEY_LANG = 'md.lang';
const KEY_AUDIO = 'md.game.audio';
const KEY_MOTION = 'md.motion';
const KEY_TAP_TRAY = 'md.taptray';
const KEY_CRY_REACTION = 'md.cryreaction';
const KEY_LIVE_PLAY = 'md.liveplay';
// md.install.dismissed intentionally dropped — a native app is already installed.

export type Lang = 'en' | 'it' | 'de' | 'fr';

export interface AudioSettings {
    sfxEnabled: boolean;
    radioEnabled: boolean;
    sfxVolume: number;
    radioVolume: number;
}

export const DEFAULT_AUDIO: AudioSettings = {
    sfxEnabled: true,
    radioEnabled: false,
    sfxVolume: 0.58,
    radioVolume: 0.5,
};

function clamp01(n: number): number {
    if (typeof n !== 'number' || Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

/** First-launch fallback before a saved `md.lang` exists — the native
 *  replacement for `navigator.languages`. */
function deviceLang(): Lang {
    const locales = Localization.getLocales();
    for (const l of locales) {
        if (l.languageCode === 'en' || l.languageCode === 'it' || l.languageCode === 'de' || l.languageCode === 'fr') {
            return l.languageCode;
        }
    }
    return 'en';
}

function mintPlayerId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let out = '';
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return `p_${out}`;
}

async function readString(key: string): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(key);
    } catch {
        return null;
    }
}

async function writeString(key: string, value: string | null): Promise<void> {
    try {
        if (value === null) await AsyncStorage.removeItem(key);
        else await AsyncStorage.setItem(key, value);
    } catch {
        // best-effort persistence, per `persist()`'s try/catch in the web app
    }
}

async function readBool(key: string, fallback: boolean): Promise<boolean> {
    const raw = await readString(key);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
}

async function writeBool(key: string, value: boolean): Promise<void> {
    await writeString(key, value ? '1' : '0');
}

interface Store {
    hydrated: boolean;

    playerId: string;
    playerName: string;
    /** Current/last room code, for the reconnect `rejoin` ref. `null` when none. */
    roomId: string | null;
    tutorialDone: boolean;
    lang: Lang;
    audio: AudioSettings;
    motion: boolean;
    tapTray: boolean;
    cryReaction: boolean;
    /** Show the player whose turn it is, full size, over the table. Off by
     *  default: it is a big panel over the felt, and most of the time you want
     *  to watch the table itself. */
    livePlay: boolean;
    /** A hand-built table from `src/dev/fixtures`, shown instead of the live
     *  room. Never persisted, and only ever set from a `__DEV__` screen. */
    devRoom: RoomView | null;

    hydrate: () => Promise<void>;
    setPlayerName: (name: string) => void;
    setRoomId: (roomId: string | null) => void;
    setTutorialDone: (done: boolean) => void;
    setLang: (lang: Lang) => void;
    setAudio: (audio: Partial<AudioSettings>) => void;
    setMotion: (on: boolean) => void;
    setTapTray: (on: boolean) => void;
    setCryReaction: (on: boolean) => void;
    setLivePlay: (on: boolean) => void;
    setDevRoom: (room: RoomView | null) => void;
}

export const useStore = create<Store>((set, get) => ({
    hydrated: false,

    playerId: '',
    playerName: '',
    roomId: null,
    tutorialDone: false,
    lang: 'en',
    audio: DEFAULT_AUDIO,
    motion: true,
    tapTray: false,
    cryReaction: false,
    livePlay: false,
    devRoom: null,

    hydrate: async () => {
        if (get().hydrated) return;

        let playerId = await readString(KEY_PLAYER_ID);
        if (!playerId) {
            playerId = mintPlayerId();
            await writeString(KEY_PLAYER_ID, playerId);
        }

        const playerName = (await readString(KEY_PLAYER_NAME)) ?? '';
        const roomId = await readString(KEY_ROOM_ID);
        const tutorialDone = (await readString(KEY_TUTORIAL_DONE)) === '1';

        let lang: Lang = deviceLang();
        const savedLang = await readString(KEY_LANG);
        if (savedLang === 'en' || savedLang === 'it' || savedLang === 'de' || savedLang === 'fr') lang = savedLang;

        let audio: AudioSettings = DEFAULT_AUDIO;
        const savedAudio = await readString(KEY_AUDIO);
        if (savedAudio) {
            try {
                const parsed = JSON.parse(savedAudio) as Partial<AudioSettings>;
                audio = {
                    sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : DEFAULT_AUDIO.sfxEnabled,
                    radioEnabled: typeof parsed.radioEnabled === 'boolean' ? parsed.radioEnabled : DEFAULT_AUDIO.radioEnabled,
                    sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_AUDIO.sfxVolume),
                    radioVolume: clamp01(parsed.radioVolume ?? DEFAULT_AUDIO.radioVolume),
                };
            } catch {
                audio = DEFAULT_AUDIO;
            }
        }

        const motion = await readBool(KEY_MOTION, true);
        const tapTray = await readBool(KEY_TAP_TRAY, false);
        const cryReaction = await readBool(KEY_CRY_REACTION, false);
        const livePlay = await readBool(KEY_LIVE_PLAY, false);

        set({
            hydrated: true,
            playerId,
            playerName,
            roomId: roomId || null,
            tutorialDone,
            lang,
            audio,
            livePlay,
            motion,
            tapTray,
            cryReaction,
        });
    },

    setPlayerName: (name) => {
        set({ playerName: name });
        void writeString(KEY_PLAYER_NAME, name);
    },

    setRoomId: (roomId) => {
        set({ roomId });
        void writeString(KEY_ROOM_ID, roomId);
    },

    setTutorialDone: (done) => {
        set({ tutorialDone: done });
        void writeString(KEY_TUTORIAL_DONE, done ? '1' : null);
    },

    setLang: (lang) => {
        set({ lang });
        void writeString(KEY_LANG, lang);
    },

    setAudio: (partial) => {
        const next: AudioSettings = {
            ...get().audio,
            ...partial,
        };
        if (partial.sfxVolume !== undefined) next.sfxVolume = clamp01(partial.sfxVolume);
        if (partial.radioVolume !== undefined) next.radioVolume = clamp01(partial.radioVolume);
        set({ audio: next });
        void writeString(KEY_AUDIO, JSON.stringify(next));
    },

    setMotion: (on) => {
        set({ motion: on });
        void writeBool(KEY_MOTION, on);
    },

    setTapTray: (on) => {
        set({ tapTray: on });
        void writeBool(KEY_TAP_TRAY, on);
    },

    setLivePlay: (on) => {
        set({ livePlay: on });
        void writeBool(KEY_LIVE_PLAY, on);
    },

    setDevRoom: (room) => set({ devRoom: room }),

    setCryReaction: (on) => {
        set({ cryReaction: on });
        void writeBool(KEY_CRY_REACTION, on);
    },
}));
