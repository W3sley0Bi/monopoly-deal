import { useState } from 'react';
import type { ChatMessage, LogEntry } from '../types';
import { useI18n } from '../i18n';
import ChatBox from './ChatBox';
import LogList from './LogList';
import Sheet from './Sheet';

interface Props {
    log: LogEntry[];
    chat: ChatMessage[];
    you: string;
    initialTab?: 'log' | 'chat';
    onClose: () => void;
    onSend: (text: string) => void;
}

/** Log and chat as a bottom sheet, for screens too narrow for a side rail. */
export default function TalkSheet({ log, chat, you, initialTab = 'chat', onClose, onSend }: Props) {
    const { t } = useI18n();
    const [tab, setTab] = useState(initialTab);

    return (
        <Sheet title={tab === 'log' ? t('panel.title_log') : t('panel.title_chat')} onClose={onClose}>
            <div className="mb-3 flex gap-2">
                {/* The tab is `id`, not `t`: it must not shadow the translator. */}
                {(['chat', 'log'] as const).map(id => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`btn !py-1.5 !text-sm ${tab === id ? 'btn-gold' : 'btn-ghost'}`}
                    >
                        {id === 'chat' ? `💬 ${t('panel.chat')}` : `📜 ${t('panel.log')}`}
                    </button>
                ))}
            </div>
            {tab === 'log'
                ? <LogList log={log} className="max-h-[52vh]" />
                : <ChatBox chat={chat} you={you} onSend={onSend} className="h-[52vh]" />}
        </Sheet>
    );
}
