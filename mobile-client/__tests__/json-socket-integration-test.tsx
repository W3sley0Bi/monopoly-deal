import { act, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { useJsonSocket, type UseJsonSocket } from '../lib/net/socket';

type Msg = { type: string };

class FakeSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    static all: FakeSocket[] = [];
    readyState = FakeSocket.CONNECTING;
    sent: string[] = [];
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public url: string) {
        FakeSocket.all.push(this);
    }
    send(data: string) {
        this.sent.push(data);
    }
    close() {
        this.readyState = FakeSocket.CLOSED;
        this.onclose?.();
    }
    open() {
        this.readyState = FakeSocket.OPEN;
        this.onopen?.();
    }
}

let latest: UseJsonSocket<Msg>;
const received: unknown[] = [];
const dropped: Msg[][] = [];

function Probe() {
    latest = useJsonSocket<unknown, Msg>('ws://test', (m) => received.push(m), {
        dropOnReconnect: (m) => m.type === 'end_turn',
        onDropped: (msgs) => dropped.push(msgs),
    });
    return null;
}

const last = () => FakeSocket.all[FakeSocket.all.length - 1];

describe('useJsonSocket', () => {
    const realWebSocket = global.WebSocket;

    beforeEach(() => {
        jest.useFakeTimers();
        FakeSocket.all = [];
        received.length = 0;
        dropped.length = 0;
        // react-native's jest setup defines WebSocket with a getter, so plain
        // assignment is silently ignored.
        Object.defineProperty(global, 'WebSocket', { value: FakeSocket, configurable: true, writable: true });
    });

    afterEach(() => {
        jest.useRealTimers();
        Object.defineProperty(global, 'WebSocket', { value: realWebSocket, configurable: true, writable: true });
    });

    it('queues while offline, drops stale frames and replays the rest on open', async () => {
        await render(<Probe />);
        await act(async () => {
            latest.send({ type: 'chat' });
            latest.send({ type: 'end_turn' });
        });
        await act(async () => last().open());

        expect(latest.status).toBe('open');
        expect(last().sent).toEqual([JSON.stringify({ type: 'chat' })]);
        expect(dropped).toEqual([[{ type: 'end_turn' }]]);
    });

    it('retries with backoff after a close', async () => {
        await render(<Probe />);
        await act(async () => last().open());
        await act(async () => last().close());
        expect(latest.status).toBe('closed');
        expect(FakeSocket.all).toHaveLength(1);

        await act(async () => { jest.advanceTimersByTime(500); });
        expect(FakeSocket.all).toHaveLength(2);
        expect(latest.status).toBe('connecting');
    });

    // A half-open network never fires close, so without the watchdog the
    // player would sit on "connecting" forever.
    it('abandons an attempt that never opens', async () => {
        await render(<Probe />);
        await act(async () => { jest.advanceTimersByTime(12_000); });
        expect(latest.status).toBe('closed');
        await act(async () => { jest.advanceTimersByTime(500); });
        expect(FakeSocket.all).toHaveLength(2);
    });

    it('reconnect replaces the socket without scheduling a second retry', async () => {
        await render(<Probe />);
        const first = last();
        await act(async () => latest.reconnect());
        expect(first.readyState).toBe(FakeSocket.CLOSED);
        expect(FakeSocket.all).toHaveLength(2);
        await act(async () => { jest.advanceTimersByTime(5_000); });
        expect(FakeSocket.all).toHaveLength(2);
    });

    it('drops non-JSON frames instead of throwing', async () => {
        await render(<Probe />);
        await act(async () => last().open());
        await act(async () => {
            last().onmessage?.({ data: 'not json' });
            last().onmessage?.({ data: '{"type":"home"}' });
        });
        expect(received).toEqual([{ type: 'home' }]);
    });
});
