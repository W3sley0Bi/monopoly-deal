import { avatarFor } from '../game/avatar';

interface Props {
    id: string;
    name: string;
    size?: number;
    /** Draws a gold ring, used for the player whose turn it is. */
    active?: boolean;
    away?: boolean;
    /** Marks this player as connected to the table's voice/video call. */
    inCall?: boolean;
    /** Spoken and hovered label for the call dot. */
    inCallLabel?: string;
    className?: string;
}

export default function Avatar({ id, name, size = 40, active, away, inCall, inCallLabel, className = '' }: Props) {
    // A background image rather than an <img>, so the long inline data URI stays
    // out of the accessibility tree and the markup.
    return (
        <span
            role="img"
            aria-label={inCall && inCallLabel ? `${name} · ${inCallLabel}` : name}
            title={inCall && inCallLabel ? `${name} · ${inCallLabel}` : name}
            style={{
                width: size,
                height: size,
                backgroundImage: `url("${avatarFor(id)}")`,
                backgroundSize: 'cover',
            }}
            className={[
                'relative block shrink-0 rounded-full bg-white/10 ring-2 transition',
                inCall ? 'avatar-in-call' : '',
                active ? 'ring-brass shadow-[0_0_16px_-2px_rgba(242,193,78,0.9)]' : 'ring-white/15',
                away ? 'opacity-40 grayscale' : '',
                className,
            ].join(' ')}
        />
    );
}
