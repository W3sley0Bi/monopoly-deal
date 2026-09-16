import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { G, Polygon } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useStore } from '../../../lib/store';

export type BuildingKind = 'none' | 'house' | 'hotel';

/**
 * Mixes a hex colour towards white (`amount > 0`) or black (`amount < 0`).
 * Every face of a building is the set's one colour lit differently; unrelated
 * colours per face are what make toy 3D read as flat confetti.
 */
function shade(hex: string, amount: number): string {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const target = amount > 0 ? 255 : 0;
    const mix = Math.abs(amount);
    const channel = (i: number) => {
        const from = parseInt(full.slice(i * 2, i * 2 + 2), 16);
        return Math.round(from + (target - from) * mix);
    };
    return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/**
 * True isometric projection, the one every toy building in every board game
 * uses: the two horizontal axes run 30° up from the horizontal, the vertical
 * axis stays vertical, and nothing converges.
 *
 *     screen x = (X - Y) · cos30
 *     screen y = (X + Y) · sin30 - Z
 *
 * The previous version skewed one wall and left the roof front-facing, which
 * is why it looked wrong: two faces drawn in two different projections cannot
 * be read as one solid.
 */
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
/** Pixels per unit of the 1x1 footprint. */
const S = 13;

type P = readonly [number, number];
const at = (x: number, y: number, z: number): P => [
    (x - y) * COS30 * S,
    (x + y) * SIN30 * S - z * S,
];

/** The near corner is (1,1); the two faces meeting there are the visible ones. */
function model(kind: 'house' | 'hotel') {
    const wall = kind === 'hotel' ? 1.45 : 0.8;
    const peak = kind === 'hotel' ? 0 : 0.6;

    // Footprint corners, ground and wall top.
    const g = { a: at(0, 0, 0), b: at(1, 0, 0), c: at(1, 1, 0), d: at(0, 1, 0) };
    const w = { a: at(0, 0, wall), b: at(1, 0, wall), c: at(1, 1, wall), d: at(0, 1, wall) };
    const apex = at(0.5, 0.5, wall + peak);

    // Windows sit *on* a wall plane, so they are quads in the same projection —
    // that is what keeps them lying on the face instead of floating over it.
    const windowsFor = (face: 'right' | 'left') =>
        [0, 1].flatMap((row) =>
            [0, 1].map((col) => {
                const lo = 0.22 + col * 0.36;
                const hi = lo + 0.22;
                const z0 = 0.35 + row * 0.5;
                const z1 = z0 + 0.32;
                return face === 'right'
                    ? [at(1, lo, z0), at(1, hi, z0), at(1, hi, z1), at(1, lo, z1)]
                    : [at(lo, 1, z0), at(hi, 1, z0), at(hi, 1, z1), at(lo, 1, z1)];
            }),
        );

    const faces = {
        // Wall at X=1, turned away from the light.
        right: [g.b, g.c, w.c, w.b] as P[],
        // Wall at Y=1, facing the light.
        left: [g.d, g.c, w.c, w.d] as P[],
        // Hip roof: only the two slopes over the visible walls can be seen.
        roofRight: peak ? ([w.b, w.c, apex] as P[]) : null,
        roofLeft: peak ? ([w.d, w.c, apex] as P[]) : null,
        // A hotel is flat-topped, so its roof is the top face itself.
        roofFlat: peak ? null : ([w.a, w.b, w.c, w.d] as P[]),
        windowsRight: kind === 'hotel' ? windowsFor('right') : [],
        windowsLeft: kind === 'hotel' ? windowsFor('left') : [],
    };

    const all = [
        ...faces.right, ...faces.left,
        ...(faces.roofRight ?? []), ...(faces.roofLeft ?? []), ...(faces.roofFlat ?? []),
    ];
    const xs = all.map(p => p[0]);
    const ys = all.map(p => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
        faces,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
        offset: [-minX, -minY] as P,
    };
}

const MODELS = { house: model('house'), hotel: model('hotel') };

const points = (face: P[]) => face.map(p => `${p[0]},${p[1]}`).join(' ');

/**
 * A complete set stops being three overlapping cards once it is built on: it
 * becomes the thing the cards stood for, in the set's own colour so the board
 * still reads as "which colours are finished".
 *
 * Going the other way matters as much: a hotel paid away leaves a house, and a
 * house paid away leaves the three cards. The caller keys this component by
 * kind, so each step lands with its own drop rather than cutting.
 */
export function MiniBuilding({ kind, color }: { kind: Exclude<BuildingKind, 'none'>; color: string }) {
    const reduced = useReducedMotion();
    const motion = useStore(s => s.motion);
    const animate = motion && !reduced;

    const pop = useSharedValue(animate ? 0 : 1);
    useEffect(() => {
        if (!animate) {
            pop.value = 1;
            return;
        }
        // Lands, overshoots, settles — a building is dropped onto the table,
        // not faded in.
        pop.value = withSequence(
            withTiming(1.16, { duration: 190, easing: Easing.out(Easing.back(2)) }),
            withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }),
        );
    }, [animate, kind, pop]);

    const animated = useAnimatedStyle(() => ({
        opacity: Math.min(1, pop.value * 1.6),
        transform: [
            { translateY: -10 * (1 - Math.min(1, pop.value)) },
            { scale: 0.55 + 0.45 * pop.value },
        ],
    }));

    // Light from the top left: roof brightest, the wall facing the light next,
    // the wall turned away from it darkest — one direction, same as the card
    // shadows on the felt.
    const tone = useMemo(() => ({
        roof: shade(color, 0.42),
        left: shade(color, 0.02),
        right: shade(color, -0.4),
        edge: shade(color, -0.62),
        glass: shade(color, 0.72),
    }), [color]);

    const m = MODELS[kind];

    return (
        <Animated.View style={[styles.root, animated]} pointerEvents="none">
            <Svg width={m.width} height={m.height} viewBox={`0 0 ${m.width} ${m.height}`}>
                <G x={m.offset[0]} y={m.offset[1]}>
                    <Polygon points={points(m.faces.right)} fill={tone.right} stroke={tone.edge} strokeWidth={0.5} />
                    <Polygon points={points(m.faces.left)} fill={tone.left} stroke={tone.edge} strokeWidth={0.5} />
                    {m.faces.windowsRight.map((win, i) => (
                        <Polygon key={`wr${i}`} points={points(win)} fill={tone.glass} opacity={0.75} />
                    ))}
                    {m.faces.windowsLeft.map((win, i) => (
                        <Polygon key={`wl${i}`} points={points(win)} fill={tone.glass} opacity={0.9} />
                    ))}
                    {m.faces.roofFlat ? (
                        <Polygon points={points(m.faces.roofFlat)} fill={tone.roof} stroke={tone.edge} strokeWidth={0.5} />
                    ) : null}
                    {m.faces.roofRight ? (
                        <Polygon points={points(m.faces.roofRight)} fill={shade(color, 0.22)} stroke={tone.edge} strokeWidth={0.5} />
                    ) : null}
                    {m.faces.roofLeft ? (
                        <Polygon points={points(m.faces.roofLeft)} fill={tone.roof} stroke={tone.edge} strokeWidth={0.5} />
                    ) : null}
                </G>
            </Svg>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: { alignItems: 'center', justifyContent: 'flex-end', transformOrigin: 'center bottom' },
});

export default MiniBuilding;
