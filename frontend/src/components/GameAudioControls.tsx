import type { ChangeEvent } from 'react';
import { useState } from 'react';
import type { GameAudio } from '../game/useGameAudio';
import type { ClientMessage, RadioState } from '../types';
import { useI18n } from '../i18n';
import RadioPicker, { type Station } from './RadioPicker';
import './GameAudioControls.css';

interface Props {
    audio: GameAudio;
    /** Hides sliders when the control has to fit in a compact table header. */
    compact?: boolean;
    /** The table's shared station. Absent outside a room. */
    radio?: RadioState;
    /** Only the table owner works the dial. */
    canManage?: boolean;
    /** Owner name, for the line telling everyone else who to ask. */
    ownerName?: string;
    send?: (msg: ClientMessage) => void;
}

function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

export default function GameAudioControls({ audio, compact = false, radio, canManage = false, ownerName, send }: Props) {
    const { t } = useI18n();
    const [picking, setPicking] = useState(false);
    const adjust = (handler: (value: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
        void audio.unlock();
        handler(Number(event.target.value));
    };

    const tune = (station: Station) => {
        send?.({ type: 'set_radio', radio: { name: station.name, url: station.url, home: station.home, playing: true } });
        setPicking(false);
        // Whoever changes the station clearly wants to hear it.
        if (!audio.radioEnabled) audio.setRadioEnabled(true);
        else void audio.unlock();
    };

    const switchOff = () => {
        send?.({ type: 'set_radio', radio: { name: '', url: '', playing: false } });
        setPicking(false);
    };

    const onAir = Boolean(radio?.playing && radio.url);
    const status = !audio.radioEnabled ? (onAir ? t('audio.not_listening') : '')
        : audio.radioBlocked ? t('audio.tap_to_listen')
            : audio.radioFailed ? t('audio.station_failed')
                : audio.radioLoading ? t('audio.connecting') : '';

    return (
        <div className={`game-audio-controls ${compact ? 'game-audio-controls-compact' : ''}`} role="group" aria-label={t('audio.group')}>
            <div className="game-audio-control">
                <button type="button" className={`game-audio-toggle ${audio.sfxEnabled ? 'is-on' : ''}`} onClick={() => audio.setSfxEnabled(!audio.sfxEnabled)} aria-pressed={audio.sfxEnabled} title={t(audio.sfxEnabled ? 'audio.mute_sounds' : 'audio.enable_sounds')}>
                    <span aria-hidden="true">{audio.sfxEnabled ? '🔊' : '🔇'}</span><span className="game-audio-label">{t('audio.sounds')}</span>
                </button>
                {!compact && <><input aria-label={t('audio.sfx_volume')} type="range" min="0" max="1" step="0.01" value={audio.sfxVolume} onChange={adjust(audio.setSfxVolume)} /><output>{percent(audio.sfxVolume)}</output></>}
            </div>

            <div className="game-audio-control">
                <button type="button" className={`game-audio-toggle ${audio.radioEnabled ? 'is-on' : ''}`} onClick={() => { audio.setRadioEnabled(!audio.radioEnabled); void audio.unlock(); }} aria-pressed={audio.radioEnabled} title={t(audio.radioEnabled ? 'audio.radio_leave' : 'audio.radio_listen')}>
                    <span aria-hidden="true">{audio.radioEnabled ? '📻' : '📻'}</span><span className="game-audio-label">{t('audio.radio')}</span>
                </button>
                {!compact && <><input aria-label={t('audio.radio_volume')} type="range" min="0" max="1" step="0.01" value={audio.radioVolume} onChange={adjust(audio.setRadioVolume)} /><output>{percent(audio.radioVolume)}</output></>}
            </div>

            {radio && !compact && (
                <div className="game-audio-radio">
                    <p className="game-audio-station">
                        <span className={`radio-dot ${onAir ? 'is-live' : ''}`} aria-hidden="true" />
                        <strong>{onAir ? radio.name : t('audio.station_none')}</strong>
                        {onAir && radio.by_name && <span>{t('audio.tuned_by', { name: radio.by_name })}</span>}
                    </p>
                    {status && <p className="game-audio-status">{status}</p>}
                    {canManage ? (
                        <button type="button" className="btn btn-ghost !px-2.5 !py-1 !text-xs" onClick={() => setPicking(true)}>
                            {onAir ? t('audio.change_station') : t('audio.pick_station')}
                        </button>
                    ) : (
                        <p className="game-audio-status">{t('audio.owner_only', { name: ownerName ?? '' })}</p>
                    )}
                </div>
            )}

            {picking && radio && (
                <RadioPicker current={radio} onTune={tune} onSwitchOff={switchOff} onClose={() => setPicking(false)} />
            )}
        </div>
    );
}
