import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import Avatar from './Avatar';

interface Props {
    stream: MediaStream | null;
    self?: boolean;
    mirror?: boolean;
    label?: string;
    camOff?: boolean;
    micOff?: boolean;
    className?: string;
    onExpand?: () => void;
}

/** Visuals are always silent. CallAudio owns playback across every layout. */
export default function VideoTile({ stream, self, mirror = true, label = '', camOff, micOff, className = '', onExpand }: Props) {
    const { t } = useI18n();
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.srcObject = stream;
        return () => { el.srcObject = null; };
    }, [stream]);
    return (
        <div className={`call-video ${className}`}>
            <video ref={ref} autoPlay playsInline muted className={`${self && mirror ? 'call-mirrored' : ''} ${camOff || !stream ? 'invisible' : ''}`} />
            {(camOff || !stream) && <div className="call-avatar"><Avatar id={label} name={label} size={44} /><span>{t(camOff ? 'video.cam_off' : 'call.connecting')}</span></div>}
            <div className="call-video-caption"><span>{label}</span>{micOff && <span title={t('video.mic_off')} aria-label={t('video.mic_off')}>🔇</span>}</div>
            {onExpand && <button className="call-expand" onClick={onExpand} aria-label={t('call.expand_person', { name: label })} title={t('call.expand_person', { name: label })}>⛶</button>}
        </div>
    );
}
