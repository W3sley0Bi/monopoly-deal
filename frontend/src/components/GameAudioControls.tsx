import type { ChangeEvent } from 'react';
import type { GameAudio } from '../game/useGameAudio';
import { useI18n } from '../i18n';
import './GameAudioControls.css';

interface Props {
    audio: GameAudio;
    /** Hides sliders when the control has to fit in a compact table header. */
    compact?: boolean;
}

function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

export default function GameAudioControls({ audio, compact = false }: Props) {
    const { t } = useI18n();
    const adjust = (handler: (value: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
        void audio.unlock();
        handler(Number(event.target.value));
    };

    return (
        <div className={`game-audio-controls ${compact ? 'game-audio-controls-compact' : ''}`} role="group" aria-label={t('audio.group')}>
            <div className="game-audio-control">
                <button type="button" className={`game-audio-toggle ${audio.sfxEnabled ? 'is-on' : ''}`} onClick={() => audio.setSfxEnabled(!audio.sfxEnabled)} aria-pressed={audio.sfxEnabled} title={t(audio.sfxEnabled ? 'audio.mute_sounds' : 'audio.enable_sounds')}>
                    <span aria-hidden="true">{audio.sfxEnabled ? '🔊' : '🔇'}</span><span className="game-audio-label">{t('audio.sounds')}</span>
                </button>
                {!compact && <><input aria-label={t('audio.sfx_volume')} type="range" min="0" max="1" step="0.01" value={audio.sfxVolume} onChange={adjust(audio.setSfxVolume)} /><output>{percent(audio.sfxVolume)}</output></>}
            </div>

        </div>
    );
}
