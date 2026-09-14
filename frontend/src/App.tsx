import { useGameAudio } from './game/useGameAudio';
import StartWheel from './components/StartWheel';
import CallAudio from './components/CallAudio';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, HomeView, RoomView, RTCEnvelope, RTCSignal, ServerMessage } from './types';
import { useI18n } from './i18n';
import { useJsonSocket } from './game/useJsonSocket';
import { useWebRTC } from './game/useWebRTC';
import Home from './components/Home';
import RoomLobby from './components/RoomLobby';
import Table from './components/Table';
import { markTutorialSeen, tutorialSeen } from './components/Tutorial';

const ID_KEY = 'md.playerId';
const NAME_KEY = 'md.playerName';
const ROOM_KEY = 'md.roomId';

/**
 * A message from the server, kept as the key it arrived as rather than as
 * finished text: the banner has to rewrite itself when the reader switches
 * language, and only the key can do that. `text` is the server's English,
 * used when an older server sends no key at all.
 */
interface Notice {
    key?: string;
    args?: Record<string, unknown>;
    text: string;
}

function persistentId(): string {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
        id = `p_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(ID_KEY, id);
    }
    return id;
}

function socketUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev the Vite server runs on another port, so target the Go server directly.
    const host = import.meta.env.DEV ? `${window.location.hostname}:8080` : window.location.host;
    return `${proto}//${host}/ws`;
}

