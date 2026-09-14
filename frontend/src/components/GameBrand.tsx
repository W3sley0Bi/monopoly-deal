export default function GameBrand({ compact = false }: { compact?: boolean }) {
    return (
        <span
            className={`game-brand ${compact ? 'game-brand-compact' : ''}`}
            aria-label="Monopoly Deal"
        >
            <span className="brand-monopoly">MONOPOLY</span>
            <span className="brand-deal">
                DEAL<span className="brand-dot">.</span>
            </span>
        </span>
    );
}

/** Local vector scenery: a miniature property city, no network assets. */
export function Cityscape() {
    return (
        <svg
            className="cityscape"
            viewBox="0 0 1200 280"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M0 248 1200 248M0 265 1200 265"
                stroke="currentColor"
                opacity=".3"
            />
            {[35, 115, 205, 295, 405, 510, 655, 760, 855, 955, 1060, 1140].map(
                (x, i) => {
                    const h = [
                        65, 105, 150, 80, 185, 125, 115, 170, 90, 145, 95, 70,
                    ][i];
                    return (
                        <g key={x} transform={`translate(${x} ${245 - h})`}>
                            <path
                                d={`M0 0 28 -15 65 0V${h}H0Z`}
                                fill="currentColor"
                                opacity={i % 2 ? '.13' : '.22'}
                            />
                            <path
                                d={`M0 0H43V${h}H0Z`}
                                fill="currentColor"
                                opacity=".16"
                            />
                            {Array.from({ length: Math.floor(h / 24) }).map(
                                (_, j) => (
                                    <path
                                        key={j}
                                        d={`M9 ${14 + j * 22}h8m12 0h8`}
                                        stroke="currentColor"
                                        strokeWidth="6"
                                        opacity=".35"
                                    />
                                ),
                            )}
                        </g>
                    );
                },
            )}
        </svg>
    );
}
