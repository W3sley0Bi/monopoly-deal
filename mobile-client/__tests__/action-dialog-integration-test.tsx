import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../lib/store', () => ({ useStore: () => 'en' }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

import { ActionDialog } from '../src/components/table/ActionDialog';
import type { Card, GameView, PlayerView } from '../src/types';
import { I18nProvider } from '../src/i18n';

describe('<ActionDialog /> Visual Clarity', () => {
    const slyDealCard: Card = {
        id: 'c_sly_action',
        key: 'action.sly_deal',
        type: 'action',
        action: 'sly_deal',
        name: 'Sly Deal',
        value: 3,
    };

    const dealBreakerCard: Card = {
        id: 'c_db_action',
        key: 'action.deal_breaker',
        type: 'action',
        action: 'deal_breaker',
        name: 'Deal Breaker',
        value: 5,
    };

    const forcedDealCard: Card = {
        id: 'c_fd_action',
        key: 'action.forced_deal',
        type: 'action',
        action: 'forced_deal',
        name: 'Forced Deal',
        value: 3,
    };

    const me: PlayerView = {
        id: 'p_me',
        name: 'Wesley',
        bot: false,
        connected: true,
        hand_count: 5,
        bank: [],
        bank_total: 0,
        sets: [
            {
                color: 'blue',
                cards: [
                    { id: 'c_my_park_place', key: 'property.park_place', type: 'property', name: 'Park Place', value: 4, colors: ['blue'] },
                ],
                buildings: [],
                size: 2,
                complete: false,
                rent: 3,
            },
            {
                color: 'brown',
                cards: [
                    { id: 'c_my_baltic', key: 'property.baltic_avenue', type: 'property', name: 'Baltic Avenue', value: 1, colors: ['brown'] },
                ],
                buildings: [],
                size: 2,
                complete: false,
                rent: 1,
            },
        ],
        complete_sets: 0,
        asset_total: 5,
        has_just_say_no: false,
    };

    const victim: PlayerView = {
        id: 'p_victim',
        name: 'Opponent',
        bot: false,
        connected: true,
        hand_count: 5,
        bank: [],
        bank_total: 0,
        sets: [
            {
                color: 'blue',
                cards: [
                    { id: 'c_boardwalk', key: 'property.boardwalk', type: 'property', name: 'Boardwalk', value: 4, colors: ['blue'] },
                ],
                buildings: [],
                size: 2,
                complete: false,
                rent: 3,
            },
            {
                color: 'green',
                cards: [
                    { id: 'c_nc_ave', key: 'property.north_carolina', type: 'property', name: 'North Carolina Avenue', value: 4, colors: ['green'] },
                    { id: 'c_pac_ave', key: 'property.pacific', type: 'property', name: 'Pacific Avenue', value: 4, colors: ['green'] },
                    { id: 'c_penn_ave', key: 'property.pennsylvania', type: 'property', name: 'Pennsylvania Avenue', value: 4, colors: ['green'] },
                ],
                buildings: [
                    { id: 'c_green_house', key: 'action.house', type: 'action', action: 'house', name: 'House', value: 3 },
                ],
                size: 3,
                complete: true,
                rent: 11,
            },
        ],
        complete_sets: 1,
        asset_total: 16,
        has_just_say_no: true,
    };

    const game: GameView = {
        id: 'ROOM',
        state: 'playing',
        players: [me, victim],
        current_turn: 0,
        plays_left: 3,
        deck_count: 80,
        discard_count: 0,
        discard_top: null,
        pending: null,
        set_sizes: { brown: 2, blue: 2, green: 3 },
        colors: ['brown', 'blue', 'green'],
        mode: 'classic',
        mode_label: 'Classic',
        you: 'p_me',
        log: [],
        turn_seconds: 60,
        respond_seconds: 0,
        bot_difficulty: 'normal',
        deadline_ms: 0,
        deadline_seconds: 0,
        now_ms: 0,
    };

    it('renders Sly Deal target selection with property details and synergy indication', async () => {
        const { getByText, getAllByText, getByLabelText } = await render(
            <I18nProvider>
                <ActionDialog
                    open
                    intent="action"
                    card={slyDealCard}
                    game={game}
                    you="p_me"
                    onClose={() => {}}
                    onSubmit={() => {}}
                />
            </I18nProvider>,
        );

        expect(getAllByText('Sly Deal').length).toBeGreaterThanOrEqual(1);
        // Victim chip displays in-play assets
        expect(getByText('Opponent')).toBeTruthy();

        // Initially shows placeholder to tap card
        expect(getByText('Tap one of their cards to take it.')).toBeTruthy();

        // Tap the Boardwalk card in victim's set
        await fireEvent.press(getByLabelText('Boardwalk'));

        // After selection, targeted property preview displays card name, value, and synergy (completing blue set: 1+1=2)
        expect(getByText(/Blue · \$4M/)).toBeTruthy();
        expect(getByText('Completes your set!')).toBeTruthy();
    });

    it('renders Forced Deal trade preview with you give and you receive columns', async () => {
        const { getByText, getAllByText, getByLabelText } = await render(
            <I18nProvider>
                <ActionDialog
                    open
                    intent="action"
                    card={forcedDealCard}
                    game={game}
                    you="p_me"
                    onClose={() => {}}
                    onSubmit={() => {}}
                />
            </I18nProvider>,
        );

        expect(getAllByText('Forced Deal').length).toBeGreaterThanOrEqual(1);
        expect(getByText(/Swap preview/i)).toBeTruthy();
        expect(getByText('YOU GIVE')).toBeTruthy();
        expect(getByText('YOU RECEIVE')).toBeTruthy();

        // Select their Boardwalk card to receive
        await fireEvent.press(getByLabelText('Boardwalk'));
        // Select our Baltic Avenue to give
        await fireEvent.press(getByLabelText('Baltic Avenue'));

        // Details update inside trade preview
        expect(getByText(/Blue · \$4M/)).toBeTruthy();
        expect(getByText(/Brown · \$1M/)).toBeTruthy();
    });

    it('renders Deal Breaker complete set inspector showing cards, rent, and house/hotel icons', async () => {
        const { getByText, getAllByText, getByTestId, debug } = await render(
            <I18nProvider>
                <ActionDialog
                    open
                    intent="action"
                    card={dealBreakerCard}
                    game={game}
                    you="p_me"
                    onClose={() => {}}
                    onSubmit={() => {}}
                />
            </I18nProvider>,
        );

        expect(getAllByText(/Deal Breaker/).length).toBeGreaterThanOrEqual(1);
        // Victim has 1 full set
        expect(getByText(/1 full set/)).toBeTruthy();

        // Shows Complete set to steal
        expect(getByText('Complete set to steal')).toBeTruthy();
        expect(getByText('GREEN')).toBeTruthy();
        expect(getByText('$11M')).toBeTruthy();
        // Shows house icon
        expect(getByText('⌂')).toBeTruthy();

        // Tap on the green complete set
        await fireEvent.press(getByTestId('complete-set-green'));

        // Selected set summary shows details
        expect(getByText(/Taking: Green/)).toBeTruthy();
    });
});
