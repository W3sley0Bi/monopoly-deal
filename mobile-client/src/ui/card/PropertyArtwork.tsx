import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import type { Color } from '../../types';
import { colorMeta } from '../../game/meta';
import { mix } from '../../../lib/color';

/** Tiny isometric property token, printed as part of the card face. */
export function PropertyArtwork({ color, size }: { color?: Color; size: number }) {
    const tint = mix(colorMeta(color).hex, '#0b2b30', 85);
    if (color === 'railroad')
        return (
            <Svg
                viewBox="0 0 80 64"
                width={size} height={size * 0.8}
                aria-hidden
            >
                <Ellipse
                    cx="40"
                    cy="57"
                    rx="28"
                    ry="5"
                    fill={tint}
                    opacity=".15"
                />
                <Path
                    d="M22 8h36a5 5 0 0 1 5 5v29a8 8 0 0 1-8 8H25a8 8 0 0 1-8-8V13a5 5 0 0 1 5-5Z"
                    fill={tint}
                />
                <Path
                    d="M24 15h32v17H24Z"
                    fill="#f7f2df"
                    opacity=".85"
                />
                <Path d="M40 15v17" stroke={tint} strokeWidth="3" />
                <Circle cx="27" cy="40" r="4" fill="#f7f2df" />
                <Circle cx="53" cy="40" r="4" fill="#f7f2df" />
                <Path
                    d="m28 48-8 12m32-12 8 12M24 55h32"
                    stroke={tint}
                    strokeWidth="4"
                    strokeLinecap="round"
                />
            </Svg>
        );
    if (color === 'utility')
        return (
            <Svg
                viewBox="0 0 80 64"
                width={size} height={size * 0.8}
                aria-hidden
            >
                <Circle
                    cx="40"
                    cy="28"
                    r="22"
                    fill={tint}
                    opacity=".12"
                />
                <Path
                    d="M28 42c0-9-9-10-9-22a21 21 0 0 1 42 0c0 12-9 13-9 22Z"
                    fill={tint}
                />
                <Path
                    d="m42 8-12 19h10l-3 12 14-20H40Z"
                    fill="#f7f2df"
                />
                <Path
                    d="M29 48h22m-19 7h16"
                    stroke={tint}
                    strokeWidth="5"
                    strokeLinecap="round"
                />
            </Svg>
        );
    return (
        <Svg
            viewBox="0 0 80 64"
            width={size} height={size * 0.8}
            aria-hidden
        >
            <Ellipse
                cx="40"
                cy="56"
                rx="30"
                ry="6"
                fill={tint}
                opacity=".13"
            />
            <Path
                d="m16 28 24 11v19L16 46Z"
                fill={tint}
                opacity=".72"
            />
            <Path d="m40 39 24-12v20L40 58Z" fill={tint} />
            <Path
                d="m11 29 13-24 28 12-12 24Z"
                fill={tint}
                opacity=".85"
            />
            <Path d="m40 41 12-24 18 13-6 1-12-9-9 20Z" fill={tint} />
            <Path
                d="m22 32 8 4v9l-8-4Z"
                fill="#faf5e3"
                opacity=".85"
            />
            <Path
                d="m47 41 8-4v15l-8 4Z"
                fill="#faf5e3"
                opacity=".75"
            />
            <Path d="m43 13 0-9 7-3v15Z" fill={tint} />
            <Path d="m43 4 7-3-6-2-7 3Z" fill={tint} opacity=".6" />
        </Svg>
    );
}

export default PropertyArtwork;
