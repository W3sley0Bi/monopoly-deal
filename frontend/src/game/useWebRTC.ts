import { useCallback, useEffect, useRef, useState } from 'react';
import type { RTCEnvelope, RTCSignal } from '../types';

export type CallStatus = 'off' | 'starting' | 'on' | 'error';

export interface Call {
    /** False when the browser will not hand over a camera at all. */
    supported: boolean;
    /** Why it is unsupported, ready to show the user. */
    unsupportedReason?: string;
    status: CallStatus;
    /** Translation key for why the call could not start, if it failed. */
    error?: string;
    localStream: MediaStream | null;
    /** Remote streams by player id. */
    remote: Record<string, MediaStream>;
    micOn: boolean;
    camOn: boolean;
    join: () => void;
    leave: () => void;
    toggleMic: () => void;
    toggleCam: () => void;
}

interface Options {
    myId: string;
    /** Player ids currently in the call, from the server. */
    members: string[];
    sendSignal: (to: string, signal: RTCSignal) => void;
    /** Subscribes to relayed signals; returns an unsubscribe function. */
    subscribe: (handler: (env: RTCEnvelope) => void) => () => void;
    /** Tells the server we are in or out of the call. */
    announce: (joined: boolean) => void;
}

// Small frames: a five-way mesh on a phone should not melt.
const MEDIA: MediaStreamConstraints = {
    video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 24 } },
    audio: { echoCancellation: true, noiseSuppression: true },
};

// On a LAN the host candidates connect directly, so no ICE servers are needed.
// Across the internet (e.g. served through a tunnel) each peer sits behind its
// own NAT and needs STUN to learn its public address, so hand over public STUN
// servers whenever the page is not being served from a private address. A
// relay (TURN) is still absent, so symmetric NATs will fail to connect.
const STUN_SERVERS: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

// localhost, 10/8, 172.16/12, 192.168/16 and .local are all LAN origins.
function isLocalOrigin(host: string): boolean {
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
    if (host.endsWith('.local')) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host)) return true;
    return /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

const RTC_CONFIG: RTCConfiguration = {
    iceServers: isLocalOrigin(window.location.hostname) ? [] : STUN_SERVERS,
};

function mediaSupport(): { ok: boolean; reason?: string } {
    if (typeof navigator === 'undefined') return { ok: false, reason: 'call.err.no_browser_apis' };
    if (!window.isSecureContext) {
        return {
            ok: false,
            reason: 'call.err.insecure_origin',
        };
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        return { ok: false, reason: 'call.err.unsupported_browser' };
    }
    return { ok: true };
}

/**
 * A small mesh of peer connections, one per other player in the call, with
 * offer/answer relayed through the game's websocket. The lower player id always
 * makes the offer, so two peers never offer to each other at once.
 */
export function useWebRTC({ myId, members, sendSignal, subscribe, announce }: Options): Call {
    const [support] = useState(mediaSupport);
    const [status, setStatus] = useState<CallStatus>('off');
    const [error, setError] = useState<string>();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remote, setRemote] = useState<Record<string, MediaStream>>({});
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);

    const peers = useRef(new Map<string, RTCPeerConnection>());
    const streamRef = useRef<MediaStream | null>(null);
    const inCall = useRef(false);

    const dropPeer = useCallback((id: string) => {
        const pc = peers.current.get(id);
        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.close();
            peers.current.delete(id);
        }
        setRemote(prev => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const makePeer = useCallback((id: string) => {
        const existing = peers.current.get(id);
        if (existing) return existing;

        const pc = new RTCPeerConnection(RTC_CONFIG);
        peers.current.set(id, pc);

        streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current!));

        pc.onicecandidate = e => {
            if (e.candidate) sendSignal(id, { kind: 'candidate', candidate: e.candidate.toJSON() });
        };
        pc.ontrack = e => {
            const [stream] = e.streams;
            if (stream) setRemote(prev => ({ ...prev, [id]: stream }));
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') dropPeer(id);
        };
        return pc;
    }, [dropPeer, sendSignal]);

    // Relayed offers, answers and candidates.
    useEffect(() => subscribe(async ({ from, signal }) => {
        if (!inCall.current) return;
        const pc = makePeer(from);
        try {
            if (signal.kind === 'offer') {
                await pc.setRemoteDescription(signal.sdp);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(from, { kind: 'answer', sdp: answer });
            } else if (signal.kind === 'answer') {
                await pc.setRemoteDescription(signal.sdp);
            } else if (signal.kind === 'candidate') {
                await pc.addIceCandidate(signal.candidate);
            }
        } catch (err) {
            // A late candidate for a torn-down peer is normal; keep the call up.
            console.warn('signalling', err);
        }
    }), [makePeer, sendSignal, subscribe]);

    // Open a connection to every other member, and close ones that left.
    useEffect(() => {
        if (status !== 'on') return;
        const others = members.filter(id => id !== myId);

        for (const id of peers.current.keys()) {
            if (!others.includes(id)) dropPeer(id);
        }

        for (const id of others) {
            if (peers.current.has(id)) continue;
            const pc = makePeer(id);
            // Only one side offers, decided by comparing ids.
            if (myId < id) {
                void (async () => {
                    try {
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        sendSignal(id, { kind: 'offer', sdp: offer });
                    } catch (err) {
                        console.warn('offer failed', err);
                    }
                })();
            }
        }
    }, [status, members, myId, makePeer, dropPeer, sendSignal]);

    const leave = useCallback(() => {
        inCall.current = false;
        for (const id of [...peers.current.keys()]) dropPeer(id);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setLocalStream(null);
        setRemote({});
        setStatus('off');
        setError(undefined);
        announce(false);
    }, [announce, dropPeer]);

    const join = useCallback(() => {
        if (!support.ok || status === 'starting' || status === 'on') return;
        setStatus('starting');
        setError(undefined);
        void (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(MEDIA);
                streamRef.current = stream;
                stream.getAudioTracks().forEach(t => (t.enabled = true));
                stream.getVideoTracks().forEach(t => (t.enabled = true));
                setLocalStream(stream);
                setMicOn(true);
                setCamOn(true);
                inCall.current = true;
                setStatus('on');
                announce(true);
            } catch (err) {
                // The call surfaces a key, not a sentence, so every player
                // reads the reason in their own language.
                const message = err instanceof Error && err.name === 'NotAllowedError'
                    ? 'call.err.permission_denied'
                    : err instanceof Error && err.name === 'NotFoundError'
                        ? 'call.err.no_devices'
                        : 'call.err.start_failed';
                setError(message);
                setStatus('error');
            }
        })();
    }, [announce, status, support.ok]);

    const toggleMic = useCallback(() => {
        const tracks = streamRef.current?.getAudioTracks() ?? [];
        const next = !tracks.every(t => t.enabled);
        tracks.forEach(t => (t.enabled = next));
        setMicOn(next);
    }, []);

    const toggleCam = useCallback(() => {
        const tracks = streamRef.current?.getVideoTracks() ?? [];
        const next = !tracks.every(t => t.enabled);
        tracks.forEach(t => (t.enabled = next));
        setCamOn(next);
    }, []);

    // Never leave the camera light on after unmount.
    useEffect(() => () => {
        for (const pc of peers.current.values()) pc.close();
        peers.current.clear();
        streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    return {
        supported: support.ok,
        unsupportedReason: support.reason,
        status,
        error,
        localStream,
        remote,
        micOn,
        camOn,
        join,
        leave,
        toggleMic,
        toggleCam,
    };
}
