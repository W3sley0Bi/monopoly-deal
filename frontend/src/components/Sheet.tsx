import { useId } from 'react';
import { useDialogFocus } from '../game/useDialogFocus';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useI18n } from '../i18n';

interface Props {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
}

/**
 * A bottom sheet. On a phone this is the right home for secondary detail:
 * it keeps the board in one vertical screen and puts controls in thumb reach.
 */
export default function Sheet({ title, subtitle, onClose, children, footer }: Props) {
    const { t } = useI18n();
    const focusRef = useDialogFocus();
    const titleId = useId();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="sheet-backdrop fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
            {/* Opaque, not translucent: the board behind would otherwise show
                through and fight the text. */}
            <div
                ref={focusRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
                className="game-sheet animate-sheet-up flex max-h-[78vh] min-h-0 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/12 bg-[#08281d] shadow-[0_-20px_50px_-20px_rgb(0_0_0/0.9)]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-white/10 bg-black/25 px-4 py-3">
                    <span aria-hidden className="h-1 w-10 shrink-0 rounded-full bg-white/25" />
                    <div className="min-w-0 flex-1">
                        <h2 id={titleId} className="truncate font-display text-xl tracking-wide text-brass">{title}</h2>
                        {subtitle && <p className="truncate text-xs text-white/55">{subtitle}</p>}
                    </div>
                    <button type="button" className="btn btn-ghost !px-3 !py-1.5" onClick={onClose} aria-label={t('sheet.close')}>
                        ✕
                    </button>
                </div>
                <div className="min-w-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
                {footer && (
                    <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/25 px-4 py-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
