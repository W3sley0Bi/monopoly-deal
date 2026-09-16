import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Card as CardT, PlayerView } from '../../types';
import { Card } from '../../ui/card';
import { colorMeta, moneyMeta } from '../../game/meta';
import { useStore } from '../../../lib/store';
import { useI18n } from '../../i18n';
import { uiFont } from '../../../lib/fonts';

/**
 * A stable pseudo-random number for a card, so the scatter below is a property
 * of the card rather than of the render: a table that re-shuffles itself on
 * every state update reads as broken, not as hand-dealt.
 */
function seed(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h);
}

/** -span..span from a card's seed, in `steps` discrete positions. */
function scatter(id: string, shift: number, span: number) {
    const steps = span * 2 + 1;
    return ((seed(id) >> shift) % steps) - span;
}

function MiniCard({ color, value, fresh, left, top, rotate = 0, complete = false }: {
    color: string; value?: number; fresh: boolean; left: number; top: number; rotate?: number; complete?: boolean;
}) {
    const reduced = useReducedMotion();
    const motion = useStore(s => s.motion);
    const progress = useSharedValue(fresh && motion && !reduced ? 0 : 1);
    useEffect(() => {
        progress.value = withTiming(1, { duration: motion && !reduced ? 240 : 0, easing: Easing.out(Easing.cubic) });
    }, [progress, motion, reduced]);
    const animated = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [
            { translateY: -12 * (1 - progress.value) },
            { rotate: `${rotate * progress.value}deg` },
            { scale: 0.75 + 0.25 * progress.value },
        ],
    }));
    return <Animated.View style={[styles.card, { left, top, borderColor: complete ? '#dce64e' : '#232c55' }, animated]}>
        <View style={{ height: 7, backgroundColor: color }} />
        {value !== undefined ? <Text style={styles.value}>{value}</Text> : null}
    </Animated.View>;
}

/** A back flying from the deck to a seat, then gone. */
function DrawFlight({ from, to, spin, onDone }: {
    from: { x: number; y: number }; to: { x: number; y: number }; spin: number; onDone: () => void;
}) {
    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }, (done) => {
            if (done) runOnJS(onDone)();
        });
    }, [progress, onDone]);
    const animated = useAnimatedStyle(() => {
        const p = progress.value;
        return {
            opacity: p < 0.85 ? 1 : 1 - (p - 0.85) / 0.15,
            transform: [
                { translateX: from.x + (to.x - from.x) * p },
                { translateY: from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * 14 },
                { rotate: `${spin * p}deg` },
                { scale: 1 - 0.25 * p },
            ],
        };
    });
    return <Animated.View pointerEvents="none" style={[styles.flight, animated]} />;
}

// A mini card is CARD_W x CARD_H and each card in a stack is offset, so a stack is
// CARD_W+FAN wide and CARD_H+FAN tall. The grid pitch has to clear that or
// neighbouring colours sit on top of each other.
const CARD_W = 18;
const CARD_H = 26;
const FAN_STEPS = 2;
const FAN = FAN_STEPS * 2;
const STACK_W = CARD_W + FAN;
const STACK_H = CARD_H + FAN;
const GAP = 3;
const COL = STACK_W + GAP;
const ROW = STACK_H + GAP;
const COLS = 3;

// A seat's box has to clear three stacks plus the bank stack beside them.
const SEAT_W = 3 * COL + STACK_W;
const SEAT_H = 2 * ROW + 12;

// The two piles at the middle of the felt.
const DECK_W = 30;
const DECK_H = 43;

/**
 * A play mat, not a card table. Green baize is the visual language of a casino
 * and this is a game children play, so the mat is a blueberry board-game
 * surface: still dark enough for the glass panels, and red card backs and brass
 * accents read louder on it than they did on teal.
 */
const MAT = ['#4a5893', '#5b6aa6', '#2f3a69'] as const;

/** The room the table stands in: darker, so the mat reads as a lit surface. */
const ROOM = ['#151a33', '#0e1226'] as const;

/** How flat a circle on the table looks from a player's chair. */
const FLATTEN = 0.46;

/**
 * How much smaller the far side of the table is than the near side. Shallow
 * enough that the far seats stay tappable where they look.
 */
const DEPTH = 0.16;

interface Flight {
    key: string;
    to: { x: number; y: number };
    spin: number;
}

