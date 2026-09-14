import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { useOptionalDragLayer } from '../game/dragLayer';

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
 *
 * The zone announces itself to the drag layer rather than listening for drag
 * events of its own: the pointer that carries the card is hit-tested against
 * the page, which is the only way a finger can drop anything at all.
 */
export default function DropZone({ active, onDrop, children, className = '', hint, tour }: Props) {
    const id = useId();
    const layer = useOptionalDragLayer();
    const setZone = layer?.setZone;
    const over = layer?.overId === id;

    // The handler changes on every render; the registration must not, or the
    // zone would deregister itself out from under an in-flight drag.
    const drop = useRef(onDrop);
    drop.current = onDrop;

    useEffect(() => {
        if (!setZone) return;
        setZone(id, { active, onDrop: () => drop.current() });
        return () => setZone(id, null);
    }, [id, active, setZone]);

    return (
        <div
            data-tour={tour}
            data-drop-id={id}
            data-active={active || undefined}
            className={[
                'relative transition-all duration-150',
                active ? 'outline-2 outline-offset-2 outline-dashed outline-brass/60' : '',
                over ? 'drop-zone-over scale-[1.02] outline-solid outline-brass shadow-[0_0_30px_-6px_rgba(242,193,78,0.8)]' : '',
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
