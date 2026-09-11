import type { ReactNode } from 'react';
import { useState } from 'react';

interface Props {
    /** Whether the current drag can be dropped here. */
    active: boolean;
    onDrop: () => void;
    children: ReactNode;
    className?: string;
    /** Shown centred while a compatible card is being dragged. */
    hint?: string;
    /** `data-tour` anchor name, so the tutorial can spotlight this zone. */
    tour?: string;
}

/**
 * A mat area that accepts a dragged card. Inactive zones ignore drops entirely,
 * so an illegal card cannot be dropped by accident.
 */
export default function DropZone({ active, onDrop, children, className = '', hint, tour }: Props) {
    const [over, setOver] = useState(false);

    return (
        <div
            data-tour={tour}
            onDragOver={e => {
                if (!active) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!over) setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
                if (!active) return;
                e.preventDefault();
                setOver(false);
                onDrop();
            }}
            className={[
                'relative transition-all duration-150',
                active ? 'outline-2 outline-offset-2 outline-dashed outline-brass/60' : '',
                over ? 'scale-[1.02] outline-solid outline-brass shadow-[0_0_30px_-6px_rgba(242,193,78,0.8)]' : '',
                className,
            ].join(' ')}
        >
            {children}
            {active && hint && (
                <span
                    className={`pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] text-center font-display text-sm tracking-widest uppercase transition ${
                        over ? 'bg-brass/25 text-white' : 'bg-black/40 text-brass/80'
                    }`}
                >
                    {hint}
                </span>
            )}
        </div>
    );
}
