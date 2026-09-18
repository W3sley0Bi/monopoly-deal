import { describe, expect, it, jest } from '@jest/globals';

// The config module refuses to load without a server URL; validation never uses it.
jest.mock('../lib/config', () => ({ SERVER_URL: 'ws://test/ws' }));
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { isValidServerMessage } from '../lib/net/messages';

describe('isValidServerMessage', () => {
    it('accepts a room frame whose game carries a players array', () => {
        expect(isValidServerMessage({ type: 'room', payload: { id: 'ABCD', game: { players: [] } } })).toBe(true);
    });

    it('drops a room frame the table would crash on', () => {
        expect(isValidServerMessage({ type: 'room', payload: { id: 'ABCD' } })).toBe(false);
        expect(isValidServerMessage({ type: 'room', payload: { id: 'ABCD', game: { players: null } } })).toBe(false);
        expect(isValidServerMessage({ type: 'room', payload: null })).toBe(false);
    });

    // Go marshals nil slices as null and omits empty strings; those frames are real.
    it('accepts home, error and notice frames with omitted fields', () => {
        expect(isValidServerMessage({ type: 'home', payload: { rooms: null } })).toBe(true);
        expect(isValidServerMessage({ type: 'error', error_key: 'err.table_full' })).toBe(true);
        expect(isValidServerMessage({ type: 'notice' })).toBe(true);
    });

    it('drops non-objects and unknown types', () => {
        expect(isValidServerMessage(null)).toBe(false);
        expect(isValidServerMessage('room')).toBe(false);
        expect(isValidServerMessage({ type: 'home' })).toBe(false);
        expect(isValidServerMessage({ type: 'mystery', payload: {} })).toBe(false);
    });
});
