import type { CSSProperties } from 'react';
import type { Card, Color } from '../types';
import { colorMeta } from '../game/meta';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import PropertyArtwork from './PropertyArtwork';

export default function DualWildcard({
    card,
    activeColor,
}: {
    card: Card;
    activeColor?: Color;
}) {
    const { t, tColor } = useI18n();
    const flipped = activeColor === card.colors?.[1];
    return (
        <div
            className={`dual-wildcard ${flipped ? 'wildcard-flipped' : ''}`}
            data-active-color={activeColor}
        >
            <div className="wildcard-rotator">
                {card.colors!.map((color, i) => {
                    const meta = colorMeta(color);
                    return (
                        <div
                            key={color}
                            className={`wildcard-half wildcard-half-${i}`}
                            style={
                                {
                                    '--card-color': meta.hex,
                                    '--wild-ink': meta.ink,
                                } as CSSProperties
                            }
                        >
                            <div className="wildcard-color">
                                <span>{tColor(color)}</span>
                                <b>{money(t, card.value)}</b>
                            </div>
                            <div className="wildcard-art">
                                <PropertyArtwork color={color} />
                                <span>{t('card.type.wildcard')}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
            <span className="wildcard-pivot" aria-hidden="true">
                ⇅
            </span>
        </div>
    );
}
