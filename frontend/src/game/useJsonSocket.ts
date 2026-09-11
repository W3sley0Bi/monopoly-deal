import { useCallback, useEffect, useRef, useState } from 'react';

export type SocketStatus = 'connecting' | 'open' | 'closed';

interface Socket<Out> {
    status: SocketStatus;
    /** Sends immediately when open, otherwise queues until the socket opens. */
    send: (msg: Out) => void;
}

/**
 * Keeps a single JSON WebSocket alive, reconnecting with backoff.
 * Messages that arrive before a handler is ready are still delivered, since the
 * handler is read from a ref at dispatch time.
 */
export function useJsonSocket<In, Out>(url: string, onMessage: (msg: In) => void): Socket<Out> {
    const [status, setStatus] = useState<SocketStatus>('connecting');
    const handler = useRef(onMessage);
    const socket = useRef<WebSocket | null>(null);
    const queue = useRef<Out[]>([]);

    useEffect(() => {
        handler.current = onMessage;
    }, [onMessage]);

    useEffect(() => {
        let closed = false;
        let attempt = 0;
        let retry: ReturnType<typeof setTimeout> | undefined;

        const connect = () => {
            if (closed) return;
            setStatus('connecting');
            const ws = new WebSocket(url);
            socket.current = ws;

            ws.onopen = () => {
                attempt = 0;
                setStatus('open');
                const pending = queue.current;
                queue.current = [];
                for (const msg of pending) ws.send(JSON.stringify(msg));
            };

            ws.onmessage = event => {
                try {
                    handler.current(JSON.parse(event.data as string) as In);
                } catch {
                    // Ignore frames that are not JSON.
                }
            };

            ws.onclose = () => {
                if (closed) return;
                setStatus('closed');
                attempt += 1;
                retry = setTimeout(connect, Math.min(500 * attempt, 4000));
            };

            // onclose always follows onerror, so reconnection is handled there.
            ws.onerror = () => ws.close();
        };

        connect();

        return () => {
            closed = true;
            if (retry) clearTimeout(retry);
            const ws = socket.current;
            socket.current = null;
            if (ws) {
                ws.onclose = null;
                ws.close();
            }
        };
    }, [url]);

    const send = useCallback((msg: Out) => {
        const ws = socket.current;
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
        else queue.current.push(msg);
    }, []);

    return { status, send };
}
