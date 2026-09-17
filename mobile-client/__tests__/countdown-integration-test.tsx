import { act, render } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CountdownTimer } from '../src/components/table/CountdownTimer';

jest.mock('../src/i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}));

describe('<CountdownTimer />', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(1_000);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('ticks from the authoritative deadline and reaches zero', async () => {
        const screen = await render(
            <CountdownTimer deadlineMs={6_000} totalSeconds={5} skewMs={0} kind="turn" />,
        );

        expect(screen.getByTestId('countdown-turn-value')).toHaveTextContent('5s');

        await act(async () => {
            jest.advanceTimersByTime(2_100);
        });
        expect(screen.getByTestId('countdown-turn-value')).toHaveTextContent('3s');

        await act(async () => {
            jest.advanceTimersByTime(3_000);
        });
        expect(screen.getByTestId('countdown-turn-value')).toHaveTextContent('0s');
    });
});
