/**
 * `useGameConnection()` — the app state machine from SHELL-SPEC.md §1, wired
 * to `useJsonSocket`. Owns identity stamping, rejoin-on-reconnect, the home/
 * room eviction guard, clock skew, notice auto-clear, and the `deal://join/`
 * deep link.
 */
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { SERVER_URL } from '../config';
import { useStore } from '../store';
import { applyDevMove } from '../../src/dev/reduce';
import { OfflineGame, OfflineGameError } from '../../src/game/offline/engine';
import { useJsonSocket, type SocketStatus } from './socket';
import type { ClientMessage, HomeView, RoomView, ServerMessage } from '../../src/types';

const NOTICE_MS = 3600;

/** Must equal `ProtocolVersion` in `backend/server/messages.go`. Bump both
 *  together whenever a frame changes shape in a way the other side cannot
 *  read — an installed app keeps its number until the player updates it. */
export const PROTOCOL_VERSION = 1;

/** Which side has to update. The app cannot fix either on its own, so this
 *  outlives the auto-clearing notice banner. */
export type Incompatible = 'client_outdated' | 'server_outdated';

// Moves decided against a table that has since moved on: replaying them after
// a reconnect would spend a play or answer a debt the player never saw.
// `hello` is here too because the open transition sends a fresh one anyway.
const STALE_ON_RECONNECT = new Set<ClientMessage['type']>([
    'hello',
    'play_bank', 'play_property', 'play_action', 'move_wildcard',
    'end_turn', 'respond', 'tutorial_next',
    'start_game', 'new_game', 'terminate_game',
    'kick', 'take_seat', 'request_seat', 'cancel_seat',
    'add_bot', 'remove_bot', 'set_options',
]);

export interface Notice {
    /** The translation key — stored, not rendered text, so the banner
     *  re-translates live on a language change. */
    key?: string;
    args?: Record<string, unknown>;
    /** English fallback, for a non-Fault error with no key. */
    text?: string;
    /** Distinguishes an error banner from a close_room notice, for styling. */
    kind: 'error' | 'notice';
}

