import type { Call } from '../game/useWebRTC';
import { useI18n } from '../i18n';
import VideoTile from './VideoTile';

interface Props {
    call: Call;
    /** How many people are in the call, including you. */
    memberCount: number;
}

/** Join/leave plus mic and camera toggles, with a self preview. */
export default function CallControls({ call, memberCount }: Props) {
    const { t } = useI18n();

    if (!call.supported) {
        return (
            <span
                className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-1 text-xs text-white/45"
                title={call.unsupportedReason ? t(call.unsupportedReason) : undefined}
            >
                🎥 <span className="hidden sm:inline">{t('call.unavailable')}</span>
            </span>
        );
    }

    if (call.status !== 'on') {
        return (
            <span className="flex items-center gap-2">
                <button
                    type="button"
                    className="btn btn-ghost !py-1 !text-xs"
                    disabled={call.status === 'starting'}
                    onClick={call.join}
                    title={t('call.join_title')}
                >
                    {call.status === 'starting' ? t('call.starting') : `🎥 ${t('call.join')}`}
                </button>
                {memberCount > 0 && (
                    <span className="text-xs text-white/50">{t('call.members', { count: memberCount })}</span>
                )}
                {call.error && <span className="text-xs text-rose-300">{t(call.error)}</span>}
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5">
            <VideoTile
                stream={call.localStream}
                self
                camOff={!call.camOn}
                micOff={!call.micOn}
                label={t('call.you')}
                className="h-11 w-16"
            />
            <button
                type="button"
                className={`btn !px-2 !py-1 !text-xs ${call.micOn ? 'btn-ghost' : 'btn-red'}`}
                onClick={call.toggleMic}
                title={t(call.micOn ? 'call.mute' : 'call.unmute')}
            >
                {call.micOn ? '🎙' : '🔇'}
            </button>
            <button
                type="button"
                className={`btn !px-2 !py-1 !text-xs ${call.camOn ? 'btn-ghost' : 'btn-red'}`}
                onClick={call.toggleCam}
                title={t(call.camOn ? 'call.cam_off' : 'call.cam_on')}
            >
                {call.camOn ? '📹' : '🚫'}
            </button>
            <button
                type="button"
                className="btn btn-ghost !px-2 !py-1 !text-xs"
                onClick={call.leave}
                title={t('call.leave_title')}
            >
                {t('call.leave')}
            </button>
        </span>
    );
}
