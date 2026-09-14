import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n';
import { useDialogFocus } from '../game/useDialogFocus';
import { markTutorialSeen } from './Tutorial';

/** Long enough to read and take a breath, short enough not to need a button. */
const LEAVE_MS = 6000;

/**
 * The end of the tutorial.
 *
 * A scripted table has nothing left to do once the last lesson is done — no
 * rematch, no opponent to play on against — so it says its piece and takes the
 * player back to where the real tables are.
 */
export default function TutorialDone({ onLeave }: { onLeave: () => void }) {
    const { t } = useI18n();
    const focus = useDialogFocus();
    const [left, setLeft] = useState(Math.round(LEAVE_MS / 1000));

    useEffect(() => {
        markTutorialSeen(true);
        const tick = window.setInterval(
            () => setLeft(n => Math.max(0, n - 1)),
            1000,
        );
        const timer = window.setTimeout(onLeave, LEAVE_MS);
        return () => {
            window.clearInterval(tick);
            window.clearTimeout(timer);
        };
    }, [onLeave]);

    return createPortal(
        <div className="tutorial-done-overlay">
            <div
                className="tutorial-done panel"
                ref={focus}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
            >
                <img src="/icon-192.png" alt="" width={72} height={72} />
                <h2>{t('tutorial.welcome')}</h2>
                <p>{t('tutorial.welcome_body')}</p>
                <button type="button" className="btn btn-gold !py-2.5 !text-lg" onClick={onLeave}>
                    {t('tutorial.welcome_action')}
                </button>
                <span aria-live="polite">{t('tutorial.welcome_soon', { seconds: left })}</span>
            </div>
        </div>,
        document.body,
    );
}
