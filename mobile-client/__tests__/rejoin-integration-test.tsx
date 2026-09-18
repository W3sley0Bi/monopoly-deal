import { act, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../lib/config', () => ({ SERVER_URL: 'ws://test' }));
// Only the provider reads the store; the hook under test takes identity as
// arguments, so AsyncStorage never needs to load.
jest.mock('../lib/store', () => ({ useStore: jest.fn() }));

type UrlListener = (event: { url: string }) => void;
const mockLinking = {
    initial: Promise.resolve<string | null>(null),
    listeners: [] as UrlListener[],
};
jest.mock('expo-linking', () => ({
    getInitialURL: () => mockLinking.initial,
    addEventListener: (_: string, fn: UrlListener) => {
        mockLinking.listeners.push(fn);
        return { remove: () => { mockLinking.listeners = mockLinking.listeners.filter((l) => l !== fn); } };
    },
    parse: (url: string) => {
        const m = url.match(/^[a-z]+:\/\/(.*?)(?:\?(.*))?$/i);
        const query = new URLSearchParams(m?.[2] ?? '');
        return { path: m?.[1] ?? null, queryParams: Object.fromEntries(query.entries()) };
    },
}));

import { useGameConnection, type UseGameConnection } from '../lib/net/messages';

class FakeSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 3;
    static all: FakeSocket[] = [];
    readyState = FakeSocket.CONNECTING;
    sent: { type: string; room_id?: string }[] = [];
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public url: string) {
        FakeSocket.all.push(this);
    }
    send(data: string) {
        this.sent.push(JSON.parse(data));
    }
    close() {
        this.readyState = FakeSocket.CLOSED;
        this.onclose?.();
    }
    open() {
        this.readyState = FakeSocket.OPEN;
        this.onopen?.();
    }
    receive(msg: unknown) {
        this.onmessage?.({ data: JSON.stringify(msg) });
    }
}

const last = () => FakeSocket.all[FakeSocket.all.length - 1];
const joins = (s: FakeSocket) => s.sent.filter((m) => m.type === 'join_room').map((m) => m.room_id);
const hellos = (s: FakeSocket) => s.sent.filter((m) => m.type === 'hello').length;

const homeFrame = { type: 'home', payload: { protocol_version: 1, rooms: [] } };
const roomFrame = (id: string) => ({ type: 'room', payload: { id, game: { players: [], now_ms: Date.now() } } });

let latest: UseGameConnection;
const persisted: (string | null)[] = [];

function Probe({ roomId }: { roomId: string | null }) {
    latest = useGameConnection('me', 'Ana', () => {}, (id) => persisted.push(id), roomId);
    return null;
}

/** Drop the socket and let the backoff open a fresh one. */
async function reconnect() {
    await act(async () => last().close());
    await act(async () => { jest.advanceTimersByTime(500); });
    await act(async () => last().open());
}

describe('useGameConnection rejoin', () => {
    const realWebSocket = global.WebSocket;

    beforeEach(() => {
        jest.useFakeTimers();
        FakeSocket.all = [];
        persisted.length = 0;
        mockLinking.initial = Promise.resolve(null);
        mockLinking.listeners = [];
        Object.defineProperty(global, 'WebSocket', { value: FakeSocket, configurable: true, writable: true });
    });

    afterEach(() => {
        jest.useRealTimers();
        Object.defineProperty(global, 'WebSocket', { value: realWebSocket, configurable: true, writable: true });
    });

    // The socket can open before getInitialURL() settles; the persisted room
    // must not wait on it.
    it('rejoins the persisted room even if the launch link never resolves', async () => {
        mockLinking.initial = new Promise(() => {});
        await render(<Probe roomId="ROOM" />);
        await act(async () => last().open());
        expect(hellos(last())).toBe(1);
        expect(joins(last())).toEqual(['ROOM']);
    });

    it('prefers a launch invite over the persisted room', async () => {
        mockLinking.initial = Promise.resolve('deal://join/abcd');
        await render(<Probe roomId="ROOM" />);
        await act(async () => last().open());
        expect(joins(last())).toEqual(['ABCD']);
    });

    it('joins a launch invite that resolves after the socket opened', async () => {
        let resolve!: (url: string | null) => void;
        mockLinking.initial = new Promise((r) => { resolve = r; });
        await render(<Probe roomId={null} />);
        await act(async () => last().open());
        expect(joins(last())).toEqual([]);
        await act(async () => resolve('deal://join/late'));
        expect(joins(last())).toEqual(['LATE']);
    });

    it('accepts the legacy ?join= query', async () => {
        mockLinking.initial = Promise.resolve('deal://?join=qq11');
        await render(<Probe roomId={null} />);
        await act(async () => last().open());
        expect(joins(last())).toEqual(['QQ11']);
    });

    it('joins a runtime link immediately while connected', async () => {
        await render(<Probe roomId={null} />);
        await act(async () => last().open());
        await act(async () => mockLinking.listeners.forEach((l) => l({ url: 'deal://join/wxyz' })));
        expect(joins(last())).toEqual(['WXYZ']);
        // The same link again is not a second join.
        await act(async () => mockLinking.listeners.forEach((l) => l({ url: 'deal://join/WXYZ' })));
        expect(joins(last())).toEqual(['WXYZ']);
    });

    it('holds a runtime link that arrives offline until the socket opens', async () => {
        await render(<Probe roomId={null} />);
        await act(async () => mockLinking.listeners.forEach((l) => l({ url: 'deal://join/wxyz' })));
        expect(last().sent).toEqual([]);
        await act(async () => last().open());
        expect(joins(last())).toEqual(['WXYZ']);
    });

    it('sends hello and rejoin once per open transition', async () => {
        const { rerender } = await render(<Probe roomId="ROOM" />);
        await act(async () => last().open());
        await act(async () => last().receive(roomFrame('ROOM')));
        await rerender(<Probe roomId="ROOM" />);
        expect(hellos(last())).toBe(1);
        expect(joins(last())).toEqual(['ROOM']);

        await reconnect();
        expect(FakeSocket.all).toHaveLength(2);
        expect(hellos(last())).toBe(1);
        expect(joins(last())).toEqual(['ROOM']);
    });

    it('forgets the room when a home frame arrives while one is held', async () => {
        await render(<Probe roomId="ROOM" />);
        await act(async () => last().open());
        await act(async () => last().receive(roomFrame('ROOM')));
        await act(async () => last().receive(homeFrame));
        expect(latest.room).toBeNull();
        expect(persisted[persisted.length - 1]).toBeNull();

        await reconnect();
        expect(joins(last())).toEqual([]);
    });

    it('forgets the room when the server says it no longer exists', async () => {
        await render(<Probe roomId="GONE" />);
        await act(async () => last().open());
        await act(async () => last().receive({ type: 'error', error_key: 'err.no_such_table', error: 'no table' }));
        expect(persisted).toEqual([null]);

        await reconnect();
        expect(joins(last())).toEqual([]);
    });

    // The server answers hello with the lobby list before the join lands; that
    // is not an eviction.
    it('keeps the rejoin through a home frame while homeless', async () => {
        await render(<Probe roomId="ROOM" />);
        await act(async () => last().open());
        await act(async () => last().receive(homeFrame));
        expect(persisted).toEqual([]);

        await reconnect();
        expect(joins(last())).toEqual(['ROOM']);
    });
});
