import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { GameView } from '../types';
import type { GameAudio } from '../game/useGameAudio';
import { useI18n } from '../i18n';
import { useDialogFocus } from '../game/useDialogFocus';
import Avatar from './Avatar';

const COLORS = ['#ffe256', '#76d8ed', '#fc7785', '#aab1ff', '#7be3b0'];
const INTRO_MS = 4500;

function WheelReveal({ game, skewMs, audio }: { game: GameView; skewMs: number; audio?: GameAudio }) {
    const { t } = useI18n();
    const focus = useDialogFocus();
    const titleId = useId();
    const [now, setNow] = useState(() => Date.now() + skewMs);
    const [elapsed] = useState(() => Math.max(0, Date.now() + skewMs - ((game.starts_at_ms ?? 0) - INTRO_MS)));
    useEffect(() => {
        const timer = window.setInterval(() => {
            const current = Date.now() + skewMs;
            setNow(current);
            if (current >= (game.starts_at_ms ?? 0)) clearInterval(timer);
        }, 80);
        return () => clearInterval(timer);
    }, [skewMs, game.starts_at_ms]);
    // The wheel is already turning when a late joiner arrives, and starting the
    // sound halfway through would be a tick track with no wheel behind it.
    const spun = useRef(false);
    useEffect(() => {
        if (spun.current || !audio || elapsed > 400) return;
        spun.current = true;
        audio.play('spin');
    }, [audio, elapsed]);

    const winner = game.players.find(p => p.id === game.start_sequence?.[0]) ?? game.players[0];
    const sectors = [...game.players].sort((a, b) => a.id.localeCompare(b.id));
    const angle = 360 / sectors.length;
    const winnerIndex = sectors.findIndex(p => p.id === winner?.id);
    const landed = now >= (game.starts_at_ms ?? 0) - 1000;
    if (now >= (game.starts_at_ms ?? 0) || !winner) return null;
    return createPortal(<div className="start-wheel-overlay"><div className="start-wheel-panel" ref={focus} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="start-wheel-copy"><p className="label-caps">{t('wheel.eyebrow')}</p><h2 id={titleId}>{t('wheel.title')}</h2><p>{t('wheel.fair')}</p></div>
        <div className="start-wheel-frame" aria-hidden="true"><div className="start-wheel-pointer" /><div className="start-wheel-disc" style={{
            background: `conic-gradient(${sectors.map((_, i) => `${COLORS[i % COLORS.length]} ${i * angle}deg ${(i + 1) * angle}deg`).join(',')})`,
            '--wheel-end': `${1800 - (winnerIndex + .5) * angle}deg`, '--wheel-elapsed': `-${elapsed}ms`,
        } as CSSProperties}>{sectors.map((player, i) => <div className="start-wheel-sector" key={player.id} style={{ transform: `rotate(${(i + .5) * angle}deg)` }}><span><Avatar id={player.id} name={player.name} size={38} /><b>{player.name}</b></span></div>)}</div><div className="start-wheel-hub">DEAL<span>●</span></div></div>
        <div className="start-wheel-result" role="status" aria-live="polite">{landed ? <><Avatar id={winner.id} name={winner.name} size={42} /><strong>{t('wheel.winner', { name: winner.name })}</strong></> : <span>{t('wheel.spinning')}</span>}</div>
        <div className={`start-wheel-order ${landed ? 'revealed' : ''}`}><p className="label-caps">{t('wheel.order')}</p><ol>{game.players.map((p, i) => <li key={p.id}><span>{i + 1}</span>{p.name}</li>)}</ol></div>
    </div></div>, document.body);
}
export default function StartWheel({ game, skewMs, audio }: { game: GameView; skewMs: number; audio?: GameAudio }) {
    if (!game.starts_at_ms || game.state !== 'playing') return null;
    return <WheelReveal key={game.start_id || game.starts_at_ms} game={game} skewMs={skewMs} audio={audio} />;
}
