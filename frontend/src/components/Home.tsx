import { useState } from 'react';
import type { ClientMessage, Difficulty, HomeView, Mode } from '../types';
import { useI18n } from '../i18n';
import { formatTurn } from '../i18n/format';
import Avatar from './Avatar';
import LanguagePicker from './LanguagePicker';
import { markTutorialSeen, tutorialSeen } from './Tutorial';

interface Props {
    view: HomeView | null;
    connected: boolean;
    name: string;
    playerId: string;
    error?: string;
    onSetName: (name: string) => void;
    send: (msg: ClientMessage) => void;
}

// The server's own state names, mapped to the keys that describe them.
const STATE_KEY: Record<string, string> = {
    waiting: 'home.state.waiting',
    playing: 'home.state.playing',
    finished: 'home.state.finished',
};

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export default function Home({ view, connected, name, playerId, error, onSetName, send }: Props) {
    const { t } = useI18n();
    const [draftName, setDraftName] = useState(name);
    const [creating, setCreating] = useState(false);
    const [tableName, setTableName] = useState('');
    const [mode, setMode] = useState<Mode>('classic');
    const [turnSeconds, setTurnSeconds] = useState(0);
    const [code, setCode] = useState('');
    const [bots, setBots] = useState(2);
    // The creation form starts with a table of people, so no robots by default.
    const [createBots, setCreateBots] = useState(0);
    const [difficulty, setDifficulty] = useState<Difficulty>('normal');
    const [withTour, setWithTour] = useState(() => !tutorialSeen());
    // Closing a table is destructive, so the button asks once before it fires.
    const [closing, setClosing] = useState<string | null>(null);

    const rooms = view?.rooms ?? [];
    const modes = view?.modes ?? [];
    const turnOptions = view?.turn_options ?? [0, 30, 60, 120];
    const difficulties = view?.difficulties ?? DIFFICULTIES;

    // Step one: everyone needs a name and a face before they can do anything.
    if (!name) {
        return (
            <div className="grid min-h-full place-items-center p-6">
                <div className="panel w-full max-w-md overflow-hidden">
                    <Header />
                    <div className="flex flex-col gap-4 px-7 py-6">
                        {/* The language has to be reachable before there is a
                            name, or a reader who cannot read the form is stuck. */}
                        <div className="flex justify-center">
                            <LanguagePicker />
                        </div>
                        {!connected && <Connecting />}
                        {error && <ErrorLine text={error} />}
                        <div className="flex items-center gap-3">
                            <Avatar id={playerId} name={draftName || t('common.you')} size={56} />
                            <label className="flex flex-1 flex-col gap-1">
                                <span className="label-caps">{t('home.your_name')}</span>
                                <input
                                    id="player-name"
                                    name="player-name"
                                    autoComplete="nickname"
                                    autoFocus
                                    value={draftName}
                                    maxLength={16}
                                    placeholder={t('home.name_placeholder')}
                                    onChange={e => setDraftName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && draftName.trim() && onSetName(draftName.trim())}
                                    className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-lg outline-none focus:border-brass"
                                />
                            </label>
                        </div>
                        <p className="text-xs text-white/45">
                            {t('home.avatar_note')}
                        </p>
                        <button
                            type="button"
                            className="btn btn-gold w-full !py-2.5 !text-lg"
                            disabled={!connected || !draftName.trim()}
                            onClick={() => onSetName(draftName.trim())}
                        >
                            {connected ? t('home.continue') : t('home.waiting_server')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 p-4 sm:p-6">
            <header className="panel flex flex-wrap items-center gap-3 px-4 py-3">
                <h1 className="font-display text-3xl tracking-wider text-brass">{t('home.title')}</h1>
                <LanguagePicker />
                <span className="ml-auto flex items-center gap-2 rounded-full bg-black/30 px-2 py-1">
                    <Avatar id={playerId} name={name} size={28} />
                    <span className="text-sm font-semibold">{name}</span>
                    <button
                        type="button"
                        className="btn btn-ghost !px-2 !py-0.5 !text-xs"
                        onClick={() => onSetName('')}
                    >
                        {t('home.change_name')}
                    </button>
                </span>
                {!connected && <span className="text-xs text-amber-300">{t('home.reconnecting')}</span>}
            </header>

            {error && <ErrorLine text={error} />}

            {/* Solo practice: a table of robots, dealt straight away, with the
                guided tour on top of it. */}
            <section className="panel flex flex-wrap items-center gap-4 px-4 py-4">
                <div className="min-w-56 flex-1">
                    <h2 className="font-display text-2xl tracking-wide text-brass">{t('home.solo.title')}</h2>
                    <p className="text-sm text-white/60">
                        {t('home.solo.blurb')}
                        {withTour && ` ${t('home.solo.tour')}`}
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="label-caps">{t('home.solo.robots')}</span>
                        {[1, 2, 3, 4].map(n => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setBots(n)}
                                className={`btn !px-3 !py-1 !text-sm ${bots === n ? 'btn-gold' : 'btn-ghost'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    {/* The same skill picker as the creation form, so a solo
                        table can be as gentle or as brutal as the full game. */}
                    <DifficultyPicker
                        levels={difficulties}
                        value={difficulty}
                        onPick={setDifficulty}
                        blurbs={false}
                    />
                    <label className="flex items-center gap-2 text-xs text-white/60">
                        <input
                            type="checkbox"
                            checked={withTour}
                            onChange={e => setWithTour(e.target.checked)}
                            className="accent-[color:var(--color-brass)]"
                        />
                        {t('home.solo.show_tutorial')}
                    </label>
                </div>

                <button
                    type="button"
                    className="btn btn-green !py-2.5 !text-lg"
                    disabled={!connected}
                    onClick={() => {
                        markTutorialSeen(!withTour);
                        send({
                            type: 'create_room',
                            room_name: t('home.solo.table_name', { name }),
                            mode: 'classic',
                            turn_seconds: 0,
                            bots,
                            bot_difficulty: difficulty,
                            auto_start: true,
                        });
                    }}
                >
                    {t('home.solo.play')}
                </button>
            </section>

            <section className="panel px-4 py-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl tracking-wide">{t('home.tables')}</h2>
                    <span className="label-caps">{t('home.open', { count: rooms.length })}</span>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <input
                            id="table-code"
                            name="table-code"
                            aria-label={t('home.code_label')}
                            value={code}
                            maxLength={4}
                            placeholder={t('home.code_placeholder')}
                            onChange={e => setCode(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === 'Enter' && code.trim() && send({ type: 'join_room', room_id: code.trim() })}
                            className="w-24 rounded-lg border border-white/15 bg-black/35 px-3 py-1.5 text-center font-display tracking-[0.3em] outline-none focus:border-brass"
                        />
                        <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={code.trim().length < 4}
                            onClick={() => send({ type: 'join_room', room_id: code.trim() })}
                        >
                            {t('home.join_by_code')}
                        </button>
                        <button type="button" className="btn btn-gold" onClick={() => setCreating(v => !v)}>
                            {creating ? t('common.cancel') : t('home.new_table')}
                        </button>
                    </div>
                </div>

                {creating && (
                    <div className="animate-slide-up mb-4 rounded-xl border border-white/10 bg-black/25 p-4">
                        <div className="flex flex-col gap-4">
                            <label className="flex flex-col gap-1">
                                <span className="label-caps">{t('home.table_name')}</span>
                                <input
                                    id="table-name"
                                    name="table-name"
                                    autoFocus
                                    value={tableName}
                                    maxLength={28}
                                    placeholder={t('home.table_name_placeholder', { name })}
                                    onChange={e => setTableName(e.target.value)}
                                    className="rounded-lg border border-white/15 bg-black/35 px-3 py-2 outline-none focus:border-brass"
                                />
                            </label>

                            <div>
                                <p className="label-caps mb-2">{t('home.game_mode')}</p>
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {modes.map(m => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            disabled={!m.available}
                                            onClick={() => setMode(m.id)}
                                            className={[
                                                'rounded-xl border p-3 text-left transition',
                                                mode === m.id && m.available
                                                    ? 'border-brass bg-brass/15'
                                                    : 'border-white/10 bg-black/20 hover:border-white/25',
                                                m.available ? '' : 'cursor-not-allowed opacity-50',
                                            ].join(' ')}
                                        >
                                            <span className="flex items-center gap-1.5 font-display text-lg tracking-wide">
                                                {t(`mode.${m.id}`)}
                                                {!m.available && <span className="text-[0.6rem] uppercase tracking-widest text-white/50">{t('home.mode_soon')}</span>}
                                            </span>
                                            <span className="mt-0.5 block text-xs text-white/55">{t(`mode.${m.id}.blurb`)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="label-caps mb-2">{t('home.turn_timer')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {turnOptions.map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setTurnSeconds(s)}
                                            className={`btn !py-1.5 !text-sm ${turnSeconds === s ? 'btn-gold' : 'btn-ghost'}`}
                                        >
                                            {formatTurn(t, s)}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-white/45">
                                    {t('home.turn_hint')}
                                </p>
                            </div>

                            {/* Robots fill the seats nobody takes, so a table can
                                start without waiting for a full set of people. */}
                            <div>
                                <p className="label-caps mb-2">{t('home.bots')}</p>
                                <div className="flex flex-wrap gap-2">
                                    {[0, 1, 2, 3, 4].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setCreateBots(n)}
                                            className={`btn !px-3 !py-1.5 !text-sm ${createBots === n ? 'btn-gold' : 'btn-ghost'}`}
                                        >
                                            {n === 0 ? t('home.bots_none') : n}
                                        </button>
                                    ))}
                                </div>
                                {/* The skill level only means something once at
                                    least one seat is played by the server. */}
                                {createBots > 0 && (
                                    <div className="mt-3">
                                        <DifficultyPicker
                                            levels={difficulties}
                                            value={difficulty}
                                            onPick={setDifficulty}
                                            blurbs
                                        />
                                    </div>
                                )}
                            </div>

                            <button
                                type="button"
                                className="btn btn-green !py-2.5 !text-lg"
                                onClick={() => {
                                    send({
                                        type: 'create_room',
                                        room_name: tableName.trim(),
                                        mode,
                                        turn_seconds: turnSeconds,
                                        bots: createBots,
                                        bot_difficulty: difficulty,
                                    });
                                    setCreating(false);
                                    setTableName('');
                                }}
                            >
                                {t('home.open_table')}
                            </button>
                        </div>
                    </div>
                )}

                {rooms.length === 0 ? (
                    <p className="py-10 text-center text-sm italic text-white/40">
                        {t('home.no_tables')}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {rooms.map(r => {
                            const canSit = r.state === 'waiting' && r.seats_free > 0;
                            return (
                                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
                                    <span className="grid h-11 w-14 shrink-0 place-items-center rounded-lg bg-brass/20 font-display text-xl tracking-[0.15em] text-brass">
                                        {r.id}
                                    </span>

                                    <div className="min-w-40 flex-1">
                                        <p className="flex items-center gap-2 font-semibold">
                                            {r.name}
                                            {r.you_seated && <span className="text-xs text-brass">{t('home.youre_in')}</span>}
                                        </p>
                                        <p className="text-xs text-white/50">
                                            {t(`mode.${r.mode}`)} · {formatTurn(t, r.turn_seconds)} · {t(STATE_KEY[r.state] ?? r.state)}
                                            {r.bot_count > 0 && ` · ${t('home.robots_at_table', { count: r.bot_count })}`}
                                            {r.spectator_count > 0 && ` · ${t('home.watching', { count: r.spectator_count })}`}
                                            {r.abandoned && ` · ${t('home.abandoned')}`}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {r.players.map(p => (
                                            <Avatar key={p.id} id={p.id} name={p.name} size={28} />
                                        ))}
                                        <span className="ml-1 text-xs text-white/45">
                                            {r.players.length}/{(view?.max_players ?? 5)}
                                        </span>
                                    </div>

                                    <div className="flex gap-2">
                                        {r.you_may_close && (closing === r.id ? (
                                            <>
                                                <button
                                                    type="button"
                                                    className="btn !bg-rose-600/80 !py-1.5 !text-sm hover:!bg-rose-500"
                                                    onClick={() => {
                                                        send({ type: 'close_room', room_id: r.id });
                                                        setClosing(null);
                                                    }}
                                                >
                                                    {t('home.close_it')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost !py-1.5 !text-sm"
                                                    onClick={() => setClosing(null)}
                                                >
                                                    {t('home.keep')}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn btn-ghost !py-1.5 !text-sm hover:!text-rose-200"
                                                title={r.abandoned
                                                    ? t('home.close_abandoned_title')
                                                    : t('home.close_title')}
                                                onClick={() => setClosing(r.id)}
                                            >
                                                {t('home.close')}
                                            </button>
                                        ))}
                                        {r.you_seated || r.you_spectating ? (
                                            <button type="button" className="btn btn-gold !py-1.5 !text-sm"
                                                onClick={() => send({ type: 'join_room', room_id: r.id })}>
                                                {t('home.return')}
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="btn btn-green !py-1.5 !text-sm"
                                                    disabled={!canSit}
                                                    title={canSit ? t('home.take_seat') : t('home.no_seat_title')}
                                                    onClick={() => send({ type: 'join_room', room_id: r.id })}
                                                >
                                                    {t('home.take_seat')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost !py-1.5 !text-sm"
                                                    onClick={() => send({ type: 'join_room', room_id: r.id, as_spectator: true })}
                                                >
                                                    {t('home.watch')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <p className="text-center text-xs text-white/40">
                {t('home.footer')}
            </p>
        </div>
    );
}

/**
 * The robot skill level. The blurbs explain what each level actually does at
 * the table, so they are worth the space in the creation form; the solo panel
 * is a tight row of controls and shows the names only.
 */
function DifficultyPicker({ levels, value, onPick, blurbs }: {
    levels: Difficulty[];
    value: Difficulty;
    onPick: (level: Difficulty) => void;
    blurbs: boolean;
}) {
    const { t } = useI18n();
    return (
        <div>
            <p className="label-caps mb-2">{t('home.difficulty')}</p>
            <div className={blurbs ? 'grid gap-2 sm:grid-cols-3' : 'flex flex-wrap gap-2'}>
                {levels.map(level => (
                    <button
                        key={level}
                        type="button"
                        onClick={() => onPick(level)}
                        className={blurbs
                            ? [
                                'rounded-xl border p-3 text-left transition',
                                value === level
                                    ? 'border-brass bg-brass/15'
                                    : 'border-white/10 bg-black/20 hover:border-white/25',
                            ].join(' ')
                            : `btn !px-3 !py-1 !text-sm ${value === level ? 'btn-gold' : 'btn-ghost'}`}
                    >
                        {blurbs ? (
                            <>
                                <span className="block font-display text-lg tracking-wide">{t(`difficulty.${level}`)}</span>
                                <span className="mt-0.5 block text-xs text-white/55">{t(`difficulty.${level}.blurb`)}</span>
                            </>
                        ) : t(`difficulty.${level}`)}
                    </button>
                ))}
            </div>
        </div>
    );
}

function Header() {
    const { t } = useI18n();
    return (
        <div className="relative border-b border-white/10 bg-black/25 px-7 py-8 text-center">
            <div className="pointer-events-none absolute inset-0 opacity-25"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgb(242 193 78 / 0.25) 0 10px, transparent 10px 20px)' }} />
            <p className="label-caps">{t('home.kicker')}</p>
            <h1 className="font-display text-5xl tracking-wider text-brass drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
                {t('home.title')}
            </h1>
            <p className="mt-1 text-sm text-white/60">{t('home.tagline')}</p>
        </div>
    );
}

function Connecting() {
    const { t } = useI18n();
    return (
        <p className="animate-pulse rounded-lg bg-amber-500/15 px-3 py-2 text-center text-sm text-amber-200">
            {t('home.connecting')}
        </p>
    );
}

function ErrorLine({ text }: { text: string }) {
    return (
        <p className="animate-shake rounded-lg border border-rose-300/40 bg-rose-600/25 px-3 py-2 text-center text-sm font-semibold text-rose-100">
            {text}
        </p>
    );
}
