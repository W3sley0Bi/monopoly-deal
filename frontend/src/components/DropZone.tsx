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
    /** Native `hidden`, for a zone whose panel can fold away. */
    hidden?: boolean;
}

/**
 * A mat area that accepts a dragged card. Inactive zones ignore drops entirely,
 * so an illegal card cannot be dropped by accident.
 *
 * The zone announces itself to the drag layer rather than listening for drag
 * events of its own: the pointer that carries the card is hit-tested against
 * the page, which is the only way a finger can drop anything at all.
 */
export default function DropZone({ active, onDrop, children, className = '', hint, tour, hidden }: Props) {
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
            hidden={hidden}
            data-tour={tour}
            data-drop-id={id}
            data-active={active || undefined}
            // The states are named here and dressed in the stylesheet, because
            // how a zone opens up for a card is a movement — two easings and a
            // pulse — and that does not fit in a list of utility classes.
            className={[
                'drop-zone',
                active ? 'drop-zone-live' : '',
                over ? 'drop-zone-over' : '',
                className,
            ].join(' ')}
        >
            {children}
            {active && hint && (
                <span className="drop-zone-hint pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] text-center font-display text-sm tracking-widest uppercase">
                    {hint}
                </span>
            )}
        </div>
    );
}
