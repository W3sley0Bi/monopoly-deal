import { cleanup, fireEvent, render } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';

import { HandFan } from '../src/components/table/HandFan';
import { HAND_CARD_WIDTH } from '../src/game/handFan';
import type { Card as CardT } from '../src/types';

// The fan is on trial here, not the card face: a real Card pulls in fonts, SVG
// and artwork that say nothing about which card a finger lands on.
jest.mock('../src/ui/card', () => {
    const { Text: T, View: V } = require('react-native');
    return {
        Card: ({ card }: { card: CardT }) => <T testID={`face-${card.id}`}>{card.name}</T>,
        WildFlip: ({ children }: { children: (shown: null) => React.ReactNode }) => children(null),
        FanSlot: ({ children, index, popped }: { children: React.ReactNode; index: number; popped: number | null }) => (
            <V testID={`slot-${index}${popped === index ? '-popped' : ''}`}>{children}</V>
        ),
    };
});

jest.mock('../src/game/drag/Draggable', () => {
    const { Pressable: P } = require('react-native');
    return {
        Draggable: ({ children, onTap }: { children: React.ReactNode; onTap?: () => void }) => (
            <P onPress={onTap}>{children}</P>
        ),
    };
});

const hand = (count: number): CardT[] =>
    Array.from({ length: count }, (_, i) => ({
        id: `c${i}`,
        key: `card.prop${i}`,
        name: `Card ${i}`,
        type: 'property',
        value: 2,
        colors: ['brown'],
    })) as unknown as CardT[];

async function mount(cards: CardT[], overrides: Partial<React.ComponentProps<typeof HandFan>> = {}) {
    const onTapCard = jest.fn();
    const screen = await render(
        <HandFan
            cards={cards}
            width={359}
            selectedId={null}
            carriedId={null}
            wildColor={{}}
            isPlayable={() => true}
            onTapCard={onTapCard as unknown as (card: CardT) => void}
            onDragStart={() => {}}
            {...overrides}
        />,
    );
    return { screen, onTapCard };
}

describe('<HandFan />', () => {
    // Rendered trees are torn down by hand: this file mounts the fan many times
    // over, and a tree left standing answers the next test's queries.
    afterEach(async () => { await cleanup(); });

    it('answers a tap on every card, not only the ones on top of the stack', async () => {
        // The regression: with nine cards the fan overlaps, and only the last
        // few cards in the stack were answering a tap at all.
        const cards = hand(9);
        const { screen, onTapCard } = await mount(cards);

        for (const card of cards) {
            await fireEvent.press(screen.getByTestId(`hand-strip-${card.id}`));
        }

        expect(onTapCard).toHaveBeenCalledTimes(cards.length);
        expect((onTapCard.mock.calls as unknown as [CardT][]).map(([card]) => card.id))
            .toEqual(cards.map((card) => card.id));
    });

    it('sends a tap to the card whose strip was touched and to no other', async () => {
        const cards = hand(9);
        const { screen, onTapCard } = await mount(cards);

        await fireEvent.press(screen.getByTestId('hand-strip-c3'));

        expect(onTapCard).toHaveBeenCalledTimes(1);
        expect((onTapCard.mock.calls as unknown as [CardT][])[0][0].id).toBe('c3');
    });

    it('still answers a tap on a card that cannot be played', async () => {
        // Off-turn a card cannot be dragged, but reading it is exactly when you
        // need to: the strip must not go dead with the drag.
        const cards = hand(5);
        const { screen, onTapCard } = await mount(cards, { isPlayable: () => false });

        await fireEvent.press(screen.getByTestId('hand-strip-c2'));

        expect(onTapCard).toHaveBeenCalledTimes(1);
    });

    it('keeps the remaining cards interactive after a played card leaves the hand', async () => {
        const cards = hand(5);
        const onTapCard = jest.fn();
        const props: React.ComponentProps<typeof HandFan> = {
            cards,
            width: 359,
            selectedId: null,
            carriedId: null,
            wildColor: {},
            isPlayable: () => true,
            onTapCard: onTapCard as unknown as (card: CardT) => void,
            onDragStart: () => {},
        };
        const screen = await render(<HandFan {...props} />);

        await screen.rerender(<HandFan {...props} cards={cards.slice(1)} />);
        await fireEvent.press(screen.getByTestId('hand-strip-c1'));

        expect(onTapCard).toHaveBeenCalledTimes(1);
        expect((onTapCard.mock.calls as unknown as [CardT][])[0][0].id).toBe('c1');
    });

    it('gives each card a strip as wide as the part of it you can see', async () => {
        const cards = hand(9);
        const { screen } = await mount(cards);

        const widths = cards.map((card) => {
            const style = screen.getByTestId(`hand-strip-${card.id}`).props.style;
            return (Array.isArray(style) ? Object.assign({}, ...style.flat()) : style).width as number;
        });

        expect(widths[widths.length - 1]).toBe(HAND_CARD_WIDTH);
        for (const width of widths) expect(width).toBeGreaterThan(0);
        // Uniform overlap: every hidden card gives up the same amount.
        for (const width of widths.slice(0, -1)) expect(width).toBeCloseTo(widths[0]);
    });

    it('paints the popped card last, so nothing is left covering it', async () => {
        const cards = hand(9);
        const { screen } = await mount(cards, { selectedId: 'c2' });

        const slots = screen.getAllByTestId(/^slot-/).map((node) => node.props.testID as string);

        expect(slots[slots.length - 1]).toBe('slot-2-popped');
        expect(slots).toHaveLength(cards.length);
    });

    it('leaves the strips where they are while a card is popped', async () => {
        // A target that moves under a thumb is worse than one slightly offset,
        // so the pop moves the picture and not the places you can touch.
        const cards = hand(9);
        const before = (await mount(cards)).screen.getByTestId('hand-strip-c4').props.style;
        const after = (await mount(cards, { selectedId: 'c2' })).screen.getByTestId('hand-strip-c4').props.style;

        expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    });

    it('lays a hand too wide for one row into rows that all stay touchable', async () => {
        const cards = hand(9);
        const { screen, onTapCard } = await mount(cards, { width: 240 });

        expect(screen.getAllByTestId(/^hand-row-/).length).toBeGreaterThan(1);
        for (const card of cards) {
            await fireEvent.press(screen.getByTestId(`hand-strip-${card.id}`));
        }
        expect(onTapCard).toHaveBeenCalledTimes(cards.length);
    });

    it('draws no hand at all when there is none', async () => {
        const { screen } = await mount([]);
        expect(screen.queryAllByTestId(/^hand-strip-/)).toHaveLength(0);
    });
});
