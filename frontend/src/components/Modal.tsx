import { createPortal } from 'react-dom';
import { useId } from 'react';
import { useDialogFocus } from '../game/useDialogFocus';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import { useEffect } from 'react';

interface Props {
    title: string;
    subtitle?: string;
    onClose?: () => void;
    children: ReactNode;
    footer?: ReactNode;
    wide?: boolean;
    /** Rendered in the header, e.g. a countdown ring. */
    corner?: ReactNode;
}

export default function Modal({ title, subtitle, onClose, children, footer, wide, corner }: Props) {
    const { t } = useI18n();
    const focusRef = useDialogFocus();
    const titleId = useId();

    useEffect(() => {
        if (!onClose) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return createPortal(
        <div data-dialog-overlay className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm">
            <div ref={focusRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`game-modal panel animate-pop flex max-h-[92vh] w-full flex-col overflow-hidden ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
                <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-black/25 px-5 py-3">
                    <div>
                        <h2 id={titleId} className="font-display text-2xl tracking-wide text-brass">{title}</h2>
                        {subtitle && <p className="mt-0.5 text-sm text-white/65">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                        {corner}
                        {onClose && (
                            <button type="button" className="btn btn-ghost !px-2.5 !py-1" onClick={onClose} aria-label={t('common.close')}>
                                ✕
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer && (
                    <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/25 px-5 py-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
