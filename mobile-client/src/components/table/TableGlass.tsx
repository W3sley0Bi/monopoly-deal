import { createContext, useContext, useEffect, useState, type Ref, type RefObject, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';

const GlassContext = createContext<{ target: RefObject<View | null>; reduced: boolean } | null>(null);

export function TableGlassProvider({ target, children }: { target: RefObject<View | null>; children: ReactNode }) {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        // react-native-web implements only part of AccessibilityInfo: the
        // reduce-transparency query and its event do not exist there, and the
        // web has no equivalent media query either. Treat it as off.
        if (!AccessibilityInfo.isReduceTransparencyEnabled) return;
        let live = true;
        void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (live) setReduced(value); });
        const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
        return () => { live = false; subscription.remove(); };
    }, []);
    return <GlassContext.Provider value={{ target, reduced }}>{children}</GlassContext.Provider>;
}

/**
 * The blur fill on its own, for surfaces that cannot be a `GlassPanel` because
 * they own their background (a drop zone animates its own tint on top).
 * Returns null when the reader asked for reduced transparency; the caller is
 * expected to carry a solid colour of its own in that case.
 */
export function GlassLayer({ radius = 19 }: { radius?: number }) {
    const glass = useContext(GlassContext);
    if (glass?.reduced) return null;
    return <View pointerEvents="none" style={[styles.clip, { borderRadius: radius }]}>
        <BlurView style={StyleSheet.absoluteFill} tint="systemUltraThinMaterialDark" intensity={28}
            blurTarget={glass?.target} blurMethod="dimezisBlurViewSdk31Plus" />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
    </View>;
}

/** The effect is behind the content and never participates in card gestures. */
export function GlassPanel({ children, style, targetRef, ...props }: ViewProps & { targetRef?: Ref<View> }) {
    const glass = useContext(GlassContext);
    // The blur is a clipped child, so it has to follow whatever radius the
    // caller set — at the panel default it squares off the corners of a
    // rounder panel and the fill shows through behind the border.
    const flat = StyleSheet.flatten([styles.panel, style]);
    const corner = typeof flat.borderRadius === 'number' ? flat.borderRadius : 20;
    return <View ref={targetRef} {...props} style={[styles.panel, style, glass?.reduced && styles.solid]}>
        <GlassLayer radius={corner - 1} />
        {children}
    </View>;
}

const styles = StyleSheet.create({
    panel: {
        borderRadius: 20,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: '#d8fff044',
        backgroundColor: 'transparent',
        boxShadow: '0 8px 24px #00181f52',
    },
    clip: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: 19,
        borderCurve: 'continuous',
        overflow: 'hidden',
    },
    tint: { backgroundColor: '#0629325e' },
    solid: { backgroundColor: '#153039f2' },
});
