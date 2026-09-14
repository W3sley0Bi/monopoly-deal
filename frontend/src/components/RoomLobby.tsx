import type { GameAudio } from '../game/useGameAudio';
import GameAudioControls from './GameAudioControls';
import RoomInvite from './RoomInvite';
import { useState } from 'react';
import type { ClientMessage, Difficulty, Mode, RoomView } from '../types';
import type { Call } from '../game/useWebRTC';
import { useI18n } from '../i18n';
import { formatTurn } from '../i18n/format';
import GameBrand, { Cityscape } from './GameBrand';
import Avatar from './Avatar';
import CallControls from './CallControls';
import ChatBox from './ChatBox';
import CallStage from './CallStage';

interface Props {
    audio: GameAudio;
    room: RoomView;
    error?: string;
    call: Call;
    send: (msg: ClientMessage) => void;
    onLeave: () => void;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export default function RoomLobby({ audio, room, error, call, send, onLeave }: Props) {
    const { t } = useI18n();
    const g = room.game;
    const [confirmKick, setConfirmKick] = useState<string>();
    const canStart = g.players.length >= 2;
    const bots = g.players.filter(p => p.bot).length;
    const owner = room.is_owner;
    const difficulties = room.difficulties ?? DIFFICULTIES;

    // Every option travels in the same message, so each setter has to resend
    // the two it is not changing.
    const setMode = (mode: Mode) => send({ type: 'set_options', mode, turn_seconds: g.turn_seconds });
    const setTimer = (seconds: number) => send({ type: 'set_options', mode: g.mode, turn_seconds: seconds });
    const setDifficulty = (level: Difficulty) => send({
        type: 'set_options',
        mode: g.mode,
        turn_seconds: g.turn_seconds,
        bot_difficulty: level,
    });

    return (
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
            <Cityscape /><div className="lobby-brand"><GameBrand compact /></div>
            <header className="panel flex flex-wrap items-center gap-3 px-4 py-3">
                <div>
                    <p className="label-caps">{t('lobby.table', { code: room.id })}</p>
                    <h1 className="font-display text-3xl tracking-wide text-brass">{room.name}</h1>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <RoomInvite room={room} />
                    <CallControls call={call} memberCount={room.call_members.length} />
                    <span className="rounded-full bg-black/30 px-3 py-1 text-xs">
                        {t('lobby.host')} <span className="font-semibold">{room.owner_name}</span>
                    </span>
                    <button type="button" className="btn btn-ghost !py-1.5 !text-sm" onClick={onLeave}>
                        {t('lobby.leave')}
                    </button>
                </div>
            </header>
            <CallStage call={call} room={room} />
            <GameAudioControls audio={audio} />

            {error && (
                <p className="animate-shake rounded-lg border border-rose-300/40 bg-rose-600/25 px-3 py-2 text-center text-sm font-semibold text-rose-100">
                    {error}
                </p>
            )}

            <section className="panel px-4 py-4">
                <p className="label-caps mb-2">
                    {t('lobby.players', { seated: g.players.length, total: g.players.length + room.seats_free })}
                </p>
                <ul className="flex flex-col gap-2">
                    {g.players.map((p, i) => (
                        <li key={p.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-brass font-bold text-ink">{i + 1}</span>
                            <Avatar id={p.id} name={p.name} size={36} away={!p.connected} />
                            <span className="font-semibold">{p.name}</span>
                            {room.call_members.includes(p.id) && <span title={t('call.people')}>◉</span>}
                            {p.bot && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-widest text-white/60">{t('lobby.robot_tag')}</span>}
                            {p.id === room.owner_id && <span title={t('lobby.host_title')}>👑</span>}
                            {p.id === room.you && <span className="text-xs text-brass">({t('common.you')})</span>}
                            {!p.connected && !p.bot && <span className="text-xs text-white/40">{t('lobby.away')}</span>}
                            {owner && p.id !== room.you && !p.bot && (
                                <button
                                    type="button"
                                    className={`btn ml-auto !py-1 !text-xs ${confirmKick === p.id ? 'btn-red' : 'btn-ghost'}`}
                                    onClick={() => {
                                        if (confirmKick === p.id) {
                                            send({ type: 'kick', target_player_id: p.id });
                                            setConfirmKick(undefined);
                                        } else {
                                            setConfirmKick(p.id);
                                        }
                                    }}
                                >
                                    {confirmKick === p.id ? t('lobby.confirm_remove') : t('lobby.remove')}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>

                {owner && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="label-caps">{t('lobby.robots')}</span>
                        <button
                            type="button"
                            className="btn btn-ghost !py-1 !text-sm"
                            disabled={room.seats_free === 0}
                            title={room.seats_free === 0 ? t('lobby.table_full_title') : t('lobby.add_bot_title')}
                            onClick={() => send({ type: 'add_bot' })}
                        >
                            {t('lobby.add_bot')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-ghost !py-1 !text-sm"
                            disabled={bots === 0}
                            onClick={() => send({ type: 'remove_bot' })}
                        >
                            {t('lobby.remove_bot')}
                        </button>
                        <span className="text-xs text-white/45">
                            {bots === 0
                                ? t('lobby.no_bots_hint')
                                : t('lobby.bots_at_table', { count: bots })}
                        </span>
                    </div>
                )}

                {/* The skill level is a table option like the mode and the timer,
                    so everyone sees it but only the host may move it. */}
                <div className="mt-3">
                    <p className="label-caps mb-2">{t('lobby.difficulty')}</p>
                    <div className="flex flex-wrap gap-2">
                        {difficulties.map(level => (
                            <button
                                key={level}
                                type="button"
                                disabled={!owner}
                                title={t(`difficulty.${level}.blurb`)}
                                onClick={() => setDifficulty(level)}
                                className={`btn !py-1.5 !text-sm ${g.bot_difficulty === level ? 'btn-gold' : 'btn-ghost'} ${owner ? '' : 'cursor-not-allowed'}`}
                            >
                                {t(`difficulty.${level}`)}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-white/45">{t(`difficulty.${g.bot_difficulty}.blurb`)}</p>
                </div>

                {!room.you_seated && (
                    <button
                        type="button"
                        className="btn btn-green mt-3 w-full !py-2"
                        disabled={room.seats_free === 0}
                        onClick={() => send({ type: 'take_seat' })}
                    >
                        {room.seats_free === 0 ? t('lobby.table_full') : t('lobby.take_seat')}
                    </button>
                )}
            </section>

            <section className="panel px-4 py-4">
                <div className="mb-2 flex items-center gap-2">
                    <p className="label-caps">{t('lobby.game_mode')}</p>
                    {!owner && <span className="text-xs text-white/40">{t('lobby.host_only')}</span>}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                    {room.modes.map(m => {
                        const selected = g.mode === m.id;
                        return (
                            <button
                                key={m.id}
                                type="button"
                                disabled={!owner || !m.available}
                                onClick={() => setMode(m.id)}
                                className={[
                                    'rounded-xl border p-3 text-left transition',
                                    selected ? 'border-brass bg-brass/15' : 'border-white/10 bg-black/20',
                                    owner && m.available ? 'hover:border-white/30' : 'cursor-not-allowed opacity-60',
                                ].join(' ')}
                            >
                                <span className="flex items-center gap-1.5 font-display text-lg tracking-wide">
                                    {t(`mode.${m.id}`)}
                                    {!m.available && <span className="text-[0.6rem] uppercase tracking-widest text-white/50">{t('lobby.mode_soon')}</span>}
                                </span>
                                <span className="mt-0.5 block text-xs text-white/55">{t(`mode.${m.id}.blurb`)}</span>
                            </button>
                        );
                    })}
                </div>

                <p className="label-caps mb-2 mt-4">{t('lobby.turn_timer')}</p>
                <div className="flex flex-wrap gap-2">
                    {room.turn_options.map(s => (
                        <button
                            key={s}
                            type="button"
                            disabled={!owner}
                            onClick={() => setTimer(s)}
                            className={`btn !py-1.5 !text-sm ${g.turn_seconds === s ? 'btn-gold' : 'btn-ghost'} ${owner ? '' : 'cursor-not-allowed'}`}
                        >
                            {formatTurn(t, s)}
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-xs text-white/45">
                    {t('lobby.turn_hint')}
                </p>
            </section>

            {(room.spectators.length > 0 || room.requests.length > 0) && (
                <section className="panel px-4 py-4">
                    {room.spectators.length > 0 && (
                        <>
                            <p className="label-caps mb-2">{t('lobby.watching', { n: room.spectators.length })}</p>
                            <div className="flex flex-wrap gap-2">
                                {room.spectators.map(s => (
                                    <span key={s.id} className="flex items-center gap-2 rounded-full bg-black/30 px-2 py-1 text-sm">
                                        <Avatar id={s.id} name={s.name} size={24} />
                                        {s.name}
                                        {owner && (
                                            <button
                                                type="button"
                                                className="text-xs text-white/40 hover:text-rose-300"
                                                title={t('lobby.remove_from_table')}
                                                onClick={() => send({ type: 'kick', target_player_id: s.id })}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                    {room.requests.length > 0 && (
                        <>
                            <p className="label-caps mb-2 mt-3">{t('lobby.waiting_seat')}</p>
                            <div className="flex flex-wrap gap-2">
                                {room.requests.map(s => (
                                    <span key={s.id} className="flex items-center gap-2 rounded-full bg-brass/15 px-2 py-1 text-sm">
                                        <Avatar id={s.id} name={s.name} size={24} />
                                        {s.name}
                                    </span>
                                ))}
                            </div>
                        </>
                    )}
                </section>
            )}

            {owner ? (
                <button
                    type="button"
                    className="btn btn-green w-full !py-3 !text-xl"
                    disabled={!canStart}
                    onClick={() => send({ type: 'start_game' })}
                >
                    {canStart ? t('lobby.deal', { mode: t(`mode.${g.mode}`) }) : t('lobby.need_player')}
                </button>
            ) : (
                <p className="panel px-4 py-3 text-center text-sm text-white/60">
                    {t('lobby.waiting_host.before')} <span className="font-semibold text-white">{room.owner_name}</span> {t('lobby.waiting_host.after')}
                </p>
            )}

            <section className="panel flex h-72 flex-col overflow-hidden">
                <p className="label-caps border-b border-white/10 bg-black/25 px-4 py-2">{t('lobby.chat')}</p>
                <ChatBox
                    chat={room.chat}
                    you={room.you}
                    onSend={text => send({ type: 'chat', text })}
                    className="flex-1"
                />
            </section>

            <p className="text-center text-xs text-white/40">
                {t('lobby.share_code.before')} <span className="font-display text-base tracking-[0.2em] text-brass">{room.id}</span> {t('lobby.share_code.after')}
            </p>
        </div>
    );
}
