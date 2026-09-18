import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { Density } from '../../../lib/contracts';

type PlayerBoardRowProps = {
    children: ReactNode;
    expanded: boolean;
    roomy: boolean;
    onLayout?: (event: LayoutChangeEvent) => void;
};

export function propertyDensityForLayout(roomy: boolean, setCount: number): Density {
    if (roomy) return 'normal';
    if (setCount > 6) return 'tight';
    if (setCount > 4) return 'dense';
    return 'normal';
}

/** Keeps the local board stack spacious on phones and horizontal on roomy screens. */
export function PlayerBoardRow({ children, expanded, roomy, onLayout }: PlayerBoardRowProps) {
    return (
        <View
            testID="player-board-row"
            onLayout={onLayout}
            style={[
                styles.base,
                !roomy && !expanded && styles.folded,
                roomy && styles.roomy,
            ]}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    // On phones this wrapper preserves the original vertical stack. Its
    // minimum is both sections plus their breathing room: 96 + 56 + 5.
    base: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 'auto',
        minHeight: 157,
        gap: 5,
    },
    folded: { flexGrow: 0, flexShrink: 0, minHeight: 0 },
    roomy: {
        width: '60%',
        alignSelf: 'center',
        // The wrapper follows the taller Properties panel. Bank and Action
        // keep their own shorter roomy height and sit against its bottom edge.
        // Mobile keeps the flexible stack defined by `base` above.
        height: 200,
        marginBottom: -10,
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 0,
        minHeight: 200,
        flexDirection: 'row',
        gap: 8,
    },
});
