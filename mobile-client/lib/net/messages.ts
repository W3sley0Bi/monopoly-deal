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
    /** `payload.game.now_ms - Date.now()` from the last `room` frame, for
     *  countdowns that must agree with the server clock. */
    skewMs: number;
    /** Stamps `player_id` + `player_name` onto every outbound frame. */
    send: (msg: Omit<ClientMessage, 'player_id'>) => void;
    myId: string;
    name: string;
    setName: (name: string) => void;
    /** `leave_room` + clears the held rejoin code. */
    leave: () => void;
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
    const [skewMs, setSkewMs] = useState(0);
    const [name, setNameState] = useState(playerName);

    // Ref, not state — read at send-time, not re-rendered on every change,
    // and mutated directly by the deep link + eviction paths per the spec.
    const rejoin = useRef<string | null>(null);
    const deepLinkConsumed = useRef(false);

    // Seed rejoin from a deep link if present, else the persisted room id.
    useEffect(() => {
        if (deepLinkConsumed.current) return;
        deepLinkConsumed.current = true;
        Linking.getInitialURL().then((url) => {
            const code = extractJoinCode(url);
            if (code) {
                rejoin.current = code.toUpperCase().trim();
            } else if (initialRoomId) {
                rejoin.current = initialRoomId;
            }
        });
    }, [initialRoomId]);

    useEffect(() => {
        const sub = Linking.addEventListener('url', (event) => {
            const code = extractJoinCode(event.url);
            if (code) rejoin.current = code.toUpperCase().trim();
        });
        return () => sub.remove();
    }, []);

    const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearNoticeLater = useCallback(() => {
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    }, []);

    const onMessage = useCallback(
        (msg: ServerMessage) => {
            if (msg.type === 'home') {
                setHome(msg.payload);
                // A home frame while a room is held means eviction — the
                // server ejected us; clear the rejoin. A home frame while
                // already homeless is just the lobby list and must NOT
                // clear a rejoin that hasn't been consumed yet.
                setRoom((prev) => {
                    if (prev !== null) {
                        rejoin.current = null;
                        persistRoomId(null);
                    }
                    return null;
                });
                return;
            }

            if (msg.type === 'room') {
                setRoom(msg.payload);
                setSkewMs(msg.payload.game.now_ms - Date.now());
                rejoin.current = msg.payload.id;
                persistRoomId(msg.payload.id);
                return;
            }

            if (msg.type === 'error') {
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

    const { status, send: sendRaw } = useJsonSocket<ServerMessage, ClientMessage>(SERVER_URL, onMessage);

    const send = useCallback(
        (msg: Omit<ClientMessage, 'player_id'>) => {
            sendRaw({ ...msg, player_id: playerId, player_name: name || undefined } as ClientMessage);
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

    return { status, home, room, notice, skewMs, send, myId: playerId, name, setName, leave };
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
              skewMs: 0,
              send: (msg) => { void sendOffline(msg); },
              leave: () => {
                  setOfflineGame(null);
                  setOfflineRoom(null);
                  setOfflineNotice(null);
              },
          }
        : {
              ...connection,
              send: (msg) => {
                  if (!sendOffline(msg)) connection.send(msg);
              },
          };

    const value: UseGameConnection = devRoom
        ? {
              ...liveOrOffline,
              room: devRoom,
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
