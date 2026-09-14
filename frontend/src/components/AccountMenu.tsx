import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { NARROW, useMediaQuery } from '../game/useMediaQuery';
import Avatar from './Avatar';
import LanguagePicker from './LanguagePicker';
import Modal from './Modal';

interface Props {
    playerId: string;
    name: string;
    onSetName: (name: string) => void;
}

/**
 * Identity and language live behind one trigger: the avatar and name a player
 * already recognises as theirs. A phone gets a modal, wide enough to hold the
 * keyboard without fighting the rest of the page; anything wider gets a
 * dropdown anchored to the trigger, since there is room to spare beside it.
 */
export default function AccountMenu({ playerId, name, onSetName }: Props) {
    const { t } = useI18n();
    const narrow = useMediaQuery(NARROW);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(name);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) setDraft(name);
    }, [open, name]);

    // A dropdown that only closes by its own button is a trap on a touch
    // screen, so any press outside it closes things too.
    useEffect(() => {
        if (!open || narrow) return;
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Element | null;
            if (target && rootRef.current?.contains(target)) return;
            setOpen(false);
        };
        window.addEventListener('pointerdown', onPointerDown);
        return () => window.removeEventListener('pointerdown', onPointerDown);
    }, [open, narrow]);

    const save = () => {
        const next = draft.trim();
        if (next && next !== name) onSetName(next);
        setOpen(false);
    };

    const body = (
        <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
                <span className="label-caps">{t('home.your_name')}</span>
                <div className="flex gap-2">
                    <input
                        value={draft}
                        maxLength={16}
                        placeholder={t('home.name_placeholder')}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && draft.trim() && save()}
                        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-base outline-none focus:border-brass"
                    />
                    <button
                        type="button"
                        className="btn btn-gold shrink-0"
                        disabled={!draft.trim()}
                        onClick={save}
                    >
                        {t('common.save')}
                    </button>
                </div>
            </label>
            <div>
                <p className="label-caps mb-1.5">{t('common.language')}</p>
                <LanguagePicker />
            </div>
        </div>
    );

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                className="flex items-center gap-2 rounded-full bg-black/30 px-2 py-1"
                onClick={() => setOpen(o => !o)}
                aria-haspopup={narrow ? 'dialog' : 'menu'}
                aria-expanded={open}
            >
                <Avatar id={playerId} name={name} size={28} />
                <span className="text-sm font-semibold">{name}</span>
            </button>

            {open && narrow && (
                <Modal title={t('home.account')} onClose={() => setOpen(false)}>
                    {body}
                </Modal>
            )}

            {open && !narrow && (
                <div
                    role="menu"
                    className="account-dropdown panel absolute right-0 top-[calc(100%+8px)] z-40 w-72 animate-pop p-4"
                >
                    {body}
                </div>
            )}
        </div>
    );
}
