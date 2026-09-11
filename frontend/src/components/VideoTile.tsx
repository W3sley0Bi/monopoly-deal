import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

interface Props {
    stream: MediaStream | null;
    /** Self view: muted so you do not hear yourself, and mirrored. */
    self?: boolean;
    label?: string;
    /** Shown when the camera is off but the call is live. */
    camOff?: boolean;
    micOff?: boolean;
    className?: string;
}

export default function VideoTile({ stream, self, label, camOff, micOff, className = '' }: Props) {
    const { t } = useI18n();
    const ref = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (el.srcObject !== stream) el.srcObject = stream;
    }, [stream]);

    return (
        <div className={`relative overflow-hidden rounded-lg border border-white/20 bg-black/60 shadow-lg ${className}`}>
            <video
                ref={ref}
                autoPlay
                playsInline
                muted={self}
                className={`h-full w-full object-cover ${self ? 'scale-x-[-1]' : ''} ${camOff ? 'opacity-0' : ''}`}
            />
            {camOff && (
                <span className="absolute inset-0 grid place-items-center text-lg" title={t('video.cam_off')}>
                    📷
                </span>
            )}
            {micOff && (
                <span
                    className="absolute bottom-0.5 left-0.5 rounded bg-rose-600/90 px-1 text-[0.6rem] leading-4"
                    title={t('video.mic_off')}
                >
                    🔇
                </span>
            )}
            {label && (
                <span className="absolute bottom-0 right-0 max-w-full truncate bg-black/65 px-1 text-[0.6rem] leading-4">
                    {label}
                </span>
            )}
        </div>
    );
}