export interface UseGameConnection {
    status: SocketStatus;
    home: HomeView | null;
    room: RoomView | null;
    notice: Notice | null;
    /** Set once either side reports a different protocol version. */
    incompatible: Incompatible | null;
    /** `payload.game.now_ms - Date.now()` from the last `room` frame, for
     *  countdowns that must agree with the server clock. */
    skewMs: number;
    /** Stamps `player_id` + `player_name` onto every outbound frame. */
    send: (msg: Omit<ClientMessage, 'player_id'>) => void;
    retryConnection: () => void;
    isOffline?: boolean;
    myId: string;
    name: string;
    setName: (name: string) => void;
    /** `leave_room` + clears the held rejoin code. */
    leave: () => void;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * Renderers index straight into nested payloads (`room.game.players[i]`), so a
 * frame from a mismatched or misbehaving server must be dropped here rather
 * than crash a screen. Only the shape the screens dereference unguarded is
 * checked: Go omits empty strings (`omitempty`) and can marshal nil slices as
 * `null`, so stricter checks on `home`/`error`/`notice` would drop real frames.
 */
export function isValidServerMessage(msg: unknown): msg is ServerMessage {
    if (!isObject(msg)) return false;
    switch (msg.type) {
        case 'home':
            return isObject(msg.payload);
        case 'room': {
            const p = msg.payload;
            return isObject(p) && typeof p.id === 'string' && isObject(p.game) && Array.isArray(p.game.players);
        }
        case 'error':
        case 'notice':
            return true;
        default:
            return false;
    }
}

/**
 * @param playerId  From the hydrated store — minted once, persisted forever.
 * @param playerName  From the hydrated store; may be '' before the welcome
 *   card is completed.
 * @param persistName  Called whenever `setName` changes the name, so the
 *   caller can write it back to the store.
 * @param persistRoomId  Called with the current room code (or null) on every
 *   `room` frame / eviction, so reconnects survive an app relaunch.
 */
export function useGameConnection(
    playerId: string,
    playerName: string,
    persistName: (name: string) => void,
    persistRoomId: (roomId: string | null) => void,
    initialRoomId: string | null,
): UseGameConnection {
    const [home, setHome] = useState<HomeView | null>(null);
    const [room, setRoom] = useState<RoomView | null>(null);
    const [notice, setNotice] = useState<Notice | null>(null);
    const [incompatible, setIncompatible] = useState<Incompatible | null>(null);
    const [skewMs, setSkewMs] = useState(0);
    const [name, setNameState] = useState(playerName);

    // Ref, not state — read at send-time, not re-rendered on every change,
    // and mutated directly by the deep link + eviction paths per the spec.
    // Seeded synchronously from the persisted code: waiting for
    // getInitialURL() let a fast socket open before it and skip the rejoin.
    const rejoin = useRef<string | null>(initialRoomId);
    const roomHeld = useRef(false);

    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearNoticeLater = useCallback(() => {
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    }, []);

    const onMessage = useCallback(
        (msg: unknown) => {
            if (!isValidServerMessage(msg)) return;
            if (msg.type === 'home') {
                // An older server ignores the version we stamp rather than
                // refusing it, so this is the only way to catch that case.
                if (msg.payload.protocol_version !== PROTOCOL_VERSION) {
                    setIncompatible(
                        (msg.payload.protocol_version ?? 0) < PROTOCOL_VERSION ? 'server_outdated' : 'client_outdated',
                    );
                } else {
                    setIncompatible(null);
                }
                setHome(msg.payload);
                // A home frame while a room is held means eviction — the
                // server ejected us; clear the rejoin. A home frame while
                // already homeless is just the lobby list and must NOT
                // clear a rejoin that hasn't been consumed yet.
                // Read from a ref, not a setRoom updater: persistRoomId writes
                // the store, and doing that inside an updater updates another
                // component mid-render.
                if (roomHeld.current) {
                    rejoin.current = null;
                    persistRoomId(null);
                }
                roomHeld.current = false;
                setRoom(null);
                return;
            }

            if (msg.type === 'room') {
                roomHeld.current = true;
                setRoom(msg.payload);
                setSkewMs(msg.payload.game.now_ms - Date.now());
                rejoin.current = msg.payload.id;
                persistRoomId(msg.payload.id);
                return;
            }

            if (msg.type === 'error') {
                if (msg.error_key === 'err.client_outdated' || msg.error_key === 'err.server_outdated') {
                    setIncompatible(msg.error_key === 'err.client_outdated' ? 'client_outdated' : 'server_outdated');
                }
                if (msg.error_key === 'err.no_such_table') {
                    rejoin.current = null;
                    persistRoomId(null);
                }
                setNotice({ key: msg.error_key, args: msg.error_args, text: msg.error, kind: 'error' });
                clearNoticeLater();
                return;
            }

            if (msg.type === 'notice') {
                setNotice({ key: msg.notice_key, args: msg.notice_args, text: msg.notice, kind: 'notice' });
                clearNoticeLater();
            }
        },
        [persistRoomId, clearNoticeLater],
    );

    const { status, send: sendRaw, reconnect } = useJsonSocket<ServerMessage, ClientMessage>(
        SERVER_URL,
        onMessage,
        {
            queueLimit: 50,
            dropOnReconnect: (msg) => STALE_ON_RECONNECT.has(msg.type),
            onDropped: (msgs) => {
                // A lost `hello` is routine; only a lost move is worth saying.
                const moves = msgs.filter((m) => m.type !== 'hello').length;
                if (!moves) return;
                setNotice({ key: 'notice.offline_moves_dropped', args: { count: moves }, kind: 'notice' });
                clearNoticeLater();
            },
        },
    );

    const send = useCallback(
        (msg: Omit<ClientMessage, 'player_id'>) => {
            sendRaw({
                ...msg,
                player_id: playerId,
                player_name: name || undefined,
                protocol_version: PROTOCOL_VERSION,
            } as ClientMessage);
        },
        [sendRaw, playerId, name],
    );

    // On each transition to open, with a non-empty name: hello, then rejoin
    // the held room code if one is set.
    const lastOpenedFor = useRef<string | null>(null);
    useEffect(() => {
        if (status !== 'open' || !name) return;
        // Guard against re-sending hello/join on every render while open —
        // only once per open transition (keyed by name, which is stable
        // once set for the session).
        if (lastOpenedFor.current === name) return;
        lastOpenedFor.current = name;
        send({ type: 'hello', player_name: name });
        if (rejoin.current) {
            send({ type: 'join_room', room_id: rejoin.current });
        }
    }, [status, name, send]);

    useEffect(() => {
        if (status !== 'open') lastOpenedFor.current = null;
    }, [status]);

    // An invite link outranks the persisted room. Links can land after the
    // open transition (the initial URL resolves late; a runtime link arrives
    // any time), so if hello has already gone out, join now rather than
    // waiting for a reconnect that may never come.
    const followLink = useRef<(url: string | null) => void>(() => {});
    useEffect(() => {
        followLink.current = (url) => {
            const code = extractJoinCode(url)?.trim().toUpperCase();
            if (!code || code === rejoin.current) return;
            rejoin.current = code;
            if (lastOpenedFor.current !== null) send({ type: 'join_room', room_id: code });
        };
    }, [send]);

    useEffect(() => {
        Linking.getInitialURL()
            .then((url) => followLink.current(url))
            .catch(() => {
                // No launch link is readable; the persisted room still applies.
            });
        const sub = Linking.addEventListener('url', (event) => followLink.current(event.url));
        return () => sub.remove();
    }, []);

    const setName = useCallback(
        (next: string) => {
            setNameState(next);
            persistName(next);
        },
        [persistName],
    );

    const leave = useCallback(() => {
        send({ type: 'leave_room' });
        rejoin.current = null;
        persistRoomId(null);
    }, [send, persistRoomId]);

    return { status, home, room, notice, incompatible, skewMs, send, retryConnection: reconnect, isOffline: false, myId: playerId, name, setName, leave };
}

// =====================================================================
// Provider — one socket shared by every screen (home / lobby / table)
// =====================================================================

const GameConnectionContext = createContext<UseGameConnection | null>(null);

/** Mounted once in `app/_layout.tsx`, above the Stack, so navigating between
 *  home/lobby/table never opens a second socket. Reads identity from the
 *  hydrated store — mount this only once `useStore().hydrated` is true. */
export function GameConnectionProvider({ children }: { children: ReactNode }) {
    const playerId = useStore((s) => s.playerId);
    const playerName = useStore((s) => s.playerName);
    const roomId = useStore((s) => s.roomId);
    const setPlayerName = useStore((s) => s.setPlayerName);
    const setRoomId = useStore((s) => s.setRoomId);

    const connection = useGameConnection(playerId, playerName, setPlayerName, setRoomId, roomId);

    // Solo games use the same client-message / room-snapshot boundary as the
    // server. Keeping that seam means every table component works unchanged,
    // while the rules and robot turns run entirely inside the Expo app.
    const [offlineGame, setOfflineGame] = useState<OfflineGame | null>(null);
    const [offlineRoom, setOfflineRoom] = useState<RoomView | null>(null);
    const [offlineNotice, setOfflineNotice] = useState<Notice | null>(null);

    const sendOffline = useCallback((msg: Omit<ClientMessage, 'player_id'>) => {
        if (msg.type === 'create_room' && msg.auto_start && msg.mode !== 'tutorial' && (msg.bots ?? 0) > 0) {
            const game = new OfflineGame({
                playerId,
                playerName: playerName || 'Player',
                roomName: msg.room_name || 'Solo table',
                bots: msg.bots ?? 2,
                difficulty: msg.bot_difficulty ?? 'normal',
                mode: msg.mode,
            });
            setOfflineNotice(null);
            setOfflineGame(game);
            setOfflineRoom(game.view());
            return true;
        }
        if (!offlineGame) return false;
        try {
            offlineGame.dispatch(msg);
            setOfflineNotice(null);
            setOfflineRoom(offlineGame.view());
        } catch (error) {
            if (error instanceof OfflineGameError) {
                setOfflineNotice({ key: error.key, args: error.args, kind: 'error' });
                return true;
            }
            throw error;
        }
        return true;
    }, [offlineGame, playerId, playerName]);

    useEffect(() => {
        if (!offlineGame || !offlineRoom || !offlineGame.isBotWaiting()) return;
        const timer = setTimeout(() => {
            try {
                offlineGame.stepBot();
                setOfflineRoom(offlineGame.view());
            } catch (error) {
                // A robot move is opportunistic. The engine will try its next
                // legal move on the following tick instead of crashing UI.
                setOfflineNotice(error instanceof OfflineGameError
                    ? { key: error.key, args: error.args, kind: 'error' }
                    : { text: 'The robot could not finish its move.', kind: 'error' });
            }
        }, 650);
        return () => clearTimeout(timer);
    }, [offlineGame, offlineRoom]);

    // A dev fixture stands in for the live room. Moves are applied locally by
    // `applyDevMove` rather than posted: the server has never heard of this
    // room and would answer every one with an error banner.
    const devRoom = useStore((s) => s.devRoom);
    const setDevRoom = useStore((s) => s.setDevRoom);
    const liveOrOffline: UseGameConnection = offlineGame
        ? {
              ...connection,
              room: offlineRoom,
              notice: offlineNotice,
              // Solo games never touch the server, so its version is moot.
              incompatible: null,
              skewMs: 0,
              isOffline: true,
              send: (msg) => { void sendOffline(msg); },
              leave: () => {
                  setOfflineGame(null);
                  setOfflineRoom(null);
                  setOfflineNotice(null);
              },
          }
        : {
              ...connection,
              isOffline: false,
              send: (msg) => {
                  if (!sendOffline(msg)) connection.send(msg);
              },
          };

    const value: UseGameConnection = devRoom
        ? {
              ...liveOrOffline,
              room: devRoom,
              // Fixtures are applied locally, so a dropped socket must not
              // disable their controls.
              isOffline: true,
              send: (msg) => setDevRoom(applyDevMove(devRoom, msg)),
              leave: () => setDevRoom(null),
          }
        : liveOrOffline;

    return createElement(GameConnectionContext.Provider, { value }, children);
}

export function useGameConnectionContext(): UseGameConnection {
    const ctx = useContext(GameConnectionContext);
    if (!ctx) throw new Error('useGameConnectionContext must be used inside <GameConnectionProvider>');
    return ctx;
}

/** `deal://join/CODE` (or a legacy `?join=CODE` query, kept for parity with
 *  the web deep link shape). */
function extractJoinCode(url: string | null): string | null {
    if (!url) return null;
    try {
        const parsed = Linking.parse(url);
        const fromPath = parsed.path?.match(/^join\/(.+)$/i)?.[1];
        if (fromPath) return fromPath;
        const fromQuery = parsed.queryParams?.join;
        if (typeof fromQuery === 'string') return fromQuery;
    } catch {
        // malformed deep link — ignore
    }
    return null;
}