export default function App() {
    const { t } = useI18n();
    const [myId] = useState(persistentId);
    const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '');
    const [inviteCode, setInviteCode] = useState(() => new URL(window.location.href).searchParams.get('join')?.trim().toUpperCase() ?? '');
    const [home, setHome] = useState<HomeView | null>(null);
    const [room, setRoom] = useState<RoomView | null>(null);
    const [error, setError] = useState<Notice | null>(null);
    const [tutorial, setTutorial] = useState(false);
    const [skewMs, setSkewMs] = useState(0);

    // Room to re-enter after a reconnect or a page refresh.
    const rejoin = useRef<string | null>(inviteCode || localStorage.getItem(ROOM_KEY));
    // Relayed WebRTC payloads are handed to whoever is listening.
    const signalListeners = useRef(new Set<(env: RTCEnvelope) => void>());

    const onMessage = useCallback((msg: ServerMessage) => {
        switch (msg.type) {
            case 'home':
                setHome(msg.payload);
                // A home frame arrives both on connect and when we are ejected
                // from a table. Only the second case should forget the room,
                // otherwise the reconnect below has nothing to rejoin.
                setRoom(prev => {
                    if (prev) {
                        rejoin.current = null;
                        localStorage.removeItem(ROOM_KEY);
                    }
                    return null;
                });
                break;
            case 'room':
                setInviteCode('');
                if (new URL(window.location.href).searchParams.has('join')) {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('join');
                    window.history.replaceState(null, '', url);
                }
                setRoom(msg.payload);
                rejoin.current = msg.payload.id;
                localStorage.setItem(ROOM_KEY, msg.payload.id);
                setSkewMs(msg.payload.game.now_ms - Date.now());
                break;
            case 'error':
                setError({ key: msg.error_key, args: msg.error_args, text: msg.error });
                // The table we remembered is gone; stop trying to walk back in.
                if (msg.error_key === 'err.no_such_table' || msg.error.includes('no table')) {
                    rejoin.current = null;
                    localStorage.removeItem(ROOM_KEY);
                }
                break;
            case 'rtc_signal':
                for (const listen of signalListeners.current) listen(msg.payload);
                break;
            case 'notice':
                setError({ key: msg.notice_key, args: msg.notice_args, text: msg.notice });
                break;
        }
    }, []);

    const [url] = useState(socketUrl);
    const { status, send: sendRaw } = useJsonSocket<ServerMessage, ClientMessage>(url, onMessage);
    const connected = status === 'open';

    const send = useCallback((msg: ClientMessage) => {
        sendRaw({ player_id: myId, player_name: name, ...msg });
    }, [myId, name, sendRaw]);

    const sendSignal = useCallback((to: string, signal: RTCSignal) => {
        sendRaw({ type: 'rtc_signal', player_id: myId, target_player_id: to, signal });
    }, [myId, sendRaw]);

    const subscribeSignal = useCallback((handler: (env: RTCEnvelope) => void) => {
        signalListeners.current.add(handler);
        return () => signalListeners.current.delete(handler);
    }, []);

    const announceCall = useCallback((joined: boolean) => {
        sendRaw({ type: joined ? 'rtc_join' : 'rtc_leave', player_id: myId, player_name: name });
    }, [myId, name, sendRaw]);

    const call = useWebRTC({
        myId,
        members: room?.call_members ?? [],
        sendSignal,
        subscribe: subscribeSignal,
        announce: announceCall,
    });

    const audio = useGameAudio(room?.game ?? null, room?.radio ?? null);
    const { unlocked: audioUnlocked, unlock: unlockAudio } = audio;
    useEffect(() => {
        if (audioUnlocked) return;
        const unlock = () => { void unlockAudio().catch(() => {}); };
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
        return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    }, [audioUnlocked, unlockAudio]);

    // Drop out of the call when we leave the table behind.
    useEffect(() => {
        if (!room && (call.status === 'on' || call.status === 'starting')) call.leave();
    }, [room, call]);

    // Announce ourselves on every (re)connect, and walk back into our room.
    useEffect(() => {
        if (!connected || !name) return;
        sendRaw({ type: 'hello', player_id: myId, player_name: name });
        if (rejoin.current) {
            sendRaw({ type: 'join_room', player_id: myId, player_name: name, room_id: rejoin.current });
        }
    }, [connected, name, myId, sendRaw]);

    // A practice table against robots is the teaching table: the tour opens by
    // itself the first time, and never again once it has been finished.
    const playingWithBots = Boolean(
        room && room.game.state === 'playing' && room.you_seated
        && room.game.players.some(p => p.bot),
    );
    useEffect(() => {
        if (playingWithBots && !tutorialSeen()) setTutorial(true);
    }, [playingWithBots]);

    // Leaving the table closes the tour.
    useEffect(() => {
        if (!room) setTutorial(false);
    }, [room]);

    useEffect(() => {
        if (!error) return;
        const timer = setTimeout(() => setError(null), 3600);
        return () => clearTimeout(timer);
    }, [error]);

    const changeName = (next: string) => {
        if (next) localStorage.setItem(NAME_KEY, next);
        else localStorage.removeItem(NAME_KEY);
        setName(next);
        if (next) send({ type: 'hello', player_name: next });
    };

    const leaveRoom = () => {
        call.leave();
        rejoin.current = null;
        localStorage.removeItem(ROOM_KEY);
        send({ type: 'leave_room' });
    };

    const startTutorial = (on: boolean) => {
        setTutorial(on);
        // Turning it off from the menu counts as having seen it; turning it on
        // deliberately should let it run again next time too.
        markTutorialSeen(!on);
    };

    // Translated here rather than where it is stored, so the banner follows a
    // language change while it is still on screen.
    const errorText = error ? (error.key ? t(error.key, error.args) : error.text) : '';

    if (room) {
        return <><CallAudio call={call} /><StartWheel game={room.game} skewMs={skewMs} />{room.game.state === 'waiting'
            ? <RoomLobby audio={audio} room={room} error={errorText} call={call} send={send} onLeave={leaveRoom} />
            : <Table audio={audio} room={room} error={errorText} skewMs={skewMs} call={call} tutorial={tutorial} onTutorial={startTutorial} send={send} onLeave={leaveRoom} />}</>;
    }

    return (
        <Home
            inviteCode={inviteCode}
            view={home}
            connected={connected}
            name={name}
            playerId={myId}
            error={errorText}
            onSetName={changeName}
            send={send}
        />
    );
}
