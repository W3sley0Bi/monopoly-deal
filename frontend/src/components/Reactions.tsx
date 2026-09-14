import { useEffect, useState } from 'react';
import type { ChatMessage } from '../types';
import { useI18n } from '../i18n';

import { REACTIONS } from '../game/reactions';

export function ReactionBubble({ message }: { message: ChatMessage }) {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(false), 5000);
        return () => clearTimeout(timer);
    }, []);
    if (!visible) return null;
    return (
        <span className="seat-reaction" role="status">
            {message.text}
        </span>
    );
}

/**
 * What a player just did, spoken from their seat.
 *
 * The log column says the same thing, but off to one side; at a real table you
 * learn a move from the person who made it.
 */
export function PlayBubble({ text }: { text: string }) {
    return (
        <span className="seat-play" role="status">
            {text}
        </span>
    );
}

export default function Reactions({
    onSend,
}: {
    onSend: (text: string) => void;
}) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    return (
        <div className="reaction-control">
            <button
                type="button"
                className="btn btn-ghost"
                aria-label={t('table.reactions')}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                ☺
            </button>
            {open && (
                <div
                    className="reaction-picker"
                    aria-label={t('table.reactions')}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setOpen(false);
                    }}
                >
                    {REACTIONS.map((emoji, i) => (
                        <button
                            key={emoji}
                            type="button"
                            aria-label={t(`table.reaction_${i}`)}
                            onClick={() => {
                                onSend(emoji);
                                setOpen(false);
                            }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