/** Stable seats and public cards only, matching the web FeltCards layer. */
export function FeltTable({
    players,
    you,
    cardAreaHeight,
    deckCount,
    discardCount,
    discardTop,
    onOpenPlayer,
    onPreviewPlayer,
    onPreviewEnd,
    onOpenDiscard,
}: {
    players: PlayerView[];
    you: string;
    cardAreaHeight: number;
    deckCount: number;
    discardCount: number;
    discardTop: CardT | null;
    onOpenPlayer: (id: string) => void;
    onPreviewPlayer: (id: string) => void;
    onPreviewEnd: (id: string) => void;
    onOpenDiscard?: () => void;
}) {
    const { t } = useI18n();
    const reduced = useReducedMotion();
    const motion = useStore(s => s.motion);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const previous = useRef<Set<string> | null>(null);
    const ids = new Set(players.flatMap(p => [...p.bank, ...p.sets.flatMap(s => s.cards)].map(c => c.id)));
    const fresh = (id: string) => previous.current !== null && !previous.current.has(id);
    useEffect(() => { previous.current = ids; });
    const start = players.findIndex(p => p.id === you);
    const seats = start < 0 ? players : [...players.slice(start), ...players.slice(0, start)];

    const seatAt = (index: number) => {
        const angle = Math.PI / 2 + index * 2 * Math.PI / seats.length;
        // Your own pile sits further out than the others: it is the one you
        // read constantly, and at the shared radius it crowded the deck.
        const reach = index === 0 ? 0.34 : 0.23;
        return {
            x: size.width * (0.5 + Math.cos(angle) * 0.26) - SEAT_W / 2,
            y: Math.max(90, cardAreaHeight) * (0.56 + Math.sin(angle) * reach) - SEAT_H / 3,
            angle,
        };
    };
    const centre = { x: size.width * 0.5 - DECK_W - 4, y: Math.max(90, cardAreaHeight) * 0.56 - DECK_H / 2 };

    // Cards leaving the deck for a seat. Driven by hand counts rather than by
    // the deck count alone: that is what says *who* drew, and it covers Pass Go
    // and the deal as well as the turn draw.
    const [flights, setFlights] = useState<Flight[]>([]);
    const hands = useRef<Map<string, number> | null>(null);
    const flightId = useRef(0);
    useEffect(() => {
        const now = new Map(players.map(p => [p.id, p.hand_count]));
        const before = hands.current;
        hands.current = now;
        if (!before || !size.width || !motion || reduced) return;
        const next: Flight[] = [];
        seats.forEach((player, index) => {
            const drawn = (now.get(player.id) ?? 0) - (before.get(player.id) ?? 0);
            if (drawn <= 0) return;
            const seat = seatAt(index);
            // Two is enough to read as "a draw"; five would be a shuffle.
            for (let i = 0; i < Math.min(drawn, 2); i++) {
                next.push({
                    key: `f${flightId.current++}`,
                    to: { x: seat.x + SEAT_W / 3, y: seat.y + 16 },
                    spin: scatter(`${player.id}${i}`, 0, 12),
                });
            }
        });
        if (next.length) setFlights(current => [...current, ...next]);
        // Seats and geometry are read, not depended on: a flight is triggered by
        // the hand counts changing and nothing else.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players, size.width, motion, reduced]);

    return <View style={styles.scene} pointerEvents="box-none"
        onLayout={e => setSize(e.nativeEvent.layout)}>
        <View style={styles.stage} pointerEvents="box-none">
        {/* Two layers make the depth: the room behind, and an oval table top
            sitting in it. An ellipse wider than the screen is what a round
            table looks like from a chair — the old dome was a top-down view
            with a rounded lid, which is why nothing on it looked seated. */}
        <LinearGradient pointerEvents="none" colors={ROOM} style={styles.room} />
        <LinearGradient
            pointerEvents="none"
            colors={MAT}
            locations={[0, 0.5, 1]}
            style={[styles.mat, {
                width: size.width * 1.3,
                left: -size.width * 0.15,
                height: Math.max(150, Math.max(90, cardAreaHeight) * 1.62),
                borderRadius: size.width * 0.65,
            }]}
        >
            {/* The play circle reads as a circle lying on the table only if it
                is drawn as the ellipse a circle becomes at this angle. */}
            <View style={[styles.orbit, {
                width: size.width * 0.66,
                height: size.width * 0.66 * FLATTEN,
                left: size.width * 0.32,
                top: Math.max(24, Math.max(90, cardAreaHeight) * 0.56 - size.width * 0.33 * FLATTEN),
                borderRadius: size.width * 0.33,
            }]} />
        </LinearGradient>

        {size.width > 0 ? (
            <View style={[styles.centre, { left: centre.x, top: centre.y }]} pointerEvents="box-none">
                {/* The draw pile: a few backs, each sitting slightly off true. */}
                <View style={styles.pile} pointerEvents="none">
                    {Array.from({ length: Math.min(4, Math.max(1, Math.ceil(deckCount / 14))) }, (_, i) => (
                        <View key={i} style={[styles.deckCard, {
                            left: i * 0.8,
                            top: -i * 1.2,
                            transform: [{ rotate: `${(i % 2 ? 1 : -1) * (1 + i * 0.6)}deg` }],
                        }]} />
                    ))}
                    <Text style={styles.pileCount}>{deckCount}</Text>
                </View>

                <Pressable
                    style={styles.pile}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('table.discard')}: ${discardCount}`}
                    onPress={onOpenDiscard}
                >
                    {discardTop ? (
                        <View style={[styles.discardCard, {
                            transform: [{ rotate: `${scatter(discardTop.id, 2, 7)}deg` }],
                        }]}>
                            <View style={styles.discardScale} pointerEvents="none">
                                <Card card={discardTop} size="xs" />
                            </View>
                        </View>
                    ) : (
                        <View style={styles.discardEmpty} />
                    )}
                    <Text style={styles.pileCount}>{discardCount}</Text>
                </Pressable>
            </View>
        ) : null}

        {flights.map(flight => (
            <DrawFlight
                key={flight.key}
                from={{ x: centre.x + 2, y: centre.y + 2 }}
                to={flight.to}
                spin={flight.spin}
                onDone={() => setFlights(current => current.filter(f => f.key !== flight.key))}
            />
        ))}

        {size.width > 0 && seats.map((player, seat) => {
            const place = seatAt(seat);
            const angle = place.angle;
            const rotation = Math.round((angle * 180 / Math.PI - 90) / 90) * 90;
            const bank = [...player.bank].sort((a, b) => a.value - b.value).slice(-4);
            const columns = Math.min(COLS, player.sets.length);
            const rows = Math.ceil(player.sets.length / COLS);
            const propertyWidth = columns ? (columns - 1) * COL + STACK_W + GAP : 0;
            const pileWidth = Math.max(14, propertyWidth + (bank.length ? STACK_W : 0));
            const pileHeight = Math.max(STACK_H, rows * ROW - GAP);
            if (!player.sets.length && !bank.length) return null;
            return <CardPileButton
                key={player.id}
                playerId={player.id}
                onOpen={onOpenPlayer}
                onPreview={onPreviewPlayer}
                onPreviewEnd={onPreviewEnd}
                accessibilityLabel={`${player.name}: ${t('inspect.open_board')}`}
                style={[styles.seat, { left: place.x, top: place.y }]}>
                {/* Depth: a seat across the table is further away, so its cards
                    are smaller and sit a little flatter than your own. */}
                <View pointerEvents="none" style={[styles.piles, {
                    width: pileWidth,
                    height: pileHeight,
                    transformOrigin: 'center top',
                    transform: [
                        { rotate: `${rotation}deg` },
                        { scale: 1 - DEPTH * (0.5 - Math.sin(angle) * 0.5) },
                        { scaleY: 1 - DEPTH * 0.5 * (0.5 - Math.sin(angle) * 0.5) },
                    ],
                }]}>
                    {/* Each card sits a degree or two off its slot: a pile that
                        is perfectly square reads as a spreadsheet, not a table. */}
                    {player.sets.map((set, group) => <View key={set.color} style={{ position: 'absolute', left: (group % COLS) * COL, top: Math.floor(group / COLS) * ROW }}>
                        {set.cards.map((card, i) => <MiniCard key={card.id} color={colorMeta(set.color).hex}
                            left={Math.min(i, FAN_STEPS) * 2 + scatter(card.id, 0, 1)}
                            top={Math.min(i, FAN_STEPS) * 2 + scatter(card.id, 3, 1)}
                            rotate={scatter(card.id, 6, 6)}
                            fresh={fresh(card.id)} complete={set.complete} />)}
                    </View>)}
                    {bank.map((card, i) => <MiniCard key={card.id} color={moneyMeta(card.value).hex}
                        value={card.value}
                        left={propertyWidth + Math.min(bank.length - 1 - i, FAN_STEPS) * 2 + scatter(card.id, 0, 1)}
                        top={Math.min(bank.length - 1 - i, FAN_STEPS) * 2 + scatter(card.id, 3, 1)}
                        rotate={scatter(card.id, 6, 6)}
                        fresh={fresh(card.id)} />)}
                </View>
            </CardPileButton>;
        })}
        </View>
    </View>;
}

function CardPileButton({
    playerId,
    onOpen,
    onPreview,
    onPreviewEnd,
    children,
    style,
    accessibilityLabel,
}: {
    playerId: string;
    onOpen: (id: string) => void;
    onPreview: (id: string) => void;
    onPreviewEnd: (id: string) => void;
    children: React.ReactNode;
    style: StyleProp<ViewStyle>;
    accessibilityLabel: string;
}) {
    const holding = useRef(false);
    const suppressTap = useRef(false);

    return (
        <Pressable
            style={style}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            delayLongPress={260}
            onLongPress={() => {
                holding.current = true;
                suppressTap.current = true;
                onPreview(playerId);
            }}
            onPressOut={() => {
                if (!holding.current) return;
                holding.current = false;
                onPreviewEnd(playerId);
            }}
            onPress={() => {
                if (suppressTap.current) {
                    suppressTap.current = false;
                    return;
                }
                onOpen(playerId);
            }}
        >
            {children}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    scene: { flex: 1 },
    // No `rotateX` here, however much it would suit: the felt is the subtree
    // the glass panels blur, and a 3D-transformed layer inside that snapshot
    // does not render on iOS — the whole table disappears. Depth is faked in
    // 2D instead, by scaling each seat with its distance from the near edge.
    stage: { flex: 1 },
    room: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    mat: {
        position: 'absolute',
        top: 4,
        borderWidth: 2,
        borderColor: '#c8d2ff42',
        // The rim catches light from above, which is most of what says the
        // table has an edge rather than being a painted background.
        boxShadow: '0px 10px 26px #05081c8f, inset 0px 2px 0px #e3e9ff2e',
    },
    orbit: { position: 'absolute', borderWidth: 1, borderColor: '#ccd5ff2b', borderStyle: 'dashed' },
    seat: { position: 'absolute', width: SEAT_W, height: SEAT_H, gap: 7 },
    piles: { width: SEAT_W, height: SEAT_H - 20 },
    card: { position: 'absolute', width: CARD_W, height: CARD_H, backgroundColor: '#f7f2df', borderWidth: 1, borderRadius: 2, overflow: 'hidden', boxShadow: '0px 2px 3px #12173866' },
    value: { fontFamily: uiFont(900), fontSize: 10, color: '#183139', textAlign: 'center' },
    // The two centre piles lie on the table like everything else, so they are
    // squashed by the same amount a card in the middle distance would be.
    centre: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        transformOrigin: 'center top',
        transform: [{ scaleY: 0.9 }],
    },
    pile: { width: DECK_W, height: DECK_H + 14, alignItems: 'center' },
    deckCard: {
        position: 'absolute',
        width: DECK_W,
        height: DECK_H,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1d2448',
        backgroundColor: '#b42234',
        boxShadow: '0px 3px 6px #10143073',
    },
    discardCard: {
        width: DECK_W,
        height: DECK_H,
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0px 3px 6px #10143073',
    },
    // The real card face, shrunk: the discard is the one pile whose identity
    // matters, and a coloured rectangle cannot say "Forced Deal".
    discardScale: { width: DECK_W / 0.54, height: DECK_H / 0.54, transform: [{ scale: 0.54 }], transformOrigin: 'top left' },
    discardEmpty: {
        width: DECK_W,
        height: DECK_H,
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#d5dcff26',
    },
    pileCount: { marginTop: DECK_H + 2, fontFamily: uiFont(800), fontSize: 10, color: '#dbe2ffb8' },
    flight: {
        position: 'absolute',
        width: DECK_W,
        height: DECK_H,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#1d2448',
        backgroundColor: '#b42234',
        boxShadow: '0px 4px 8px #1014308c',
    },
});
