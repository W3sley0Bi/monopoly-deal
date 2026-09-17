import { describe, expect, it, jest } from '@jest/globals';

import { countdownState } from '../src/components/table/CountdownTimer';

jest.mock('../src/i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}));

describe('countdownState', () => {
    it('corrects the device clock with the server skew', () => {
        expect(countdownState(10_000, 10, 2_000, 1_000)).toEqual({
            remainingMs: 7_000,
            seconds: 7,
            fraction: 0.7,
            urgent: false,
        });
    });

    it('clamps an expired deadline instead of showing a negative timer', () => {
        expect(countdownState(1_000, 10, 250, 2_000)).toEqual({
            remainingMs: 0,
            seconds: 0,
            fraction: 0,
            urgent: false,
        });
    });

    it('marks the final five seconds as urgent', () => {
        expect(countdownState(6_000, 30, 0, 1_000).urgent).toBe(true);
    });
});
