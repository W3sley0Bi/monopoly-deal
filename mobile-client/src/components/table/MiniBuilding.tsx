import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { G, Polygon } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useStore } from '../../../lib/store';

export type BuildingKind = 'none' | 'house' | 'hotel';
type Point = readonly [number, number, number];
type Material = 'wall' | 'roof' | 'trim' | 'recess' | 'glass' | 'door' | 'shadow';
type Face = { vertices: Point[]; material: Material; light: number };

// A single orthographic camera: vertical edges stay vertical and both ground
// axes are at 30°. Details are built in wall/roof planes before projection.
const project = ([x, y, z]: Point) => [(x - y) * Math.cos(Math.PI / 6) * 10.5, ((x + y) * 0.5 - z) * 10.5];

function shade(hex: string, amount: number): string {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const target = amount > 0 ? 255 : 0;
    return `rgb(${[0, 2, 4].map(i => {
        const from = parseInt(full.slice(i, i + 2), 16);
        return Math.round(from + (target - from) * Math.abs(amount));
    }).join(',')})`;
}

function model(kind: 'house' | 'hotel') {
    const faces: Face[] = [];
    const face = (vertices: Point[], material: Material, light = 0) => faces.push({ vertices, material, light });
    const box = (x: number, y: number, z: number, w: number, d: number, h: number, material: Material) => {
        face([[x+w,y,z], [x+w,y+d,z], [x+w,y+d,z+h], [x+w,y,z+h]], material, -0.28);
        face([[x,y+d,z], [x+w,y+d,z], [x+w,y+d,z+h], [x,y+d,z+h]], material, 0.06);
        face([[x,y,z+h], [x+w,y,z+h], [x+w,y+d,z+h], [x,y+d,z+h]], material, 0.3);
    };
    const panel = (side: 'front' | 'side', u: number, z: number, w: number, h: number, material: Material) => {
        const p = (a: number, b: number): Point => side === 'front' ? [a,1,b] : [1,a,b];
        face([p(u,z), p(u+w,z), p(u+w,z+h), p(u,z+h)], material, side === 'side' ? -0.2 : 0.06);
    };
    const window = (side: 'front' | 'side', u: number, z: number, w = 0.23, h = 0.26) => {
        panel(side, u-0.025, z-0.025, w+0.05, h+0.05, 'trim');
        panel(side, u, z, w, h, 'recess');
        panel(side, u+0.03, z+0.025, w-0.05, h-0.055, 'glass');
        panel(side, u+w*0.48, z+0.02, 0.025, h-0.04, 'trim');
        if (side === 'front') box(u-0.04, 1, z-0.045, w+0.08, 0.065, 0.035, 'trim');
        else box(1, u-0.04, z-0.045, 0.065, w+0.08, 0.035, 'trim');
    };
    face([[-0.07,-0.06,-0.02], [1.23,-0.06,-0.02], [1.3,1.23,-0.02], [-0.07,1.16,-0.02]], 'shadow');
    box(-0.05, -0.05, 0, 1.1, 1.1, 0.09, 'trim');
    box(0, 0, 0.09, 1, 1, kind === 'hotel' ? 1.41 : 0.69, 'wall');

    if (kind === 'house') {
        window('side', 0.2, 0.35, 0.29);
        window('front', 0.12, 0.36, 0.23, 0.24);
        panel('front', 0.59, 0.09, 0.27, 0.44, 'trim');
        panel('front', 0.62, 0.09, 0.21, 0.41, 'door');
        panel('front', 0.655, 0.34, 0.14, 0.12, 'glass');
        box(0.55, 1, 0.015, 0.36, 0.18, 0.07, 'trim');
        // Gabled roof with overhang. Both slopes share the same ridge; fascia
        // follows the pitch rather than being drawn horizontally on screen.
        const lo = -0.1, hi = 1.1, eave = 0.83, ridge = 1.32;
        face([[lo,lo,eave], [0.5,lo,ridge], [0.5,hi,ridge], [lo,hi,eave]], 'roof', 0.28);
        face([[0.5,lo,ridge], [hi,lo,eave], [hi,hi,eave], [0.5,hi,ridge]], 'roof', -0.13);
        face([[lo,hi,eave], [hi,hi,eave], [0.5,hi,ridge]], 'wall', 0.1);
        face([[lo,hi,eave], [0.5,hi,ridge], [0.5,hi,ridge-0.055], [lo,hi,eave-0.055]], 'trim', 0.15);
        face([[0.5,hi,ridge], [hi,hi,eave], [hi,hi,eave-0.055], [0.5,hi,ridge-0.055]], 'trim');
        face([[hi,lo,eave], [hi,hi,eave], [hi,hi,eave-0.06], [hi,lo,eave-0.06]], 'trim', -0.25);
        for (const t of [0.36, 0.7]) {
            const x = 0.5+0.6*t, z = ridge-(ridge-eave)*t;
            face([[x,lo,z], [x+0.014,lo,z-0.012], [x+0.014,hi-0.02,z-0.012], [x,hi-0.02,z]], 'roof', -0.3);
        }
        box(0.7, 0.23, 1, 0.16, 0.18, 0.44, 'wall');
        box(0.675, 0.205, 1.44, 0.21, 0.23, 0.045, 'trim');
        face([[0.72,0.25,1.487], [0.84,0.25,1.487], [0.84,0.38,1.487], [0.72,0.38,1.487]], 'recess');
    } else {
        for (const side of ['side', 'front'] as const) {
            for (const z of [0.66, 1.09]) for (const u of [0.16, 0.61]) window(side, u, z, 0.22, 0.25);
            panel(side, 0.04, 0.57, 0.92, 0.035, 'trim');
            panel(side, 0.04, 1.01, 0.92, 0.025, 'trim');
        }
        window('side', 0.35, 0.19, 0.3, 0.24);
        panel('front', 0.3, 0.09, 0.4, 0.4, 'trim');
        panel('front', 0.33, 0.09, 0.34, 0.37, 'recess');
        panel('front', 0.355, 0.11, 0.125, 0.32, 'glass');
        panel('front', 0.51, 0.11, 0.125, 0.32, 'glass');
        box(0.24, 1, 0.015, 0.52, 0.18, 0.075, 'trim');
        box(0.2, 1, 0.47, 0.6, 0.22, 0.06, 'roof');
        // Back parapets, rooftop plant room, then front parapets: the raised
        // rim correctly occludes the inset roof and its equipment.
        box(-0.045, -0.045, 1.46, 1.09, 1.09, 0.085, 'trim');
        face([[0.035,0.035,1.546], [0.965,0.035,1.546], [0.965,0.965,1.546], [0.035,0.965,1.546]], 'roof', -0.3);
        box(0, 0, 1.545, 1, 0.075, 0.1, 'wall');
        box(0, 0.075, 1.545, 0.075, 0.925, 0.1, 'wall');
        box(0.25, 0.22, 1.55, 0.4, 0.34, 0.18, 'roof');
        box(0.225, 0.195, 1.73, 0.45, 0.39, 0.035, 'trim');
        box(0.925, 0.075, 1.545, 0.075, 0.925, 0.1, 'wall');
        box(0.075, 0.925, 1.545, 0.85, 0.075, 0.1, 'wall');
    }
    const projected = faces.map(f => ({ ...f, points: f.vertices.map(project) }));
    const all = projected.flatMap(f => f.points);
    const minX = Math.min(...all.map(p => p[0])) - 0.5;
    const minY = Math.min(...all.map(p => p[1])) - 0.5;
    return {
        faces: projected.map(f => ({ ...f, points: f.points.map(p => p.join(',')).join(' ') })),
        width: Math.max(...all.map(p => p[0])) - minX + 0.5,
        height: Math.max(...all.map(p => p[1])) - minY + 0.5,
        offset: [-minX, -minY],
    };
}
const MODELS = { house: model('house'), hotel: model('hotel') };

