import Modal from './Modal';
import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import { useI18n } from '../i18n';
import Avatar from './Avatar';
import GifPicker, { type GifResult } from './GifPicker';
import { gifMessageInfo, GIF_MESSAGE_PREFIX } from './gifMessages';
import './GifPicker.css';

interface Props {
    chat: ChatMessage[];
    you: string;
    onSend: (text: string) => void;
    className?: string;
}

function clock(ms: number): string {
    return new Date(ms).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function GifMessage({
    url,
    sourceUrl,
    name,
}: {
    url: string;
    sourceUrl: string;
    name: string;
}) {
    const { t } = useI18n();
    const [playing, setPlaying] = useState(false);
    return (
        <div className="chat-gif-message">
            <button
                type="button"
                className={`chat-gif-poster ${playing ? 'is-playing' : ''}`}
                onClick={() => setPlaying((value) => !value)}
                aria-label={playing ? t('gif.pause') : t('gif.play')}
            >
                {playing ? (
                    <img src={url} alt={t('gif.from', { name })} />
                ) : (
                    <>
                        <span className="chat-gif-badge">GIF</span>
                        <span>{t('gif.click_to_play')}</span>
                    </>
                )}
            </button>
            <a
                className="chat-gif-source"
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
            >
                {t('gif.source')}
            </a>
        </div>
    );
}

export default function ChatBox({ chat, you, onSend, className = '' }: Props) {
    const { t, tChat } = useI18n();
    const [draft, setDraft] = useState('');
    const [gifOpen, setGifOpen] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, [chat.length]);

    const submit = () => {
        const text = draft.trim();
        if (!text) return;
        onSend(text);
        setDraft('');
    };

    return (
        <div className={`flex min-h-0 flex-col ${className}`}>
            <div className="flex-1 overflow-y-auto px-2 py-2">
                {chat.length === 0 && (
                    <p className="px-1 py-3 text-xs italic text-white/35">
                        {t('chat.empty')}
                    </p>
                )}
                {/* tChat renders server notices in the reader's language and
                    leaves player messages exactly as they were typed. */}
                {chat.map((m) =>
                    m.system ? (
                        <p
                            key={m.id}
                            className="px-1 py-1 text-center text-[0.65rem] uppercase tracking-wide text-white/35"
                        >
                            {tChat(m)}
                        </p>
                    ) : (
                        <div
                            key={m.id}
                            className={`mb-1.5 flex gap-1.5 ${m.player_id === you ? 'flex-row-reverse' : ''}`}
                        >
                            <Avatar
                                id={m.player_id}
                                name={m.name}
                                size={22}
                                className="mt-0.5"
                            />
                            <div
                                className={`max-w-[80%] rounded-xl px-2 py-1 ${
                                    m.player_id === you
                                        ? 'bg-brass/25'
                                        : 'bg-black/35'
                                }`}
                            >
                                <p className="flex items-baseline gap-1.5">
                                    <span className="text-[0.65rem] font-bold text-white/70">
                                        {m.name}
                                    </span>
                                    <span className="text-[0.55rem] text-white/35">
                                        {clock(m.at_ms)}
                                    </span>
                                </p>
                                {gifMessageInfo(m.text) ? (
                                    <GifMessage
                                        url={gifMessageInfo(m.text)!.url}
                                        sourceUrl={
                                            gifMessageInfo(m.text)!.sourceUrl
                                        }
                                        name={m.name}
                                    />
                                ) : (
                                    <p className="text-xs break-words whitespace-pre-wrap">
                                        {tChat(m)}
                                    </p>
                                )}
                            </div>
                        </div>
                    ),
                )}
                <div ref={endRef} />
            </div>

            <div className="relative flex items-center gap-1.5 border-t border-white/10 bg-black/25 px-2 py-2">
                {gifOpen && (
                    <Modal title={t('gif.aria_picker')} onClose={() => setGifOpen(false)}>
                    <GifPicker
                        embedded
                        onClose={() => setGifOpen(false)}
                        onSelect={(gif: GifResult) => {
                            // Send the original GIF URL; tracking parameters were
                            // removed when the result was fetched to keep it short.
                            onSend(`${GIF_MESSAGE_PREFIX}${gif.gifUrl}`);
                            setGifOpen(false);
                        }}
                    />
                    </Modal>
                )}
                <button
                    type="button"
                    className={`chat-gif-button ${gifOpen ? 'is-active' : ''}`}
                    onClick={() => setGifOpen((value) => !value)}
                    aria-label={t('gif.send')}
                    aria-expanded={gifOpen}
                >
                    GIF
                </button>
                <input
                    id="chat-input"
                    name="chat-input"
                    autoComplete="off"
                    value={draft}
                    maxLength={400}
                    placeholder={t('chat.placeholder')}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-brass"
                />
                <button
                    type="button"
                    className="btn btn-gold !px-2.5 !py-1.5 !text-xs"
                    disabled={!draft.trim()}
                    onClick={submit}
                >
                    {t('chat.send')}
                </button>
            </div>
        </div>
    );
}
