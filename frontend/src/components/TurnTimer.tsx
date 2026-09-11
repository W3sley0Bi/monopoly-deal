import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

interface Props {
    /** Unix ms deadline from the server; 0 disables the timer. */
    deadlineMs: number;
    /** Total seconds in the window, for the ring proportion. */
    totalSeconds: number;
    /** Server clock minus browser clock, in ms. */
    skewMs: number;
    kind?: 'turn' | 'respond';
    size?: number;
}

/** A countdown ring. Turns amber then red as time runs out. */
export default function TurnTimer({ deadlineMs, totalSeconds, skewMs, kind = 'turn', size = 44 }: Props) {
    const { t } = useI18n();
    const [remaining, setRemaining] = useState(0);
    const frame = useRef<number>(0);

    useEffect(() => {
        if (!deadlineMs) {
            setRemaining(0);
            return;
        }
        const tick = () => {
            const left = Math.max(0, deadlineMs - (Date.now() + skewMs));
            setRemaining(left);
            frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame.current);
    }, [deadlineMs, skewMs]);

    if (!deadlineMs || !totalSeconds) return null;

    const seconds = Math.ceil(remaining / 1000);
    const frac = Math.max(0, Math.min(1, remaining / (totalSeconds * 1000)));
    const r = size / 2 - 4;
    const circumference = 2 * Math.PI * r;
    const colour = frac > 0.5 ? '#4ade80' : frac > 0.2 ? '#f2c14e' : '#fb7185';

    return (
        <div
            className={`relative grid shrink-0 place-items-center ${seconds <= 5 ? 'animate-pulse' : ''}`}
            style={{ width: size, height: size }}
            title={t(kind === 'respond' ? 'timer.respond' : 'timer.turn')}
        >
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={colour}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - frac)}
                />
            </svg>
            <span className="absolute font-display text-sm leading-none" style={{ color: colour }}>
                {seconds}
            </span>
        </div>
    );
}
