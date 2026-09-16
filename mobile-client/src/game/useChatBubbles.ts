import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

/** How long a message stays in the air above the seat that sent it. */
const HOLD_MS = 5200;

export interface ChatBubble {
    /** Changes on every message, so repeating yourself still animates. */
    id: number;
    text: string;
}

/**
 * The last thing each player *said*, keyed by player id.
 *
 * Deliberately not the log: a bubble over someone's head is speech, and filling
 * it with "Otto banked $3M" makes the table look like it is narrating itself.
 * What a player did is already on the felt and in the log; what they typed has
 * nowhere else to appear.
 *
 * System lines are skipped for the same reason — nobody said them.
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

        const spoken = chat.filter(m => !m.system && !!m.text);
        const newest = spoken.length ? spoken[spoken.length - 1].id : null;
        const last = seen.current;
        seen.current = newest;
        // The first snapshot is a baseline: joining a table in progress must not
        // replay the whole conversation at once.
        if (last === null || newest === null || newest === last) return;

        const from = spoken.findIndex(m => m.id === last);
        const fresh = from < 0 ? spoken.slice(-1) : spoken.slice(from + 1);

        const next: Record<string, ChatBubble> = {};
        for (const message of fresh) {
            counter.current += 1;
            next[message.player_id] = { id: counter.current, text: message.text ?? '' };
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
