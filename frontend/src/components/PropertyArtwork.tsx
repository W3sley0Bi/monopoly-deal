import type { Color } from '../types';

/** Tiny isometric property token, printed as part of the card face. */
export default function PropertyArtwork({ color }: { color?: Color }) {
    if (color === 'railroad')
        return (
            <svg
                viewBox="0 0 80 64"
                className="property-artwork"
                aria-hidden="true"
            >
                <ellipse
                    cx="40"
                    cy="57"
                    rx="28"
                    ry="5"
                    fill="currentColor"
                    opacity=".15"
                />
                <path
                    d="M22 8h36a5 5 0 0 1 5 5v29a8 8 0 0 1-8 8H25a8 8 0 0 1-8-8V13a5 5 0 0 1 5-5Z"
                    fill="currentColor"
                />
                <path
                    d="M24 15h32v17H24Z"
                    fill="oklch(96% .025 95)"
                    opacity=".85"
                />
                <path d="M40 15v17" stroke="currentColor" strokeWidth="3" />
                <circle cx="27" cy="40" r="4" fill="oklch(96% .025 95)" />
                <circle cx="53" cy="40" r="4" fill="oklch(96% .025 95)" />
                <path
                    d="m28 48-8 12m32-12 8 12M24 55h32"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
            </svg>
        );
    if (color === 'utility')
        return (
            <svg
                viewBox="0 0 80 64"
                className="property-artwork"
                aria-hidden="true"
            >
                <circle
                    cx="40"
                    cy="28"
                    r="22"
                    fill="currentColor"
                    opacity=".12"
                />
                <path
                    d="M28 42c0-9-9-10-9-22a21 21 0 0 1 42 0c0 12-9 13-9 22Z"
                    fill="currentColor"
                />
                <path
                    d="m42 8-12 19h10l-3 12 14-20H40Z"
                    fill="oklch(96% .025 95)"
                />
                <path
                    d="M29 48h22m-19 7h16"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                />
            </svg>
        );
    return (
        <svg
            viewBox="0 0 80 64"
            className="property-artwork"
            aria-hidden="true"
        >
            <ellipse
                cx="40"
                cy="56"
                rx="30"
                ry="6"
                fill="currentColor"
                opacity=".13"
            />
            <path
                d="m16 28 24 11v19L16 46Z"
                fill="currentColor"
                opacity=".72"
            />
            <path d="m40 39 24-12v20L40 58Z" fill="currentColor" />
            <path
                d="m11 29 13-24 28 12-12 24Z"
                fill="currentColor"
                opacity=".85"
            />
            <path d="m40 41 12-24 18 13-6 1-12-9-9 20Z" fill="currentColor" />
            <path
                d="m22 32 8 4v9l-8-4Z"
                fill="oklch(97% .02 95)"
                opacity=".85"
            />
            <path
                d="m47 41 8-4v15l-8 4Z"
                fill="oklch(97% .02 95)"
                opacity=".75"
            />
            <path d="m43 13 0-9 7-3v15Z" fill="currentColor" />
            <path d="m43 4 7-3-6-2-7 3Z" fill="currentColor" opacity=".6" />
        </svg>
    );
}
