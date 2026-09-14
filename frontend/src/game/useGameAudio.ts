import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameView, LogEntry } from '../types';

/** A deliberately small, original sound palette for the table. */
export type GameAudioCue =
    | 'card_draw'
    | 'card_play'
    | 'bank'
    | 'turn'
    | 'action'
    | 'payment'
    | 'shuffle'
    | 'error'
    | 'win';

export interface GameAudio {
    /** Audio is created only after one of the user's controls calls unlock. */
    unlocked: boolean;
    sfxEnabled: boolean;
    musicEnabled: boolean;
    sfxVolume: number;
    musicVolume: number;
    unlock: () => Promise<void>;
    play: (cue: GameAudioCue) => void;
    setSfxEnabled: (enabled: boolean) => void;
    setMusicEnabled: (enabled: boolean) => void;
    setSfxVolume: (volume: number) => void;
    setMusicVolume: (volume: number) => void;
}

interface SavedAudio {
    sfxEnabled: boolean;
    musicEnabled: boolean;
    sfxVolume: number;
    musicVolume: number;
}

const DEFAULTS: SavedAudio = {
    sfxEnabled: true,
    // Music is opt-in. Browsers also reject music that starts without a gesture.
    musicEnabled: false,
    sfxVolume: 0.58,
    musicVolume: 0.65,
};

const STORAGE_KEY = 'md.game.audio';

function readSaved(): SavedAudio {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<SavedAudio>;
        return {
            sfxEnabled: saved.sfxEnabled !== false,
            musicEnabled: saved.musicEnabled === true,
            sfxVolume: clamp(typeof saved.sfxVolume === 'number' ? saved.sfxVolume : DEFAULTS.sfxVolume),
            musicVolume: clamp(typeof saved.musicVolume === 'number' ? saved.musicVolume : DEFAULTS.musicVolume),
        };
    } catch {
        return DEFAULTS;
    }
}

function clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
}

type AudioContextWithWebkit = typeof AudioContext & { new (): AudioContext };

function contextConstructor(): AudioContextWithWebkit | undefined {
    if (typeof window === 'undefined') return undefined;
    const w = window as Window & typeof globalThis & { webkitAudioContext?: AudioContextWithWebkit };
    return w.AudioContext || w.webkitAudioContext;
}

function frequency(note: number): number {
    return 440 * 2 ** ((note - 69) / 12);
}

/**
 * Owns one AudioContext. Keeping this outside React effects means a render,
 * reconnect, or table layout change cannot create a second music loop.
 */
class AudioEngine {
    readonly context: AudioContext;
    private readonly sfx: GainNode;
    private readonly music: GainNode;
    private readonly compressor: DynamicsCompressorNode;
    private musicTimer: number | undefined;
    private musicStep = 0;
    private noiseBuffer: AudioBuffer | undefined;

    constructor(Ctor: AudioContextWithWebkit) {
        this.context = new Ctor();
        this.sfx = this.context.createGain();
        this.music = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.sfx.connect(this.compressor);
        this.music.connect(this.compressor);
        this.compressor.connect(this.context.destination);
        this.sfx.gain.value = DEFAULTS.sfxVolume;
        this.music.gain.value = 0;
    }

    setSfxVolume(value: number) { this.sfx.gain.value = clamp(value); }
    setMusicVolume(value: number) { this.music.gain.value = clamp(value) * 0.12; }

    async resume(): Promise<void> {
        if (this.context.state === 'suspended') await this.context.resume();
    }

    startMusic(volume: number): void {
        this.music.gain.setTargetAtTime(clamp(volume) * 0.12, this.context.currentTime, 0.12);
        if (this.musicTimer !== undefined) return;
        this.musicStep = 0;
        this.scheduleMusicStep();
        this.musicTimer = window.setInterval(() => this.scheduleMusicStep(), 1450);
    }

    stopMusic(): void {
        this.music.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
        if (this.musicTimer !== undefined) {
            window.clearInterval(this.musicTimer);
            this.musicTimer = undefined;
        }
    }

    dispose(): void {
        this.stopMusic();
        void this.context.close();
    }

