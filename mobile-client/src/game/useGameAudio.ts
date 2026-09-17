import { useCallback, useEffect, useRef } from 'react';
import { useAudioPlayer } from 'expo-audio';

import { useStore } from '../../lib/store';
import type { SoundCue } from '../../lib/contracts';
import type { GameView, LogEntry } from '../types';

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

    const tap = useAudioPlayer(require('../../assets/sfx/tap.wav'));
    const draw = useAudioPlayer(require('../../assets/sfx/draw.wav'));
    const card = useAudioPlayer(require('../../assets/sfx/play.wav'));
    const bank = useAudioPlayer(require('../../assets/sfx/bank.wav'));
    const turn = useAudioPlayer(require('../../assets/sfx/turn.wav'));
    const threat = useAudioPlayer(require('../../assets/sfx/threat.wav'));
    const win = useAudioPlayer(require('../../assets/sfx/win.wav'));

    useEffect(() => {
        [tap, draw, card, bank, turn, threat, win].forEach((player) => {
            player.volume = settings.sfxVolume;
        });
    }, [bank, card, draw, settings.sfxVolume, tap, threat, turn, win]);

    const play = useCallback((cue: SoundCue) => {
        if (!settings.sfxEnabled) return;
        const player = cue === 'tap'
            ? tap
            : cue === 'card_draw' || cue === 'shuffle' || cue === 'spin'
              ? draw
              : cue === 'card_play'
                ? card
                : cue === 'bank' || cue === 'payment'
                  ? bank
                  : cue === 'turn'
                    ? turn
                    : cue === 'win'
                      ? win
                      : threat;
        void player.seekTo(0).then(() => player.play()).catch(() => {});
    }, [bank, card, draw, settings.sfxEnabled, tap, threat, turn, win]);

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
