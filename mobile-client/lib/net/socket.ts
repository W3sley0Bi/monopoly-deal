/**
 * `useJsonSocket` — ported precisely from `frontend/src/game/useJsonSocket.ts`
 * per SHELL-SPEC.md §2, plus the two native-only additions the spec calls
 * for: an `AppState` listener that forces a reconnect on foreground. The
 * server owns WebSocket ping/pong keepalive, so health checks never enter the
 * game message stream. Everything else ports verbatim —
 * linear backoff, the unbounded send queue, the ref-held handler.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface UseJsonSocket<Out> {
    status: SocketStatus;
    send: (msg: Out) => void;
}

export function useJsonSocket<In, Out>(url: string, onMessage: (msg: In) => void): UseJsonSocket<Out> {
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
                for (const msg of pending) {
                    ws.send(JSON.stringify(msg));
                }
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
            // Unbounded, never dropped, never capped, survives reconnects.
            queueRef.current.push(msg);
        }
    }

    return { status, send };
}