    cue(cue: GameAudioCue): void {
        if (this.context.state === 'closed') return;
        const now = this.context.currentTime + 0.005;
        switch (cue) {
            case 'card_draw':
                this.tone(72, 0.07, 0.045, now, 'triangle');
                this.tone(79, 0.08, 0.035, now + 0.045, 'triangle');
                this.noise(0.04, 0.018, now, 1600);
                break;
            case 'card_play':
                this.noise(0.08, 0.026, now, 900);
                this.tone(67, 0.1, 0.055, now + 0.025, 'triangle');
                this.tone(74, 0.12, 0.045, now + 0.09, 'triangle');
                break;
            case 'bank':
                this.tone(76, 0.1, 0.065, now, 'sine');
                this.tone(83, 0.16, 0.06, now + 0.07, 'sine');
                this.tone(88, 0.2, 0.045, now + 0.14, 'sine');
                break;
            case 'turn':
                this.tone(72, 0.13, 0.065, now, 'sine');
                this.tone(76, 0.17, 0.06, now + 0.11, 'sine');
                this.tone(79, 0.26, 0.055, now + 0.22, 'sine');
                break;
            case 'action':
                this.tone(79, 0.1, 0.06, now, 'square');
                this.tone(86, 0.12, 0.045, now + 0.07, 'square');
                this.tone(91, 0.2, 0.04, now + 0.14, 'triangle');
                break;
            case 'payment':
                this.tone(88, 0.08, 0.055, now, 'sine');
                this.tone(93, 0.08, 0.05, now + 0.09, 'sine');
                this.tone(100, 0.18, 0.045, now + 0.18, 'sine');
                this.noise(0.05, 0.012, now + 0.02, 3200);
                break;
            case 'shuffle':
                this.noise(0.12, 0.02, now, 1100);
                this.noise(0.12, 0.016, now + 0.1, 1500);
                this.noise(0.12, 0.013, now + 0.2, 1900);
                break;
            case 'error':
                this.tone(55, 0.18, 0.05, now, 'sawtooth');
                this.tone(49, 0.22, 0.04, now + 0.14, 'sawtooth');
                break;
            case 'win':
                [72, 76, 79, 84, 88].forEach((note, index) => this.tone(note, 0.3, 0.065, now + index * 0.13, 'triangle'));
                break;
        }
    }

