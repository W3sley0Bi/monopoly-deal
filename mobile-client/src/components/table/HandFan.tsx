import type { Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Draggable } from '../../game/drag/Draggable';
import {
    FAN_HEADROOM,
    FAN_NUDGE,
    HAND_CARD_HEIGHT,
    HAND_CARD_WIDTH,
    fanLayout,
    fanNudge,
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
    /** Enlarges the fan and its touch geometry together on roomy screens. */
    scale?: number;
    /**
     * Paints every touch strip and reports where the platform actually put it.
     * The hand has had a run of bugs where a card was drawn in one place and
     * answered in another, or stopped answering at all mid-session; guessing at
     * that from the outside has not worked, so the strips can be made visible.
     */
    debug?: boolean;
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
    scale = 1,
    debug,
}: Props) {
    return <>
        {fanLayout(cards, width, scale).map((row, rowIndex) => {
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
                            scale={scale}
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
                    {row.cards.map((card, index) => {
                        const stripLeft = row.left[index] + FAN_NUDGE * scale;
                        const stripWidth = row.strip[index];
                        return (
                        <Draggable
                            key={card.id}
                            state={{ card, from: 'hand' }}
                            axis="vertical"
                            enabled={isPlayable(card)}
                            testID={`hand-drag-${card.id}`}
                            // GestureDetector attaches to Draggable's own native
                            // view, not to this component's child. Size that host
                            // explicitly so later strips cannot stretch across and
                            // steal touches from cards to their left.
                            style={{
                                position: 'absolute',
                                left: stripLeft,
                                top: 0,
                                width: stripWidth,
                                height: row.height,
                            }}
                            // The strip is the handle; the card that flies is the
                            // whole card, which starts below the pop's headroom.
                            ghost={{ dx: 0, dy: FAN_HEADROOM * scale, w: HAND_CARD_WIDTH * scale, h: HAND_CARD_HEIGHT * scale }}
                            onTap={() => onTapCard(card)}
                            onDragStart={onDragStart}
                        >
                            {/* The strip remains readable when its pan is disabled:
                                Draggable enables tap and pan independently. */}
                            <View
                                testID={`hand-strip-${card.id}`}
                                accessible
                                accessibilityRole="button"
                                accessibilityLabel={card.name}
                                accessibilityState={{ selected: card.id === selectedId }}
                                style={[{ width: stripWidth, height: row.height }, debug && styles.debugStrip]}
                                onLayout={debug ? (event) => {
                                    const box = event.nativeEvent.layout;
                                    // eslint-disable-next-line no-console
                                    console.log(
                                        `[hand] strip ${index} ${card.name}`,
                                        `laid out at x=${Math.round(box.x)} w=${Math.round(box.width)}`,
                                        `expected x=${Math.round(stripLeft)} w=${Math.round(stripWidth)}`,
                                    );
                                } : undefined}
                            >
                                {debug ? <Text style={styles.debugLabel}>{index}</Text> : null}
                            </View>
                        </Draggable>
                    )})}
                </View>
            </View>;
        })}
    </>;
}

const styles = StyleSheet.create({
    debugStrip: {
        backgroundColor: '#ff00aa33',
        borderWidth: 1,
        borderColor: '#ff00aacc',
    },
    debugLabel: { color: '#ffffff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
    strips: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
});

export default HandFan;
