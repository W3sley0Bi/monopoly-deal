import { useState } from 'react';
import type { RoomView } from '../types';
import { useI18n } from '../i18n';
import Modal from './Modal';

export default function RoomInvite({ room }: { room: RoomView }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [manual, setManual] = useState(false);
    const link = new URL(window.location.pathname, window.location.origin);
    link.searchParams.set('join', room.id);
    return <>
        <button className="room-invite-button" onClick={() => setOpen(true)} title={t('invite.open')} aria-label={t('invite.open')}><span aria-hidden="true">{room.private ? '▣' : '↗'}</span> {room.id}</button>
        {open && <Modal title={t('invite.title')} subtitle={t(room.private ? 'invite.private_hint' : 'invite.public_hint')} onClose={() => setOpen(false)}>
            <div className="invite-content"><span className="label-caps">{t('invite.code')}</span><strong className="invite-code">{room.id}</strong><p>{t('invite.auto_join')}</p><label>{t('invite.link')}<input readOnly value={link.href} onFocus={e => e.target.select()} /></label><button className="btn btn-gold" onClick={() => { void navigator.clipboard?.writeText(link.href).then(() => { setCopied(true); setManual(false); }).catch(() => setManual(true)); if (!navigator.clipboard) setManual(true); }}>{t(copied ? 'invite.copied' : 'invite.copy')}</button>{manual && <p role="status">{t('invite.manual')}</p>}</div>
        </Modal>}
    </>;
}
