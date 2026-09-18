/** Reactions use the existing room chat transport and history. */
export const REACTIONS = ['👏', '😈', '😂', '🤯'] as const;
export type Reaction = typeof REACTIONS[number];

/** True when a chat text is a bare reaction emoji rather than free-form speech. */
export function isReaction(text: string | undefined): text is Reaction {
    return !!text && (REACTIONS as readonly string[]).includes(text);
}
