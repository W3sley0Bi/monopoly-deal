import { useI18n } from '../i18n';
import { useInstall } from '../game/useInstall';

/**
 * The offer to keep the table on the home screen.
 *
 * Shown where someone is already deciding what to do, not thrown over the
 * game, and it takes no for an answer permanently.
 */
export default function InstallBanner() {
    const { t } = useI18n();
    const { kind, install, dismiss } = useInstall();

    if (kind === 'none') return null;

    return (
        <section className="install-banner panel" aria-label={t('install.title')}>
            <img src="/icon-192.png" alt="" width={44} height={44} />
            <div className="install-copy">
                <strong>{t('install.title')}</strong>
                {/* iOS has no install prompt to raise, so the only thing the
                    page can offer there is the route through Share. */}
                <p>{t(kind === 'ios' ? 'install.ios' : 'install.blurb')}</p>
            </div>
            {kind === 'prompt' && (
                <button type="button" className="btn btn-gold" onClick={install}>
                    {t('install.action')}
                </button>
            )}
            <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1 !text-xs"
                onClick={dismiss}
            >
                {t('install.dismiss')}
            </button>
        </section>
    );
}