export const MiniBuilding = memo(function MiniBuilding({ kind, color, seatRotation = 0, seatSquash = 1 }: {
    kind: Exclude<BuildingKind, 'none'>; color: string; seatRotation?: number; seatSquash?: number;
}) {
    const reduced = useReducedMotion();
    const motion = useStore(s => s.motion);
    const animate = motion && !reduced;
    const pop = useSharedValue(animate ? 0 : 1);
    useEffect(() => {
        pop.value = withTiming(1, { duration: animate ? 260 : 0, easing: Easing.out(Easing.cubic) });
    }, [animate, kind, pop]);
    const animated = useAnimatedStyle(() => ({
        opacity: pop.value,
        transform: [{ translateY: -8 * (1-pop.value) }, { scale: 0.85+0.15*pop.value }],
    }));
    // Keep palette entries in hex: shade() operates on hex input once only.
    const palette = useMemo<Record<Material, string>>(() => ({
        wall: color, roof: color, trim: '#d9e2d5', recess: '#132b35',
        glass: '#b3dad8', door: color, shadow: '#071b22',
    }), [color]);
    const m = MODELS[kind];
    return <View pointerEvents="none" style={[styles.root, styles.orientation, {
        // Parent is rotation × uniform depth × squash. Invert squash then
        // rotation so upright walls and lighting share one camera at all seats.
        // Rotate around the visual centre so the model remains centred on the
        // card stack it replaces, including at the side seats.
        transform: [{ scaleY: 1 / seatSquash }, { rotate: `${-seatRotation}deg` }],
    }]}>
        <Animated.View style={[styles.root, animated]}>
            <Svg width={m.width} height={m.height} viewBox={`0 0 ${m.width} ${m.height}`}>
                <G x={m.offset[0]} y={m.offset[1]}>
                    {m.faces.map((f, i) => <Polygon key={i} points={f.points}
                        fill={shade(palette[f.material], f.material === 'door' ? -0.55 : f.light)}
                        opacity={f.material === 'shadow' ? 0.28 : 1} />)}
                </G>
            </Svg>
        </Animated.View>
    </View>;
});

const styles = StyleSheet.create({
    root: { alignItems: 'center', justifyContent: 'flex-end', transformOrigin: 'center bottom' },
    orientation: { transformOrigin: 'center' },
});
export default MiniBuilding;
