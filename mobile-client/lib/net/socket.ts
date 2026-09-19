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
    /** Immediately abandon the current attempt and open a fresh socket. */
    reconnect: () => void;
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
    /** Called once per socket, on open, before any of its frames are
     *  dispatched — the one moment a caller can tell a new connection apart
     *  from more frames on the old one. */
    onOpen?: () => void;
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
    const reconnectRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        let closed = false;
        let attempt = 0;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let connectWatchdog: ReturnType<typeof setTimeout> | null = null;

        function clearConnectWatchdog() {
            if (!connectWatchdog) return;
            clearTimeout(connectWatchdog);
            connectWatchdog = null;
        }

        function scheduleRetry() {
            if (closed || retry) return;
            setStatus('closed');
            attempt += 1;
            retry = setTimeout(() => {
                retry = null;
                connect();
            }, Math.min(500 * attempt, 4000));
        }

        function connect() {
            if (closed) return;
            setStatus('connecting');
            let ws: WebSocket;
            try {
                ws = new WebSocket(socketUrl);
            } catch {
                scheduleRetry();
                return;
            }
            wsRef.current = ws;
            connectWatchdog = setTimeout(() => {
                if (closed || wsRef.current !== ws || ws.readyState === WebSocket.OPEN) return;
                ws.onclose = null;
                wsRef.current = null;
                ws.close();
                scheduleRetry();
            }, 12_000);

            ws.onopen = () => {
                clearConnectWatchdog();
                attempt = 0;
                opts.current?.onOpen?.();
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
                    try {
                        ws.send(JSON.stringify(msg));
                    } catch {
                        queueRef.current.unshift(msg);
                        ws.close();
                        break;
                    }
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
                clearConnectWatchdog();
                if (wsRef.current === ws) wsRef.current = null;
                scheduleRetry();
            };

            ws.onerror = () => {
                ws.close();
            };
        }

        connect();

        reconnectRef.current = () => {
            if (closed) return;
            if (retry) {
                clearTimeout(retry);
                retry = null;
            }
            const ws = wsRef.current;
            clearConnectWatchdog();
            wsRef.current = null;
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
            connect();
        };

        let previousAppState = AppState.currentState;
        const appStateSub = AppState.addEventListener('change', (state) => {
            const returningToForeground = previousAppState !== 'active' && state === 'active';
            previousAppState = state;
            if (!returningToForeground) return;
            const ws = wsRef.current;
            // Foreground reconnect: mobile OSes kill idle sockets without a
            // close event firing reliably, so force one on return.
            if (!ws || ws.readyState !== WebSocket.CONNECTING) {
                reconnectRef.current();
            }
        });

        return () => {
            closed = true;
            reconnectRef.current = () => undefined;
            if (retry) clearTimeout(retry);
            clearConnectWatchdog();
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
            try {
                ws.send(JSON.stringify(msg));
                return;
            } catch {
                // The socket can close between readyState and send. Preserve
                // the frame under the same bounded-queue rules as offline use.
            }
        }

        {
            // Survives reconnects, up to the cap.
            queueRef.current.push(msg);
            const limit = opts.current?.queueLimit;
            if (limit && queueRef.current.length > limit) {
                const evicted = queueRef.current.splice(0, queueRef.current.length - limit);
                opts.current?.onDropped?.(evicted);
            }
        }
    }

    return { status, send, reconnect: () => reconnectRef.current() };
}
