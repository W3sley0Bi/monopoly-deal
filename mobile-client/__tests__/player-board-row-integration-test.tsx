import { cleanup, render } from '@testing-library/react-native';
import { afterEach, describe, expect, it } from '@jest/globals';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PlayerBoardRow } from '../src/components/table/PlayerBoardRow';

async function layout(roomy: boolean, expanded: boolean): Promise<ViewStyle> {
    const screen = await render(
        <PlayerBoardRow roomy={roomy} expanded={expanded}>
            <View />
            <View />
        </PlayerBoardRow>,
    );

    return StyleSheet.flatten(screen.getByTestId('player-board-row').props.style) as ViewStyle;
}

describe('<PlayerBoardRow /> responsive layout', () => {
    afterEach(async () => { await cleanup(); });

    it('preserves the gap and enough height for both expanded mobile sections', async () => {
        // Regression: wrapping Properties and Bank/Action removed their space
        // and let the property accordion open to less than its original size.
        await expect(layout(false, true)).resolves.toMatchObject({
            flexBasis: 'auto',
            flexGrow: 1,
            flexShrink: 1,
            gap: 5,
            minHeight: 157,
        });
    });

    it('releases the reserved mobile height when Properties is folded', async () => {
        await expect(layout(false, false)).resolves.toMatchObject({
            flexGrow: 0,
            flexShrink: 0,
            gap: 5,
            minHeight: 0,
        });
    });

    it('uses the centered horizontal station layout on tablet and desktop', async () => {
        await expect(layout(true, true)).resolves.toMatchObject({
            alignSelf: 'center',
            flexDirection: 'row',
            gap: 8,
            minHeight: 96,
            width: '60%',
        });
    });
});
