import type { Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Draggable } from '../../game/drag/Draggable';
import {
    FAN_HEADROOM,
    FAN_NUDGE,
    HAND_CARD_HEIGHT,
    HAND_CARD_WIDTH,
    fanLayout,
} from '../../game/handFan';
import type { Card as CardT, Color } from '../../types';
import { Card, FanSlot, WildFlip } from '../../ui/card';

interface Props {
    cards: CardT[];
    /** Width the fan may use, already free of its panel's padding. */
    width: number;
    selectedId: string | null;
    carriedId: string | null;
    wildColor: Record<string, Color | undefined>;
    /** Whether this card can be picked up right now. */
    isPlayable: (card: CardT) => boolean;
    onTapCard: (card: CardT) => void;
    onDragStart: () => void;
    /** The card the tutorial is pointing at, and where to report it. */
    anchorCardId?: string | null;
    anchorRef?: Ref<View>;
    onAnchorLayout?: () => void;
}

/**
 * The hand, fanned.
 *
 * Two layers, deliberately. The cards overlap, so their boxes overlap, and a
 * stack of overlapping boxes does not agree with the fan about which card a
 * finger is on — a pull found the card you meant, a still finger often found a
 * different one. So the cards are painted and nothing else, and every touch
 * goes to a strip exactly as wide as the part of its card you can see. The
 * strips tile the row and never overlap, which leaves nothing to resolve.
 */
export function HandFan({
    cards,
    width,
    selectedId,
    carriedId,
    wildColor,
    isPlayable,
    onTapCard,
    onDragStart,
    anchorCardId,
    anchorRef,
    onAnchorLayout,
}: Props) {
    return <>
        {fanLayout(cards, width).map((row, rowIndex) => {
            const popped = row.cards.findIndex((card) => card.id === selectedId);
            // Paint order is child order, so the popped card goes last. Keys
            // keep each card's identity across the reorder.
            const painted = row.cards
                .map((card, index) => ({ card, index }))
                .sort((a, b) => Number(a.index === popped) - Number(b.index === popped));

            return <View
                key={`hand-row-${rowIndex}`}
                testID={`hand-row-${rowIndex}`}
                style={{ position: 'relative', width: row.width, height: row.height }}
            >
                <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                    {painted.map(({ card, index }) => (
                        <FanSlot
                            key={card.id}
                            index={index}
                            count={row.cards.length}
                            left={row.left[index]}
                            popped={popped < 0 ? null : popped}
                        >
                            <View
                                ref={card.id === anchorCardId ? anchorRef : undefined}
                                collapsable={false}
                                onLayout={card.id === anchorCardId ? onAnchorLayout : undefined}
                            >
                                {/* A two-colour wildcard turns rather than redrawing:
                                    tapping it is the same gesture as turning the card
                                    round on a real table. */}
                                <WildFlip active={wildColor[card.id] ?? null}>
                                    {(shown) => (
                                        <Card
                                            card={card}
                                            size="hand"
                                            activeColor={shown ?? null}
                                            selected={card.id === selectedId}
                                            disabled={!isPlayable(card)}
                                            dimmed={!isPlayable(card) || card.id === carriedId}
                                        />
                                    )}
                                </WildFlip>
                            </View>
                        </FanSlot>
                    ))}
                </View>

                <View style={styles.strips}>
                    {row.cards.map((card, index) => (
                        <Draggable
                            key={card.id}
                            state={{ card, from: 'hand' }}
                            axis="vertical"
                            enabled={isPlayable(card)}
                            // The strip is the handle; the card that flies is the
                            // whole card, which starts below the pop's headroom.
                            ghost={{ dx: 0, dy: FAN_HEADROOM, w: HAND_CARD_WIDTH, h: HAND_CARD_HEIGHT }}
                            onDragStart={onDragStart}
                        >
                            {/* A plain press, not a tap gesture: a card that cannot
                                be played is still one you may need to read, and the
                                press has to answer even where the pan is switched
                                off. */}
                            <Pressable
                                testID={`hand-strip-${card.id}`}
                                accessibilityRole="button"
                                onPress={() => onTapCard(card)}
                                style={{ width: row.strip[index], height: row.height }}
                            />
                        </Draggable>
                    ))}
                </View>
            </View>;
        })}
    </>;
}

const styles = StyleSheet.create({
    strips: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        paddingLeft: FAN_NUDGE,
    },
});

export default HandFan;
