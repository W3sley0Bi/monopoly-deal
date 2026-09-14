import { useCallback, useEffect, useRef, useState } from 'react';
import type { RTCEnvelope, RTCSignal } from '../types';

export type CallStatus = 'off' | 'starting' | 'on' | 'error';

export type VideoQuality = 'low' | 'balanced' | 'high';
export type CallLayout = 'auto' | 'seats' | 'strip' | 'corner';
export interface CallPreferences { layout: CallLayout; hideSelf: boolean; mirror: boolean; volume: number; deafened: boolean; }
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
    gallery: string | null;
    setGallery: (id: string | null) => void;
    mutedPeers: string[];
    mutePeer: (id: string) => void;
    devices: MediaDeviceInfo[];
    cameraId: string;
    microphoneId: string;
    quality: VideoQuality;
    busy: boolean;
    remoteMedia: Record<string, { micOn: boolean; camOn: boolean }>;
    preferences: CallPreferences;
    configure: (patch: Partial<CallPreferences>) => void;
    setDevice: (kind: 'audio' | 'video', id: string) => void;
    setQuality: (quality: VideoQuality) => void;
    join: (camera?: boolean, microphone?: boolean) => void;
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

const VIDEO = {
    low: { width: { ideal: 320 }, height: { ideal: 180 }, frameRate: { ideal: 15, max: 15 } },
    balanced: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 24 } },
    high: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 24 } },
};
const DEFAULTS: CallPreferences = { layout: 'auto', hideSelf: false, mirror: true, volume: 1, deafened: false };
function savedPreferences(): CallPreferences {
    try {
        const saved = JSON.parse(localStorage.getItem('md.call.preferences') || '{}');
        return { ...DEFAULTS, layout: ['auto', 'seats', 'strip', 'corner'].includes(saved.layout) ? saved.layout : 'auto',
            hideSelf: saved.hideSelf === true, mirror: saved.mirror !== false,
            volume: typeof saved.volume === 'number' ? Math.max(0, Math.min(1, saved.volume)) : 1 };
    } catch { return DEFAULTS; }
}
function mediaError(err: unknown): string {
    return err instanceof Error && err.name === 'NotAllowedError' ? 'call.err.permission_denied'
        : err instanceof Error && err.name === 'NotFoundError' ? 'call.err.no_devices' : 'call.err.start_failed';
}

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

    const [gallery, setGallery] = useState<string | null>(null);
    const [mutedPeers, setMutedPeers] = useState<string[]>([]);
    const mutePeer = useCallback((id: string) => setMutedPeers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]), []);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [cameraId, setCameraId] = useState('');
    const [microphoneId, setMicrophoneId] = useState('');
    const [quality, setQualityState] = useState<VideoQuality>('balanced');
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const generation = useRef(0);
    const mediaState = useRef({ micOn: true, camOn: true });
    const [remoteMedia, setRemoteMedia] = useState<Call['remoteMedia']>({});
    const [preferences, setPreferences] = useState(savedPreferences);
    const configure = useCallback((patch: Partial<CallPreferences>) => setPreferences(prev => {
        const next = { ...prev, ...patch };
        try { localStorage.setItem('md.call.preferences', JSON.stringify(next)); } catch { /* Storage may be disabled. */ }
        return next;
    }), []);
    const refreshDevices = useCallback(() => {
        void navigator.mediaDevices?.enumerateDevices().then(setDevices).catch(() => {});
    }, []);
    useEffect(() => {
        navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
        return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices);
    }, [refreshDevices]);
    const candidates = useRef(new Map<string, RTCIceCandidateInit[]>());
    const peers = useRef(new Map<string, RTCPeerConnection>());
    const streamRef = useRef<MediaStream | null>(null);
    const inCall = useRef(false);

    const dropPeer = useCallback((id: string) => {
        const pc = peers.current.get(id);
        if (pc) {
            pc.onicecandidate = null;
            pc.ontrack = null;
            pc.onconnectionstatechange = null;
            pc.close();
            peers.current.delete(id);
        }
        candidates.current.delete(id);
        setRemoteMedia(prev => { const next = { ...prev }; delete next[id]; return next; });
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

        const stream = streamRef.current!;
        if (myId < id) for (const kind of ['audio', 'video'] as const) {
            pc.addTransceiver(stream.getTracks().find(track => track.kind === kind) ?? kind,
                { direction: 'sendrecv', streams: [stream] });
        }

        pc.onicecandidate = e => {
            if (e.candidate) sendSignal(id, { kind: 'candidate', candidate: e.candidate.toJSON() });
        };
        pc.ontrack = e => {
            const [stream] = e.streams;
            if (stream) setRemote(prev => ({ ...prev, [id]: stream }));
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') sendSignal(id, { kind: 'media', ...mediaState.current });
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') dropPeer(id);
        };
        return pc;
    }, [dropPeer, sendSignal, myId]);

    // Relayed offers, answers and candidates.
    useEffect(() => subscribe(async ({ from, signal }) => {
        if (!inCall.current) return;
        if (signal.kind === 'media') {
            setRemoteMedia(prev => ({ ...prev, [from]: { micOn: signal.micOn, camOn: signal.camOn } }));
            return;
        }
        const pc = makePeer(from);
        try {
            if (signal.kind === 'offer') {
                await pc.setRemoteDescription(signal.sdp);
                // Answer on the offered transceivers; pre-creating our own on
                // this side would leave the offered media receive-only.
                for (const transceiver of pc.getTransceivers()) {
                    const stream = streamRef.current;
                    if (!stream || !inCall.current) return;
                    const track = stream.getTracks().find(t => t.kind === transceiver.receiver.track.kind);
                    transceiver.direction = 'sendrecv';
                    transceiver.sender.setStreams(stream);
                    await transceiver.sender.replaceTrack(track ?? null);
                }
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal(from, { kind: 'answer', sdp: answer });
            } else if (signal.kind === 'answer') {
                await pc.setRemoteDescription(signal.sdp);
            } else if (signal.kind === 'candidate') {
                if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
                else candidates.current.set(from, [...(candidates.current.get(from) ?? []), signal.candidate]);
            }
            if (pc.remoteDescription) {
                const queued = candidates.current.get(from) ?? [];
                candidates.current.delete(from);
                for (const candidate of queued) await pc.addIceCandidate(candidate);
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

    const publishMedia = useCallback((patch: Partial<typeof mediaState.current>) => {
        mediaState.current = { ...mediaState.current, ...patch };
        setMicOn(mediaState.current.micOn);
        setCamOn(mediaState.current.camOn);
        for (const id of peers.current.keys()) sendSignal(id, { kind: 'media', ...mediaState.current });
    }, [sendSignal]);

    const leave = useCallback(() => {
        generation.current++;
        busyRef.current = false;
        setBusy(false);
        inCall.current = false;
        for (const id of [...peers.current.keys()]) dropPeer(id);
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setLocalStream(null);
        setRemote({});
        setRemoteMedia({});
        setGallery(null);
        setMutedPeers([]);
        setStatus('off');
        setError(undefined);
        announce(false);
    }, [announce, dropPeer]);

    const join = useCallback((camera = true, microphone = true) => {
        if (!support.ok || busyRef.current || inCall.current) return;
        const token = ++generation.current;
        busyRef.current = true;
        setBusy(true);
        setStatus('starting');
        setError(undefined);
        void (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, ...(microphoneId ? { deviceId: { ideal: microphoneId } } : {}) },
                    video: camera ? { ...VIDEO[quality], ...(cameraId ? { deviceId: { ideal: cameraId } } : {}) } : false,
                });
                if (token !== generation.current) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                stream.getAudioTracks().forEach(t => { t.enabled = microphone; });
                setLocalStream(stream);
                publishMedia({ micOn: microphone, camOn: camera });
                inCall.current = true;
                setStatus('on');
                refreshDevices();
                announce(true);
            } catch (err) {
                if (token === generation.current) { setError(mediaError(err)); setStatus('error'); }
            } finally {
                if (token === generation.current) { busyRef.current = false; setBusy(false); }
            }
        })();
    }, [announce, support.ok, cameraId, microphoneId, quality, publishMedia, refreshDevices]);

    const replaceInput = useCallback(async (kind: 'audio' | 'video', id: string, nextQuality: VideoQuality, turnOff = false) => {
        if (!inCall.current || busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        setError(undefined);
        const token = generation.current;
        let acquired: MediaStream | undefined;
        try {
            if (!turnOff) acquired = await navigator.mediaDevices.getUserMedia({
                [kind]: { ...(kind === 'video' ? VIDEO[nextQuality] : { echoCancellation: true, noiseSuppression: true }), ...(id ? { deviceId: { exact: id } } : {}) },
            });
            if (token !== generation.current) { acquired?.getTracks().forEach(t => t.stop()); return; }
            const track = acquired?.getTracks()[0] ?? null;
            if (track && kind === 'audio') track.enabled = mediaState.current.micOn;
            const old = streamRef.current!.getTracks().find(t => t.kind === kind);
            const senders = [...peers.current.values()].flatMap(pc => pc.getTransceivers())
                .filter(tr => tr.receiver.track.kind === kind).map(tr => tr.sender);
            const results = await Promise.allSettled(senders.map(sender => sender.replaceTrack(track)));
            if (results.some(r => r.status === 'rejected')) {
                await Promise.allSettled(senders.map(sender => sender.replaceTrack(old ?? null)));
                throw new Error('replace failed');
            }
            if (token !== generation.current) { acquired?.getTracks().forEach(t => t.stop()); return; }
            if (old) { streamRef.current!.removeTrack(old); old.stop(); }
            if (track) streamRef.current!.addTrack(track);
            setLocalStream(new MediaStream(streamRef.current!.getTracks()));
            if (kind === 'video') { setCameraId(id); setQualityState(nextQuality); publishMedia({ camOn: !turnOff }); }
            else setMicrophoneId(id);
            refreshDevices();
        } catch (err) {
            acquired?.getTracks().forEach(t => t.stop());
            if (token === generation.current) setError(mediaError(err));
        } finally {
            if (token === generation.current) { busyRef.current = false; setBusy(false); }
        }
    }, [publishMedia, refreshDevices]);

    const toggleMic = useCallback(() => {
        if (!inCall.current) return;
        const next = !mediaState.current.micOn;
        streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
        publishMedia({ micOn: next });
    }, [publishMedia]);
    const toggleCam = useCallback(() => {
        void replaceInput('video', cameraId, quality, mediaState.current.camOn);
    }, [replaceInput, cameraId, quality]);
    const setDevice = useCallback((kind: 'audio' | 'video', id: string) => {
        if (!inCall.current || (kind === 'video' && !mediaState.current.camOn)) {
            if (kind === 'video') setCameraId(id); else setMicrophoneId(id);
        } else void replaceInput(kind, id, quality);
    }, [replaceInput, quality]);
    const setQuality = useCallback((next: VideoQuality) => {
        if (inCall.current && mediaState.current.camOn) void replaceInput('video', cameraId, next);
        else setQualityState(next);
    }, [replaceInput, cameraId]);

    // Never leave the camera light on after unmount.
    useEffect(() => () => {
        generation.current++;
        inCall.current = false;
        for (const pc of peers.current.values()) pc.close();
        peers.current.clear();
        streamRef.current?.getTracks().forEach(t => t.stop());
    }, []);

    return {
        gallery, setGallery, mutedPeers, mutePeer, devices, cameraId, microphoneId, quality, busy, remoteMedia, preferences, configure, setDevice, setQuality,
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
