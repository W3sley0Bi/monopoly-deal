import { useEffect, useRef, useState } from 'react';
import type { Call } from '../game/useWebRTC';
import { useI18n } from '../i18n';
function RemoteAudio({ stream, volume }: { stream: MediaStream; volume: number }) {
    const ref = useRef<HTMLAudioElement>(null);
    const [blocked, setBlocked] = useState(false);
    const { t } = useI18n();
    useEffect(() => {
        const el = ref.current!;
        el.srcObject = stream;
        let disposed = false;
        const play = () => { void el.play().then(() => { if (!disposed) setBlocked(false); }).catch(() => { if (!disposed) setBlocked(true); }); };
        play();
        window.addEventListener('pointerdown', play);
        window.addEventListener('keydown', play);
        return () => { disposed = true; window.removeEventListener('pointerdown', play); window.removeEventListener('keydown', play); el.srcObject = null; };
    }, [stream]);
    useEffect(() => { ref.current!.volume = volume; ref.current!.muted = volume === 0; }, [volume]);
    return <><audio ref={ref} autoPlay />{blocked && <button className="btn call-enable-audio" onClick={() => { void ref.current!.play().then(() => setBlocked(false)).catch(() => {}); }}>{t('call.enable_audio')}</button>}</>;
}
export default function CallAudio({ call }: { call: Call }) {
    return <>{Object.entries(call.remote).map(([id, stream]) => <RemoteAudio key={id} stream={stream} volume={call.preferences.deafened || call.mutedPeers.includes(id) ? 0 : call.preferences.volume} />)}</>;
}
