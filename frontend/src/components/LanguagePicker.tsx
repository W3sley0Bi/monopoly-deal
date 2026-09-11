import { LANG_FLAG, LANG_LABEL, LANGS, useI18n } from '../i18n';

interface Props {
    /** `pills` for a row of buttons, `menu` for a stack inside a dropdown. */
    variant?: 'pills' | 'menu';
}

/**
 * Picks the language for this device only. The table itself is language-free:
 * everyone reads the same game in whatever they chose.
 */
export default function LanguagePicker({ variant = 'pills' }: Props) {
    const { lang, setLang, t } = useI18n();

    if (variant === 'menu') {
        return (
            <div className="border-t border-white/10 px-3 py-2">
                <p className="label-caps mb-1.5">{t('common.language')}</p>
                <div className="flex gap-1.5">
                    {LANGS.map(code => (
                        <button
                            key={code}
                            type="button"
                            onClick={() => setLang(code)}
                            className={`btn !px-2 !py-1 !text-xs ${lang === code ? 'btn-gold' : 'btn-ghost'}`}
                            title={LANG_LABEL[code]}
                        >
                            {LANG_FLAG[code]} {code.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <span className="flex items-center gap-1" title={t('common.language')}>
            {LANGS.map(code => (
                <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-label={LANG_LABEL[code]}
                    className={`rounded-lg px-1.5 py-0.5 text-sm transition ${
                        lang === code ? 'bg-brass/25 ring-1 ring-brass' : 'opacity-60 hover:opacity-100'
                    }`}
                >
                    {LANG_FLAG[code]}
                </button>
            ))}
        </span>
    );
}
