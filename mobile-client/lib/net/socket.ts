/**
 * `useJsonSocket` — ported precisely from `frontend/src/game/useJsonSocket.ts`
 * per SHELL-SPEC.md §2, plus the two native-only additions the spec calls
 * for: an `AppState` listener that forces a reconnect on foreground. The
 * server owns WebSocket ping/pong keepalive, so health checks never enter the
 * game message stream. Everything else ports verbatim — linear backoff and
 * the ref-held handler — except the send queue, which is capped and filtered
 * on replay: a phone can sit offline far longer than a browser tab, and a move
 * decided against a table that has since moved on must not land on it.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface UseJsonSocket<Out> {
    status: SocketStatus;
    send: (msg: Out) => void;
}

export interface UseJsonSocketOptions<Out> {
    /** Most frames held while offline; the oldest go first past it. */
    queueLimit?: number;
    /** Frames that are stale by the time the socket is back, and are
     *  discarded instead of replayed. */
    dropOnReconnect?: (msg: Out) => boolean;
    /** Told what was discarded — by the cap or on replay — so the player can
     *  be warned that a move they made never reached the table. */
    onDropped?: (msgs: Out[]) => void;
}

export function useJsonSocket<In, Out>(
    url: string,
    onMessage: (msg: In) => void,
    options?: UseJsonSocketOptions<Out>
): UseJsonSocket<Out> {
    // Computed once so the connect effect never re-fires on a changing prop.
    const [socketUrl] = useState(url);
    const [status, setStatus] = useState<SocketStatus>('connecting');

    // Dispatch reads this ref, so frames arriving before a re-render still
    // reach the latest handler and the socket is never torn down because a
    // callback identity changed.
    const handler = useRef(onMessage);
    useEffect(() => {
        handler.current = onMessage;
    }, [onMessage]);

    // Read through a ref so the connect effect, which runs once per URL, never
    // holds the options object from the first render.
    const opts = useRef(options);
    useEffect(() => {
        opts.current = options;
    });

    const wsRef = useRef<WebSocket | null>(null);
    const queueRef = useRef<Out[]>([]);

    useEffect(() => {
        let closed = false;
        let attempt = 0;
        let retry: ReturnType<typeof setTimeout> | null = null;

        function connect() {
            if (closed) return;
            setStatus('connecting');
            const ws = new WebSocket(socketUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                attempt = 0;
                setStatus('open');
                // Drain the whole queue in FIFO order, swapped to [] first so
                // anything sent while draining doesn't get dropped or re-sent.
                const pending = queueRef.current;
                queueRef.current = [];
                const stale = opts.current?.dropOnReconnect;
                const dropped: Out[] = [];
                for (const msg of pending) {
                    if (stale?.(msg)) {
                        dropped.push(msg);
                        continue;
                    }
                    ws.send(JSON.stringify(msg));
                }
                if (dropped.length) opts.current?.onDropped?.(dropped);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data as string) as In;
                    handler.current(data);
                } catch {
                    // non-JSON frames are silently dropped
                }
            };

            ws.onclose = () => {
                if (closed) return;
                setStatus('closed');
                attempt += 1;
                retry = setTimeout(connect, Math.min(500 * attempt, 4000));
            };

            ws.onerror = () => {
                ws.close();
            };
        }

        connect();

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state !== 'active') return;
            const ws = wsRef.current;
            // Foreground reconnect: mobile OSes kill idle sockets without a
            // close event firing reliably, so force one on return.
            if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
                if (retry) {
                    clearTimeout(retry);
                    retry = null;
                }
                connect();
            }
        });

        return () => {
            closed = true;
            if (retry) clearTimeout(retry);
            appStateSub.remove();
            const ws = wsRef.current;
            wsRef.current = null;
            if (ws) {
                // Null onclose before close() so teardown never schedules a
                // reconnect for a socket we're intentionally dropping.
                ws.onclose = null;
                ws.close();
            }
        };
    }, [socketUrl]);

    function send(msg: Out) {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        } else {
            // Survives reconnects, up to the cap.
            queueRef.current.push(msg);
            const limit = opts.current?.queueLimit;
            if (limit && queueRef.current.length > limit) {
                const evicted = queueRef.current.splice(0, queueRef.current.length - limit);
                opts.current?.onDropped?.(evicted);
            }
        }
    }

    return { status, send };
}
