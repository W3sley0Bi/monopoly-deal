import { useState } from 'react';
import type { Call, CallLayout, VideoQuality } from '../game/useWebRTC';
import { useI18n } from '../i18n';
import VideoTile from './VideoTile';
import Modal from './Modal';

export default function CallControls({ call, memberCount }: { call: Call; memberCount: number }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [startMic, setStartMic] = useState(true);
    const active = call.status === 'on';
    const starting = call.status === 'starting';
    const prefs = call.preferences;
    return <>
        <div className="call-toolbar">
            <button className={`btn btn-ghost call-main-button ${active ? 'call-live' : ''}`} onClick={() => setOpen(true)} aria-label={t(active ? 'call.settings' : 'call.join')} title={t(active ? 'call.settings' : 'call.join')}>
                <span aria-hidden="true">{active ? '●' : '◉'}</span><span className="call-join-label">{t(active ? 'call.settings' : 'call.join')}</span>{memberCount > 0 && <span className="call-count">{memberCount}</span>}
            </button>
            {active && <>
                <button className={`btn btn-ghost call-icon ${!call.micOn ? 'call-disabled' : ''}`} onClick={call.toggleMic} aria-label={t(call.micOn ? 'call.mute' : 'call.unmute')} title={t(call.micOn ? 'call.mute' : 'call.unmute')}>{call.micOn ? '🎙' : '🔇'}</button>
                <button className={`btn btn-ghost call-icon ${!call.camOn ? 'call-disabled' : ''}`} disabled={call.busy} onClick={call.toggleCam} aria-label={t(call.camOn ? 'call.cam_off' : 'call.cam_on')} title={t(call.camOn ? 'call.cam_off' : 'call.cam_on')}>{call.camOn ? '📹' : '🚫'}</button>
            </>}
        </div>
        {call.error && !open && <button className="call-error-short" onClick={() => setOpen(true)}>{t('call.review_error')}</button>}
        {open && <Modal title={t(active ? 'call.settings' : 'call.join')} subtitle={t('call.settings_intro')} onClose={() => { if (starting) call.leave(); setOpen(false); }} footer={<>
            {active ? <><button className="btn btn-red" onClick={() => { call.leave(); setOpen(false); }}>{t('call.leave')}</button><button className="btn btn-gold" onClick={() => setOpen(false)}>{t('call.back_game')}</button></>
                : starting ? <button className="btn btn-ghost" onClick={call.leave}>{t('call.cancel_join')}</button>
                : <><button className="btn btn-ghost" disabled={!call.supported} onClick={() => call.join(false, startMic)}>{t('call.voice_only')}</button><button className="btn btn-gold" disabled={!call.supported} onClick={() => call.join(true, startMic)}>{t('call.with_camera')}</button></>}
        </>}>
            <div className="call-settings">
                {(call.error || !call.supported) && <p role="alert" className="call-error">{t(call.error || call.unsupportedReason || 'call.unavailable')}</p>}
                {starting && <p role="status">{t('call.starting')} {t('call.permission_hint')}</p>}
                {active && <div className="call-preview-row"><VideoTile stream={call.localStream} self mirror={prefs.mirror} camOff={!call.camOn} micOff={!call.micOn} label={t('call.you')} /><div><p className="label-caps">{t('call.you')}</p><p>{t(call.camOn ? 'call.camera_live' : 'call.camera_private')}</p><button className="btn btn-ghost" onClick={() => { setOpen(false); call.setGallery(''); }}>{t('call.gallery')}</button></div></div>}
                <fieldset><legend>{t('call.layout')}</legend><div className="call-layout-options">{(['auto', 'seats', 'strip', 'corner'] as CallLayout[]).map(layout => <button key={layout} className={prefs.layout === layout ? 'selected' : ''} aria-pressed={prefs.layout === layout} onClick={() => call.configure({ layout })}><span aria-hidden="true">{{ auto: '◈', seats: '♧', strip: '▥', corner: '◲' }[layout]}</span>{t(`call.layout.${layout}`)}</button>)}</div><p className="call-help">{t('call.layout_hint')}</p></fieldset>
                <fieldset><legend>{t('call.devices')}</legend><div className="call-device-grid">{(['audio', 'video'] as const).map(kind => <label key={kind}>{t(kind === 'audio' ? 'call.microphone' : 'call.camera')}<select disabled={call.busy} value={kind === 'audio' ? call.microphoneId : call.cameraId} onChange={e => call.setDevice(kind, e.target.value)}><option value="">{t('call.system_default')}</option>{call.devices.filter(d => d.kind === `${kind}input` && d.deviceId).map((device, i) => <option key={device.deviceId} value={device.deviceId}>{device.label || `${t(kind === 'audio' ? 'call.microphone' : 'call.camera')} ${i + 1}`}</option>)}</select></label>)}<label>{t('call.quality')}<select disabled={call.busy} value={call.quality} onChange={e => call.setQuality(e.target.value as VideoQuality)}>{(['low', 'balanced', 'high'] as const).map(q => <option key={q} value={q}>{t(`call.quality.${q}`)}</option>)}</select></label></div><p className="call-help">{t(active ? 'call.device_hint' : 'call.device_permission')}</p></fieldset>
                <fieldset><legend>{t('call.sound_display')}</legend><div className="call-checks">
                    {!active && <label><input type="checkbox" checked={startMic} onChange={e => setStartMic(e.target.checked)} />{t('call.join_mic')}</label>}
                    <label><input type="checkbox" checked={prefs.hideSelf} onChange={e => call.configure({ hideSelf: e.target.checked })} />{t('call.hide_self')}</label>
                    <label><input type="checkbox" checked={prefs.mirror} onChange={e => call.configure({ mirror: e.target.checked })} />{t('call.mirror')}</label>
                    <label><input type="checkbox" checked={prefs.deafened} onChange={e => call.configure({ deafened: e.target.checked })} />{t('call.deafen')}</label>
                    <label className="call-volume">{t('call.volume')}<input type="range" min="0" max="1" step="0.05" value={prefs.volume} onChange={e => call.configure({ volume: Number(e.target.value) })} /><output>{Math.round(prefs.volume * 100)}%</output></label>
                </div></fieldset>
            </div>
        </Modal>}
    </>;
}
