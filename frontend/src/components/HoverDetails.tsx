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
}

/** A delayed, hoverable and dismissible preview. Portals escape card rails.
 * Focus shows the same information; non-action triggers can open it on tap. */
export default function HoverDetails({
    children,
    content,
    enabled = true,
    openOnClick = false,
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
    const leave = () => {
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
        const place = () => {
            const r = trigger.getBoundingClientRect();
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
        window.addEventListener('keydown', dismiss);
        window.addEventListener('pointerdown', outside);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', scroll, true);
        return () => {
            observer.disconnect();
            window.removeEventListener('keydown', dismiss);
            window.removeEventListener('pointerdown', outside);
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', scroll, true);
        };
    }, [open, enabled]);
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
                        className="hover-details"
                        style={{ visibility: 'hidden' }}
                        onPointerEnter={clear}
                        onPointerLeave={leave}
                    >
                        {content}
                    </div>,
                    document.body,
                )}
        </>
    );
}
