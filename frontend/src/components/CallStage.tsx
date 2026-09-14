import { useState } from 'react';
import type { Call } from '../game/useWebRTC';
import type { RoomView } from '../types';
import { useI18n } from '../i18n';
import VideoTile from './VideoTile';
import Modal from './Modal';

export function ParticipantVideo({ call, id, name, self, className = '' }: { call: Call; id: string; name: string; self?: boolean; className?: string }) {
    return <VideoTile stream={self ? call.localStream : call.remote[id] ?? null} self={self} mirror={call.preferences.mirror} label={name}
        camOff={self ? !call.camOn : call.remoteMedia[id]?.camOn === false} micOff={self ? !call.micOn : call.remoteMedia[id]?.micOn === false}
        className={className} onExpand={() => call.setGallery(id)} />;
}
export default function CallStage({ call, room, seated = false }: { call: Call; room: RoomView; seated?: boolean }) {
    const { t } = useI18n();
    const [collapsed, setCollapsed] = useState(false);
    const [cornerLeft, setCornerLeft] = useState(false);
    if (call.status !== 'on') return null;
    const members = [...new Set([room.you, ...room.call_members])];
    const names = [...room.game.players, ...room.spectators];
    const name = (id: string) => id === room.you ? t('call.you') : names.find(p => p.id === id)?.name ?? t('call.participant');
    const visible = members.filter(id => !(id === room.you && call.preferences.hideSelf));
    const dock = seated ? visible.filter(id => id === room.you || !room.game.players.some(p => p.id === id)) : visible;
    const corner = seated || call.preferences.layout === 'corner';
    const focused = call.gallery && members.includes(call.gallery) ? call.gallery : null;
    const tile = (id: string) => <ParticipantVideo key={id} call={call} id={id} name={name(id)} self={id === room.you} />;
    return <>
        <section className={`call-stage ${corner ? 'call-corner' : 'call-strip'} ${seated ? 'call-seat-dock' : ''} ${cornerLeft ? 'call-corner-left' : ''} ${collapsed ? 'call-collapsed' : ''}`} aria-label={t('call.people')}>
            <div className="call-stage-header"><span><i />{t('call.members', { count: members.length })}</span><div>
                {corner && <button title={t('call.move_panel')} aria-label={t('call.move_panel')} onClick={() => setCornerLeft(v => !v)}>⇄</button>}
                <button onClick={() => call.setGallery('')} title={t('call.gallery')} aria-label={t('call.gallery')}>⛶</button>
                <button onClick={() => setCollapsed(v => !v)} title={t(collapsed ? 'call.show_video' : 'call.hide_video')} aria-label={t(collapsed ? 'call.show_video' : 'call.hide_video')} aria-expanded={!collapsed}>{collapsed ? '+' : '−'}</button>
            </div></div>
            {!collapsed && dock.length > 0 && <div className="call-stage-tiles">{dock.map(tile)}</div>}
            {!collapsed && dock.length === 0 && <p className="call-help">{t(seated ? 'call.at_seats' : 'call.self_hidden')}</p>}
        </section>
        {call.gallery !== null && <Modal title={t('call.gallery')} subtitle={t('call.gallery_hint')} wide onClose={() => call.setGallery(null)} footer={<button className="btn btn-gold" onClick={() => call.setGallery(null)}>{t('call.back_game')}</button>}>
            {focused && <div className="call-focused">{tile(focused)}<button className="btn btn-ghost" onClick={() => call.setGallery('')}>{t('call.all_people')}</button></div>}
            <div className={`call-gallery ${focused ? 'call-gallery-small' : ''}`}>{visible.map(id => <div key={id}>{tile(id)}{id !== room.you && <button className="call-person-mute" aria-pressed={call.mutedPeers.includes(id)} onClick={() => call.mutePeer(id)}>{t(call.mutedPeers.includes(id) ? 'call.hear_person' : 'call.mute_person', { name: name(id) })}</button>}</div>)}</div>
            {visible.length === 0 && <p>{t('call.self_hidden')}</p>}
        </Modal>}
    </>;
}
