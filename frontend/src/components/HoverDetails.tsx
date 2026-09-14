import { useEffect, useId, useRef, useState } from 'react';
import type {
    ElementType,
    HTMLAttributes,
    ReactElement,
    ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
    CLOSE_DELAY, SETTLE_POLL, SWEEP_SPEED,
    hoverOpenDelay, markHoverClosed, markHoverOpen, pointerSpeed,
} from '../game/hoverIntent';

interface Props {
    children: ReactElement<HTMLAttributes<HTMLElement>>;
    openOnClick?: boolean;
    content: ReactNode;
    enabled?: boolean;
    /**
     * Keeps the panel alive while the pointer is on it, and allows a short
     * grace to cross the gap. For a panel whose contents are worth reading
     * through and scrolling, rather than glancing at.
     */
    sticky?: boolean;
}

/** A delayed, dismissible preview. Portals escape card rails. Focus shows the
 * same information; non-action triggers can open it on tap.
 *
 * The panel belongs to the thing under the pointer and to nothing else: it
 * closes the moment the pointer leaves that element, and it never takes the
 * pointer itself, so crossing over the panel dismisses it rather than holding
 * it open. */
export default function HoverDetails({
    children,
    content,
    enabled = true,
    openOnClick = false,
    sticky = false,
}: Props) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const anchor = useRef<HTMLElement | null>(null);
    const panel = useRef<HTMLDivElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clear = () => {
        if (timer.current) clearTimeout(timer.current);
    };
    const close = () => {
        clear();
        setOpen(false);
    };
    // A sticky panel is somewhere the pointer is allowed to go, so leaving the
    // trigger only starts a short grace for crossing the gap between them.
    const leave = () => {
        if (!sticky) {
            close();
            return;
        }
        clear();
        timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
    };
    // A popup queued behind a moving pointer waits for the hand to settle
    // rather than firing into a sweep across the fan.
    const queue = (delay: number) => {
        clear();
        timer.current = setTimeout(() => {
            if (pointerSpeed() > SWEEP_SPEED) {
                queue(SETTLE_POLL);
                return;
            }
            setOpen(true);
        }, delay);
    };
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );
    // Reading one card and moving to the next is one gesture: while a popup is
    // open, and briefly after it closes, the next one skips the full wait.
    useEffect(() => {
        if (!open || !enabled) return;
        markHoverOpen();
        return markHoverClosed;
    }, [open, enabled]);
    useEffect(() => {
        if (!open || !enabled) return;
        const el = panel.current,
            trigger = anchor.current;
        if (!el || !trigger) return;
        // The last known box of the trigger, kept for the stray check below.
        let box = trigger.getBoundingClientRect();
        const place = () => {
            const r = trigger.getBoundingClientRect();
            box = r;
            const w = el.offsetWidth,
                h = el.offsetHeight;
            const right = r.right + 12;
            const left =
                right + w <= innerWidth - 12
                    ? right
                    : r.left - w - 12 >= 12
                      ? r.left - w - 12
                      : Math.max(
                            12,
                            Math.min(
                                innerWidth - w - 12,
                                r.x + r.width / 2 - w / 2,
                            ),
                        );
            const above = r.top - h - 12;
            const top =
                right + w <= innerWidth - 12 || r.left - w - 12 >= 12
                    ? r.top + r.height / 2 - h / 2
                    : above >= 12
                      ? above
                      : r.bottom + 12;
            el.style.left = `${left}px`;
            el.style.top = `${Math.max(12, Math.min(innerHeight - h - 12, top))}px`;
            el.style.visibility = 'visible';
        };
        place();
        const observer = new ResizeObserver(place);
        observer.observe(el);
        const dismiss = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        const outside = (e: PointerEvent) => {
            if (
                !el.contains(e.target as Node) &&
                !trigger.contains(e.target as Node)
            )
                setOpen(false);
        };
        const scroll = (e: Event) => {
            if (!el.contains(e.target as Node)) setOpen(false);
        };
        // `pointerleave` is not guaranteed to arrive. A trigger that is covered
        // by a dialog, re-rendered under the cursor, or left behind when the
        // pointer jumps never reports the exit, and the panel is then stuck
        // open with nothing hovering it. So the pointer's own position is the
        // authority: once it is off the trigger, the panel goes. The margin
        // covers the few pixels a card travels when it lifts under the cursor.
        // A sticky panel is part of the target, and the gap between the two
        // has to be crossable, so it gets a wider margin and counts its own
        // box as somewhere the pointer is allowed to be.
        const margin = sticky ? 18 : 8;
        const within = (r: DOMRect, e: PointerEvent) =>
            e.clientX >= r.left - margin &&
            e.clientX <= r.right + margin &&
            e.clientY >= r.top - margin &&
            e.clientY <= r.bottom + margin;
        const stray = (e: PointerEvent) => {
            if (e.pointerType === 'touch') return;
            if (within(box, e)) return;
            if (sticky && within(el.getBoundingClientRect(), e)) return;
            setOpen(false);
        };
        window.addEventListener('keydown', dismiss);
        window.addEventListener('pointerdown', outside);
        window.addEventListener('pointermove', stray, { passive: true });
        window.addEventListener('resize', place);
        window.addEventListener('scroll', scroll, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('keydown', dismiss);
            window.removeEventListener('pointerdown', outside);
            window.removeEventListener('pointermove', stray);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', scroll, true);
        };
    }, [open, enabled, sticky]);
    const Trigger = children.type as ElementType<HTMLAttributes<HTMLElement>>;
    return (
        <>
            {enabled ? (
                <Trigger
                    {...children.props}
                    aria-describedby={open ? id : undefined}
                    onPointerEnter={(e) => {
                        anchor.current = e.currentTarget;
                        if (e.pointerType === 'touch') return;
                        queue(hoverOpenDelay());
                    }}
                    onPointerLeave={leave}
                    onFocus={(e) => {
                        anchor.current = e.currentTarget;
                        clear();
                        setOpen(true);
                    }}
                    onBlur={close}
                    onClick={(e) => {
                        clear();
                        setOpen(openOnClick);
                        children.props.onClick?.(e);
                    }}
                    onPointerDown={(e) => {
                        anchor.current = e.currentTarget;
                        close();
                        // The trigger may start a card drag here, so its own
                        // handler has to survive being wrapped.
                        children.props.onPointerDown?.(e);
                    }}
                />
            ) : (
                children
            )}
            {open &&
                enabled &&
                createPortal(
                    <div
                        id={id}
                        ref={panel}
                        role="tooltip"
                        className={`hover-details ${sticky ? 'hover-sticky' : ''}`}
                        style={{ visibility: 'hidden' }}
                        onPointerEnter={sticky ? clear : undefined}
                        onPointerLeave={sticky ? close : undefined}
                    >
                        {content}
                    </div>,
                    document.body,
                )}
        </>
    );
}
