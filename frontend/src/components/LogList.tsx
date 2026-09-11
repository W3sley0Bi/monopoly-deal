import { useEffect, useRef } from 'react';
import type { LogEntry } from '../types';
import { useI18n } from '../i18n';

/** The table log, scrolled to the newest line. */
export default function LogList({ log, className = '' }: { log: LogEntry[]; className?: string }) {
    const { t, tLog } = useI18n();
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, [log.length]);

    return (
        <div className={`overflow-y-auto text-xs leading-relaxed ${className}`}>
            {log.length === 0 && <p className="italic text-white/35">{t('log.empty')}</p>}
            {log.map((entry, i) => {
                // Turn and win lines are styled by their marks, so the line has
                // to be translated before we can tell them apart.
                const line = tLog(entry);
                return (
                    <p
                        key={i}
                        className={[
                            'border-b border-white/5 py-1',
                            line.startsWith('—') ? 'font-display text-sm tracking-wide text-brass' : 'text-white/75',
                            line.startsWith('🏆') ? '!text-emerald-300' : '',
                        ].join(' ')}
                    >
                        {line}
                    </p>
                );
            })}
            <div ref={endRef} />
        </div>
    );
}
