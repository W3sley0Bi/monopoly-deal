import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

type PlayerBoardRowProps = {
    children: ReactNode;
    expanded: boolean;
    roomy: boolean;
    onLayout?: (event: LayoutChangeEvent) => void;
};

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
        flexBasis: 0,
        minHeight: 96,
        flexDirection: 'row',
        gap: 8,
    },
});
