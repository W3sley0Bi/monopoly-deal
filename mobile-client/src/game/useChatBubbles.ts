import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { isReaction } from './reactions';

/** How long a reaction stays in the air above the seat that sent it. */
const HOLD_MS = 5200;

export interface ChatBubble {
    /** Changes on every message, so repeating yourself still animates. */
    id: number;
    emoji: string;
}

/**
 * The last reaction each player sent, keyed by player id.
 *
 * Only bare reaction emojis surface here — free-form text chat lines (which
 * may still arrive from the web frontend) are silently ignored, because the
 * mobile client no longer has a chat panel to show them in.
 */
export function useChatBubbles(chat: ChatMessage[], roomId?: string): Record<string, ChatBubble> {
    const [bubbles, setBubbles] = useState<Record<string, ChatBubble>>({});
    const seen = useRef<string | null>(null);
    const counter = useRef(0);
    const previousRoom = useRef(roomId);

    useEffect(() => {
        if (previousRoom.current !== roomId) {
            previousRoom.current = roomId;
            seen.current = null;
            setBubbles({});
        }

        const reactions = chat.filter(m => !m.system && isReaction(m.text));
        const newest = reactions.length ? reactions[reactions.length - 1].id : null;
        const last = seen.current;
        seen.current = newest;
        // The first snapshot is a baseline: joining a table in progress must not
        // replay the whole conversation at once.
        if (last === null || newest === null || newest === last) return;

        const from = reactions.findIndex(m => m.id === last);
        const fresh = from < 0 ? reactions.slice(-1) : reactions.slice(from + 1);

        const next: Record<string, ChatBubble> = {};
        for (const message of fresh) {
            counter.current += 1;
            next[message.player_id] = { id: counter.current, emoji: message.text! };
        }
        if (Object.keys(next).length === 0) return;
        setBubbles(current => ({ ...current, ...next }));
    }, [chat, roomId]);

    // One sweep clears whatever has been up long enough, rather than a timer
    // per bubble racing to remove entries from the same object.
    useEffect(() => {
        if (Object.keys(bubbles).length === 0) return;
        const newest = Math.max(...Object.values(bubbles).map(b => b.id));
        const timer = setTimeout(() => {
            setBubbles(current => {
                const kept: Record<string, ChatBubble> = {};
                for (const [id, bubble] of Object.entries(current)) {
                    if (bubble.id > newest) kept[id] = bubble;
                }
                return kept;
            });
        }, HOLD_MS);
        return () => clearTimeout(timer);
    }, [bubbles]);

    return bubbles;
}
