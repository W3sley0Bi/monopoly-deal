import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import { useStore } from '../../lib/store';
import type { SoundCue } from '../../lib/contracts';
import type { GameView, LogEntry } from '../types';
import { armWebAudio, playWebSfx } from './webSfx';

const IS_WEB = Platform.OS === 'web';

const SFX = {
    tap: require('../../assets/sfx/tap.wav') as number,
    draw: require('../../assets/sfx/draw.wav') as number,
    card: require('../../assets/sfx/play.wav') as number,
    bank: require('../../assets/sfx/bank.wav') as number,
    turn: require('../../assets/sfx/turn.wav') as number,
    threat: require('../../assets/sfx/threat.wav') as number,
    win: require('../../assets/sfx/win.wav') as number,
};

// Armed at import, not on table mount, so a tap on home or the lobby already
// counts as the gesture that unlocks sound for the table.
if (IS_WEB) armWebAudio(Object.values(SFX));

function logSignature(entry: LogEntry): string {
    return `${entry.key}:${JSON.stringify(entry.args || {})}`;
}

export function cueForLog(key: string): SoundCue | undefined {
    if (key === 'log.game_started' || key === 'log.turn') return 'turn';
    if (key === 'log.banked' || key === 'log.banked_money') return 'bank';
    if (key === 'log.played_property' || key === 'log.moved_wildcard' || key === 'log.building' || key === 'log.discarded_excess') return 'card_play';
    if (key === 'log.pass_go') return 'card_draw';
    if (key === 'log.reshuffled') return 'shuffle';
    if (key === 'log.charge' || key === 'log.charge_everyone' || key === 'log.sly_deal' || key === 'log.forced_deal' || key === 'log.deal_breaker') return 'action';
    if (key === 'log.paid' || key === 'log.stole' || key === 'log.swapped' || key === 'log.took_set') return 'payment';
    if (key === 'log.just_say_no_cancelled' || key === 'log.just_say_no_back_on' || key === 'log.accepts_block') return 'action';
    if (key === 'log.nothing_to_pay' || key === 'log.timeout_respond' || key === 'log.timeout_turn') return 'error';
    if (key === 'log.win_classic' || key === 'log.win_deathmatch') return 'win';
    return undefined;
}

/** Native, local-only game effects. Radio and call audio deliberately stay out. */
export function useGameAudio(game: GameView | null) {
    const settings = useStore((state) => state.audio);
    const setAudio = useStore((state) => state.setAudio);

    // On web the players get no source: their <audio> elements are what iOS
    // Safari blocks (see webSfx.ts), so web plays through Web Audio instead.
    const src = (mod: number) => (IS_WEB ? null : mod);
    const tap = useAudioPlayer(src(SFX.tap));
    const draw = useAudioPlayer(src(SFX.draw));
    const card = useAudioPlayer(src(SFX.card));
    const bank = useAudioPlayer(src(SFX.bank));
    const turn = useAudioPlayer(src(SFX.turn));
    const threat = useAudioPlayer(src(SFX.threat));
    const win = useAudioPlayer(src(SFX.win));

    useEffect(() => {
        if (IS_WEB) return;
        [tap, draw, card, bank, turn, threat, win].forEach((player) => {
            player.volume = settings.sfxVolume;
        });
    }, [bank, card, draw, settings.sfxVolume, tap, threat, turn, win]);

    const play = useCallback((cue: SoundCue) => {
        if (!settings.sfxEnabled) return;
        const key: keyof typeof SFX = cue === 'tap'
            ? 'tap'
            : cue === 'card_draw' || cue === 'shuffle' || cue === 'spin'
              ? 'draw'
              : cue === 'card_play'
                ? 'card'
                : cue === 'bank' || cue === 'payment'
                  ? 'bank'
                  : cue === 'turn'
                    ? 'turn'
                    : cue === 'win'
                      ? 'win'
                      : 'threat';
        if (IS_WEB) {
            playWebSfx(SFX[key], settings.sfxVolume);
            return;
        }
        const player = { tap, draw, card, bank, turn, threat, win }[key];
        void player.seekTo(0).then(() => player.play()).catch(() => {});
    }, [bank, card, draw, settings.sfxEnabled, settings.sfxVolume, tap, threat, turn, win]);

    const previousGameId = useRef<string | null>(null);
    const previousLog = useRef<string[] | null>(null);
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
        let overlap = Math.min(old.length, entries.length);
        while (overlap > 0 && old.slice(old.length - overlap).join('\u0000') !== entries.slice(0, overlap).join('\u0000')) overlap -= 1;
        if (old.length > 0 && overlap === 0) return;
        entries.slice(overlap).forEach((signature) => {
            const cue = cueForLog(signature.slice(0, signature.indexOf(':')));
            if (cue) play(cue);
        });
    }, [game, play]);

    const previousPending = useRef<string | null>(null);
    useEffect(() => {
        const pending = game?.pending;
        if (!game || !pending) {
            previousPending.current = null;
            return;
        }
        const signature = `${game.id}:${pending.kind}:${pending.by_id}:${pending.card.id}`;
        if (previousPending.current === signature) return;
        const joiningMidAction = previousPending.current === null && game.log.length === 0;
        previousPending.current = signature;
        if (joiningMidAction) return;
        if (pending.by_id === game.you) play('strike');
        else if ((pending.targets ?? []).some((target) => target.player_id === game.you && !target.settled)) play('threat');
    }, [game, play]);

    return {
        play,
        sfxEnabled: settings.sfxEnabled,
        setSfxEnabled: (enabled: boolean) => setAudio({ sfxEnabled: enabled }),
    };
}
