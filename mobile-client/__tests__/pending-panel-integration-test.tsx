import { render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../lib/store', () => ({ useStore: () => 'en' }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }] }));

import { PendingPanel } from '../src/components/table/PendingPanel';
import type { Card, Pending, PlayerView } from '../src/types';
import { I18nProvider } from '../src/i18n';

describe('<PendingPanel />', () => {
    const card: Card = {
        id: 'c1',
        key: 'action.birthday',
        type: 'action',
        action: 'birthday',
        name: "It's My Birthday",
        value: 2,
    };

    const pending: Pending = {
        kind: 'payment',
        action: 'birthday',
        card,
        by_id: 'p_instigator_1',
        label_key: 'pending.birthday',
        label_args: { amount: 2 },
        targets: [
            {
                player_id: 'p_victim_4324234',
                amount: 2,
                responder: 'p_victim_4324234',
                cancelled: false,
                settled: false,
            },
        ],
    };

    const players: PlayerView[] = [
        {
            id: 'p_instigator_1',
            name: 'Alice',
            bot: false,
            connected: true,
            hand_count: 5,
            bank: [],
            bank_total: 0,
            sets: [],
            complete_sets: 0,
            asset_total: 0,
            has_just_say_no: false,
        },
        {
            id: 'p_victim_4324234',
            name: 'Bob',
            bot: false,
            connected: true,
            hand_count: 5,
            bank: [],
            bank_total: 0,
            sets: [],
            complete_sets: 0,
            asset_total: 0,
            has_just_say_no: false,
        },
    ];

    it('renders player names instead of player IDs in bystander roster and action note', async () => {
        const { getByText, queryByText } = await render(
            <I18nProvider>
                <PendingPanel
                    pending={pending}
                    role="bystander"
                    myTarget={null}
                    you="p_viewer_999"
                    players={players}
                    skewMs={0}
                    onRespond={() => {}}
                />
            </I18nProvider>,
        );

        // Should display Bob's name, not p_victim_4324234
        expect(getByText('Bob')).toBeTruthy();
        expect(queryByText('p_victim_4324234')).toBeNull();

        // Should display that Alice played It's My Birthday
        expect(getByText("Alice played It's My Birthday.")).toBeTruthy();
        expect(queryByText('p_instigator_1')).toBeNull();
    });
});
