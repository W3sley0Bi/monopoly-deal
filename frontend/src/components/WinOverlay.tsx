import type { GameView } from '../types';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';

const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i % 12) * 0.22,
    duration: 2.6 + ((i * 7) % 18) / 10,
    hue: (i * 47) % 360,
    size: 6 + (i % 4) * 3,
}));

interface Props {
    view: GameView;
    isOwner: boolean;
    ownerName: string;
    onNewGame: () => void;
    onLeave: () => void;
}

export default function WinOverlay({ view, isOwner, ownerName, onNewGame, onLeave }: Props) {
    const { t } = useI18n();
    const winner = view.players.find(p => p.id === view.winner_id);
    const isMe = view.winner_id === view.you;
    // The host's name is emphasised inside the sentence, so interpolate a
    // marker and split on it rather than cutting the sentence into two keys.
    const waiting = t('win.waiting', { name: '\u0000' }).split('\u0000');

    return (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-black/80 backdrop-blur-sm">
            <div aria-hidden className="pointer-events-none absolute inset-0">
                {CONFETTI.map((c, i) => (
                    <span
                        key={i}
                        className="absolute top-0 block rounded-sm"
                        style={{
                            left: `${c.left}%`,
                            width: c.size,
                            height: c.size * 1.6,
                            background: `hsl(${c.hue} 90% 60%)`,
                            animation: `confetti-fall ${c.duration}s linear ${c.delay}s infinite`,
                        }}
                    />
                ))}
            </div>

            <div className="panel animate-pop relative z-10 max-w-md px-10 py-8 text-center">
                <p className="animate-float text-6xl">🏆</p>
                <h2 className="mt-2 font-display text-5xl tracking-wider text-brass">
                    {isMe ? t('win.you') : t('win.player', { name: winner?.name ?? t('win.someone') })}
                </h2>
                <p className="mt-2 text-white/70">{t('win.blurb')}</p>
                <div className="mt-5 flex flex-col gap-1.5 text-sm">
                    {[...view.players]
                        .sort((a, b) => b.complete_sets - a.complete_sets || b.asset_total - a.asset_total)
                        .map(p => (
                            <div key={p.id} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-1.5">
                                <span className={p.id === view.winner_id ? 'font-bold text-brass' : ''}>{p.name}</span>
                                <span className="text-white/60">
                                    {t('win.score', { sets: p.complete_sets, amount: money(t, p.asset_total) })}
                                </span>
                            </div>
                        ))}
                </div>
                <div className="mt-6 flex flex-col gap-2">
                    {isOwner ? (
                        <button type="button" className="btn btn-gold w-full !py-2.5 !text-lg" onClick={onNewGame}>
                            {t('win.play_again')}
                        </button>
                    ) : (
                        <p className="rounded-lg bg-black/30 px-3 py-2 text-sm text-white/65">
                            {waiting[0]}<span className="font-semibold text-white">{ownerName}</span>{waiting[1]}
                        </p>
                    )}
                    <button type="button" className="btn btn-ghost w-full !py-2" onClick={onLeave}>
                        {t('win.leave')}
                    </button>
                </div>
            </div>
        </div>
    );
}
