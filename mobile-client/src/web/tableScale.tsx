import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

/**
 * A phone browser gives the table 150–200pt less height than the app gets:
 * its address bar and toolbar sit inside the screen, and `lockViewport` sizes
 * the page to what is left. The table's own stack — rail, board, bank, hand,
 * footer — has fixed minimums, so on that shorter page it closed over the
 * seats instead of leaving them room.
 *
 * Rather than a second, cramped layout, the table is laid out at the height it
 * was designed for and the whole thing is scaled down to the visible page. The
 * proportions are the app's; only the size changes.
 */
const DESIGN_HEIGHT = 740;
// Below this, text and touch targets get too small to be worth the space.
const MIN_SCALE = 0.78;

export function tableScaleFor(width: number, height: number): number {
    if (Platform.OS !== 'web') return 1;
    // Roomy screens have their own layout, and a landscape phone is a different
    // layout too: scaling it by its tiny height would shrink it to nothing.
    const roomy = Math.min(width, height) >= 600 || width >= 900;
    if (roomy || width >= height) return 1;
    return Math.max(MIN_SCALE, Math.min(1, height / DESIGN_HEIGHT));
}

export interface TableWindow {
    /** The size the table lays itself out at — larger than the window when scaled. */
    width: number;
    height: number;
    /** On-screen size per layout point. Window coordinates divide by this. */
    scale: number;
}

const TableWindowContext = createContext<TableWindow | null>(null);

/**
 * `useWindowDimensions` for anything inside the table. Outside a frame (or
 * unscaled) it is the real window.
 */
export function useTableWindow(): TableWindow {
    const real = useWindowDimensions();
    const framed = useContext(TableWindowContext);
    return framed ?? { width: real.width, height: real.height, scale: 1 };
}

export function TableScaleFrame({ children }: { children: ReactNode }) {
    const { width, height } = useWindowDimensions();
    const scale = tableScaleFor(width, height);
    const value = useMemo(
        () => ({ width: width / scale, height: height / scale, scale }),
        [width, height, scale],
    );
    return (
        <TableWindowContext.Provider value={value}>
            {scale === 1 ? children : (
                <View style={styles.clip}>
                    <View style={{ width: value.width, height: value.height, transform: [{ scale }], transformOrigin: 'left top' }}>
                        {children}
                    </View>
                </View>
            )}
        </TableWindowContext.Provider>
    );
}

const styles = StyleSheet.create({
    clip: { flex: 1, overflow: 'hidden' },
});
