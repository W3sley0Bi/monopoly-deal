import { useEffect, useState } from 'react';
import type { ChatMessage, LogEntry } from '../types';
import { useI18n } from '../i18n';
import ChatBox from './ChatBox';
import LogList from './LogList';

interface Props {
    log: LogEntry[];
    chat: ChatMessage[];
    you: string;
    open: boolean;
    onToggle: () => void;
    onSend: (text: string) => void;
}

type Tab = 'log' | 'chat';

/** The right-hand rail: table log and group chat, with an unread badge. */
export default function SidePanel({ log, chat, you, open, onToggle, onSend }: Props) {
    const { t } = useI18n();
    const [tab, setTab] = useState<Tab>('log');
    const [seen, setSeen] = useState(chat.length);

    const chatVisible = open && tab === 'chat';
    const unread = Math.max(0, chat.length - seen);

    useEffect(() => {
        if (chatVisible) setSeen(chat.length);
    }, [chatVisible, chat.length]);

    return (
        <aside
            data-tour="log"
            className={[
                'panel flex shrink-0 flex-col overflow-hidden transition-all',
                // On narrow screens the open rail floats over the table instead
                // of stealing half the width.
                open ? 'w-72 max-lg:fixed max-lg:inset-y-2 max-lg:right-2 max-lg:z-40' : 'w-11',
            ].join(' ')}
        >
            {open ? (
                <div className="flex items-stretch border-b border-white/10 bg-black/25">
                    {/* The tab is `id`, not `t`: it must not shadow the translator. */}
                    {(['log', 'chat'] as Tab[]).map(id => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setTab(id)}
                            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs uppercase tracking-widest transition ${
                                tab === id ? 'bg-white/10 text-brass' : 'text-white/50 hover:text-white/80'
                            }`}
                        >
                            {id === 'log' ? `📜 ${t('panel.log')}` : `💬 ${t('panel.chat')}`}
                            {id === 'chat' && unread > 0 && (
                                <span className="rounded-full bg-rose-500 px-1.5 text-[0.6rem] font-bold text-white">
                                    {unread}
                                </span>
                            )}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={onToggle}
                        className="px-2 text-white/45 hover:text-white"
                        title={t('panel.hide')}
                    >
                        ›
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onToggle}
                    className="relative flex flex-col items-center gap-2 border-b border-white/10 bg-black/25 py-2"
                    title={t('panel.show')}
                >
                    <span>📜</span>
                    <span>💬</span>
                    {unread > 0 && (
                        <span className="absolute right-0.5 top-0.5 rounded-full bg-rose-500 px-1 text-[0.55rem] font-bold">
                            {unread}
                        </span>
                    )}
                </button>
            )}

            {open && tab === 'log' && <LogList log={log} className="flex-1 px-3 py-2" />}

            {chatVisible && <ChatBox chat={chat} you={you} onSend={onSend} className="flex-1" />}
        </aside>
    );
}