    private tone(note: number, duration: number, gainAmount: number, at: number, type: OscillatorType): void {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency(note), at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(gainAmount, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        oscillator.connect(gain).connect(this.sfx);
        oscillator.start(at);
        oscillator.stop(at + duration + 0.025);
    }

    private noise(duration: number, gainAmount: number, at: number, cutoff: number): void {
        if (!this.noiseBuffer) {
            const length = this.context.sampleRate * 0.3;
            this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
        }
        const source = this.context.createBufferSource();
        const filter = this.context.createBiquadFilter();
        const gain = this.context.createGain();
        source.buffer = this.noiseBuffer;
        filter.type = 'highpass';
        filter.frequency.value = cutoff;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(gainAmount, at + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        source.connect(filter).connect(gain).connect(this.sfx);
        source.start(at);
        source.stop(at + duration + 0.02);
    }

    private scheduleMusicStep(): void {
        const now = this.context.currentTime + 0.02;
        // A slow, almost board-game-like loop: warm root notes with a small
        // pluck on every second bar. It stays under voice chat and game cues.
        const roots = [48, 48, 53, 53, 55, 55, 43, 43];
        const root = roots[this.musicStep % roots.length];
        this.musicTone(root, 1.25, 0.08, now);
        if (this.musicStep % 2 === 0) this.musicTone(root + 12, 0.4, 0.045, now + 0.25);
        if (this.musicStep % 4 === 3) this.musicTone(root + 19, 0.55, 0.035, now + 0.55);
        this.musicStep += 1;
    }

    private musicTone(note: number, duration: number, gainAmount: number, at: number): void {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency(note), at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(gainAmount, at + 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
        oscillator.connect(gain).connect(this.music);
        oscillator.start(at);
        oscillator.stop(at + duration + 0.04);
    }
}

function logSignature(entry: LogEntry): string {
    return `${entry.key}:${JSON.stringify(entry.args || {})}`;
}

function cueForLog(key: string): GameAudioCue | undefined {
    if (key === 'log.game_started') return 'turn';
    if (key === 'log.turn') return 'turn';
    if (key === 'log.banked' || key === 'log.banked_money') return 'bank';
    if (key === 'log.played_property' || key === 'log.moved_wildcard' || key === 'log.building' || key === 'log.discarded') return 'card_play';
    if (key === 'log.pass_go') return 'card_play';
    if (key === 'log.reshuffled') return 'shuffle';
    if (key === 'log.charge' || key === 'log.charge_everyone' || key === 'log.sly_deal' || key === 'log.forced_deal' || key === 'log.deal_breaker') return 'action';
    if (key === 'log.paid' || key === 'log.stole' || key === 'log.swapped' || key === 'log.took_set') return 'payment';
    if (key === 'log.just_say_no_cancelled' || key === 'log.just_say_no_back_on' || key === 'log.accepts_block') return 'action';
    if (key === 'log.nothing_to_pay' || key === 'log.timeout_respond' || key === 'log.timeout_turn') return 'error';
    if (key === 'log.win_classic' || key === 'log.win_deathmatch') return 'win';
    return undefined;
}

/**
 * Creates game audio once per mounted app and translates newly appended server
 * log entries into cues. The first snapshot is intentionally silent, so
 * reconnecting to a lively table does not replay sixty old moves.
 */
export function useGameAudio(game: GameView | null): GameAudio {
    const [saved, setSaved] = useState<SavedAudio>(readSaved);
    const [unlocked, setUnlocked] = useState(false);
    const engine = useRef<AudioEngine | null>(null);
    const previousGameId = useRef<string | null>(null);
    const previousLog = useRef<string[] | null>(null);
    const sfxEnabled = saved.sfxEnabled;
    const musicEnabled = saved.musicEnabled;
    const musicEnabledRef = useRef(musicEnabled);
    const musicVolumeRef = useRef(saved.musicVolume);

    const persist = useCallback((patch: Partial<SavedAudio>) => {
        setSaved(previous => {
            const next = { ...previous, ...patch };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
            return next;
        });
    }, []);

    const unlock = useCallback(async () => {
        if (!engine.current) {
            const Ctor = contextConstructor();
            if (!Ctor) return;
            engine.current = new AudioEngine(Ctor);
            engine.current.setSfxVolume(saved.sfxVolume);
            engine.current.setMusicVolume(saved.musicVolume);
        }
        await engine.current.resume();
        setUnlocked(true);
        if (musicEnabledRef.current) engine.current.startMusic(musicVolumeRef.current);
    }, [saved.musicVolume, saved.sfxVolume]);

    const play = useCallback((cue: GameAudioCue) => {
        if (!sfxEnabled || !engine.current || !unlocked) return;
        engine.current.cue(cue);
    }, [sfxEnabled, unlocked]);

    const setSfxEnabled = useCallback((enabled: boolean) => {
        persist({ sfxEnabled: enabled });
        if (enabled) void unlock();
    }, [persist, unlock]);
    const setMusicEnabled = useCallback((enabled: boolean) => {
        // Update this synchronously so a quick on → off toggle cannot let a
        // pending browser resume promise restart the music after it is muted.
        musicEnabledRef.current = enabled;
        persist({ musicEnabled: enabled });
        if (enabled) {
            void unlock();
        } else engine.current?.stopMusic();
    }, [persist, unlock]);
    const setSfxVolume = useCallback((volume: number) => {
        const next = clamp(volume);
        persist({ sfxVolume: next });
        engine.current?.setSfxVolume(next);
    }, [persist]);
    const setMusicVolume = useCallback((volume: number) => {
        const next = clamp(volume);
        musicVolumeRef.current = next;
        persist({ musicVolume: next });
        if (engine.current) engine.current.setMusicVolume(next);
    }, [persist]);

    useEffect(() => {
        if (!game) {
            previousGameId.current = null;
            previousLog.current = null;
            return;
        }
        const entries = game.log.map(logSignature);
        if (previousGameId.current !== game.id) {
            previousGameId.current = game.id;
            previousLog.current = entries;
            return;
        }
        const old = previousLog.current;
        previousLog.current = entries;
        if (!old) return;
        // The server keeps the newest 60 lines. Find the old suffix that is
        // still present, then only process entries after it.
        let overlap = Math.min(old.length, entries.length);
        while (overlap > 0 && old.slice(old.length - overlap).join('\u0000') !== entries.slice(0, overlap).join('\u0000')) overlap -= 1;
        // A reconnect or a newly cleared game can replace the whole bounded
        // log between renders. Treat that as a new baseline rather than
        // replaying every visible line at once.
        if (old.length > 0 && overlap === 0) return;
        const fresh = entries.slice(overlap);
        fresh.forEach(signature => {
            const cue = cueForLog(signature.slice(0, signature.indexOf(':')));
            if (cue) play(cue);
        });
    }, [game, play]);

    useEffect(() => () => engine.current?.dispose(), []);

    return {
        unlocked,
        sfxEnabled,
        musicEnabled,
        sfxVolume: saved.sfxVolume,
        musicVolume: saved.musicVolume,
        unlock,
        play,
        setSfxEnabled,
        setMusicEnabled,
        setSfxVolume,
        setMusicVolume,
    };
}
