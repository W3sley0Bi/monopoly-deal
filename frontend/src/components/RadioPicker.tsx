import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import { useI18n } from '../i18n';
import type { RadioState } from '../types';

export interface Station {
    name: string;
    url: string;
    home?: string;
    /** A short line under the name: genre, country, bitrate. */
    note?: string;
}

/**
 * Handpicked free streams, all https so they play on a table served over
 * https, and all checked to answer with audio rather than a redirect page.
 */
export const PRESET_STATIONS: Station[] = [
    { name: 'Radio Paradise — Main Mix', url: 'https://stream.radioparadise.com/mp3-192', home: 'https://radioparadise.com', note: 'Eclectic · listener-funded' },
    { name: 'Radio Paradise — Mellow', url: 'https://stream.radioparadise.com/mellow-192', home: 'https://radioparadise.com', note: 'Calm · good under table talk' },
    { name: 'Radio Paradise — Rock', url: 'https://stream.radioparadise.com/rock-192', home: 'https://radioparadise.com', note: 'Rock mix' },
    { name: 'Radio Paradise — Global', url: 'https://stream.radioparadise.com/global-192', home: 'https://radioparadise.com', note: 'World · beats' },
    { name: 'FIP', url: 'https://icecast.radiofrance.fr/fip-midfi.mp3', home: 'https://www.radiofrance.fr/fip', note: 'Paris · no ads, no jingles' },
    { name: 'FIP Jazz', url: 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3', home: 'https://www.radiofrance.fr/fip', note: 'Jazz all day' },
    { name: 'FIP Groove', url: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3', home: 'https://www.radiofrance.fr/fip', note: 'Funk · soul' },
    { name: 'FIP Rock', url: 'https://icecast.radiofrance.fr/fiprock-midfi.mp3', home: 'https://www.radiofrance.fr/fip', note: 'Rock' },
    { name: 'KEXP Seattle', url: 'https://kexp.streamguys1.com/kexp160.aac', home: 'https://kexp.org', note: 'Indie · human-picked' },
    { name: '1.FM Lo-Fi', url: 'https://strm112.1.fm/lofi_mobile_mp3', home: 'https://www.1.fm', note: 'Lo-fi beats' },
    { name: '1.FM Chillout Lounge', url: 'https://strm112.1.fm/chilloutlounge_mobile_mp3', home: 'https://www.1.fm', note: 'Downtempo' },
    { name: 'Classic FM', url: 'https://media-ice.musicradio.com/ClassicFMMP3', home: 'https://www.classicfm.com', note: 'Classical' },
];

/** Free community directory, no key, CORS open. */
const DIRECTORY = 'https://de1.api.radio-browser.info/json/stations/search';

interface DirectoryStation {
    name?: string;
    url_resolved?: string;
    url?: string;
    homepage?: string;
    tags?: string;
    countrycode?: string;
    bitrate?: number;
}

async function searchStations(term: string, signal: AbortSignal): Promise<Station[]> {
    const params = new URLSearchParams({
        name: term,
        limit: '30',
        hidebroken: 'true',
        order: 'clickcount',
        reverse: 'true',
        is_https: 'true',
    });
    const response = await fetch(`${DIRECTORY}?${params}`, { signal });
    if (!response.ok) throw new Error(`station search failed (${response.status})`);
    const payload = (await response.json()) as DirectoryStation[];
    const seen = new Set<string>();
    return payload.flatMap(station => {
        const url = station.url_resolved || station.url || '';
        const name = (station.name || '').trim();
        // The server only accepts https, and a duplicate stream is just noise.
        if (!url.startsWith('https://') || !name || seen.has(url)) return [];
        seen.add(url);
        const home = station.homepage?.startsWith('https://') ? station.homepage : undefined;
        const note = [station.countrycode, station.tags?.split(',').slice(0, 2).join(' · '), station.bitrate ? `${station.bitrate}kbps` : '']
            .filter(Boolean).join(' · ');
        return [{ name: name.slice(0, 60), url, home, note }];
    });
}

interface Props {
    current: RadioState;
    onTune: (station: Station) => void;
    onSwitchOff: () => void;
    onClose: () => void;
}

export default function RadioPicker({ current, onTune, onSwitchOff, onClose }: Props) {
    const { t } = useI18n();
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<Station[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [failed, setFailed] = useState(false);
    const request = useRef<AbortController | null>(null);

    useEffect(() => () => request.current?.abort(), []);

    const search = () => {
        const clean = term.trim();
        if (!clean) return;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setSearching(true);
        setFailed(false);
        searchStations(clean, controller.signal)
            .then(found => {
                if (request.current === controller) setResults(found);
            })
            .catch(reason => {
                if (request.current === controller && reason?.name !== 'AbortError') {
                    setResults([]);
                    setFailed(true);
                }
            })
            .finally(() => {
                if (request.current === controller) setSearching(false);
            });
    };

    const row = (station: Station) => (
        <button
            key={station.url}
            type="button"
            className={`radio-station ${current.url === station.url ? 'is-on' : ''}`}
            onClick={() => onTune(station)}
        >
            <span className="radio-station-name">{station.name}</span>
            {station.note && <span className="radio-station-note">{station.note}</span>}
            {current.url === station.url && <span className="radio-station-live">{t('audio.now_playing')}</span>}
        </button>
    );

    return (
        <Modal
            title={t('audio.picker_title')}
            subtitle={t('audio.picker_subtitle')}
            onClose={onClose}
            wide
            footer={
                <button type="button" className="btn btn-ghost" onClick={onSwitchOff} disabled={!current.url}>
                    {t('audio.switch_off')}
                </button>
            }
        >
            <form
                className="radio-search"
                onSubmit={event => {
                    event.preventDefault();
                    search();
                }}
            >
                <input
                    value={term}
                    onChange={event => setTerm(event.target.value)}
                    placeholder={t('audio.search_placeholder')}
                    aria-label={t('audio.search')}
                    maxLength={40}
                />
                <button type="submit" className="btn btn-gold" disabled={!term.trim() || searching}>
                    {searching ? t('audio.searching') : t('audio.search')}
                </button>
            </form>

            {results !== null && (
                <section className="radio-section">
                    <p className="label-caps">{t('audio.results')}</p>
                    {failed && <p className="radio-note">{t('audio.search_failed')}</p>}
                    {!failed && results.length === 0 && <p className="radio-note">{t('audio.no_results')}</p>}
                    <div className="radio-grid">{results.map(row)}</div>
                    <p className="radio-note">{t('audio.directory_credit')}</p>
                </section>
            )}

            <section className="radio-section">
                <p className="label-caps">{t('audio.presets')}</p>
                <div className="radio-grid">{PRESET_STATIONS.map(row)}</div>
            </section>
        </Modal>
    );
}
