import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import type { Card as CardT, Color, PlayerView, SetView } from '../../types';
import { Card } from '../../ui/card';
import { MiniBuilding, type BuildingKind, type HotelVisual } from './MiniBuilding';
import { colorMeta, moneyMeta } from '../../game/meta';
import { useStore } from '../../../lib/store';
import { useI18n } from '../../i18n';
import { brand } from '../../../lib/theme';
import { uiFont } from '../../../lib/fonts';
import {
    FLAT_CAMERA,
    PROPERTY_SLOT_COUNT,
    TABLE_SEAT_COUNT,
    TILTED_CAMERA,
    fitTiltedRing,
    projectFelt,
    reconcilePropertySlots,
    seatAngle,
    tableSeatSlots,
    tiltedChair,
    tiltedPileScale,
    tableRadii,
} from '../../game/feltLayout';
import Svg, { Defs, LinearGradient as SvgGradient, Polygon, Stop } from 'react-native-svg';

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

/**
 * What stands on a set: nothing, a house, or a hotel. Read off the set rather
 * than remembered, so a building paid away takes the model down on the next
 * frame without any bookkeeping of its own.
 */
function built(set: SetView): BuildingKind {
    if (!set.complete || !set.buildings.length) return 'none';
    return set.buildings.some(b => b.action === 'hotel') ? 'hotel' : 'house';
}

/** -span..span from a card's seed, in `steps` discrete positions. */
function scatter(id: string, shift: number, span: number) {
    const steps = span * 2 + 1;
    return ((seed(id) >> shift) % steps) - span;
}

function MiniCard({ color, value, fresh, left, top, rotate = 0, complete = false, unit = 1 }: {
    color: string; value?: number; fresh: boolean; left: number; top: number; rotate?: number; complete?: boolean;
    /** Screen points per layout point; see `unit` on the seat below. */
    unit?: number;
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
            { translateY: -12 * unit * (1 - progress.value) },
            { rotate: `${rotate * progress.value}deg` },
            { scale: 0.75 + 0.25 * progress.value },
        ],
    }));
    return <Animated.View style={[styles.card, {
        left: left * unit,
        top: top * unit,
        width: CARD_W * unit,
        height: CARD_H * unit,
        borderWidth: 0.75 * unit,
        borderRadius: 2 * unit,
        borderColor: complete ? '#dce64e' : '#232c55',
    }, animated]}>
        <View style={{ height: 7 * unit, backgroundColor: color }} />
        {value !== undefined ? <Text style={[styles.value, { fontSize: 8 * unit, lineHeight: 11 * unit }]}>{value}</Text> : null}
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
const CARD_W = 14;
const CARD_H = 20;
const FAN_STEPS = 2;
const FAN_OFFSET = 3;
const FAN = FAN_STEPS * FAN_OFFSET;
const STACK_W = CARD_W + FAN;
const STACK_H = CARD_H + FAN;
/** Buildings occupy a property cell without reaching into a neighbouring set. */
const BUILDING_FOOTPRINT_SCALE = 0.84;
const IS_WEB = Platform.OS === 'web';
const SLOT_GAP = 2;
const COL = STACK_W + SLOT_GAP;
const ROW = STACK_H + SLOT_GAP;
const COLS = 5;
const ROWS = Math.ceil(PROPERTY_SLOT_COUNT / COLS);
const PROPERTY_GRID_W = COLS * COL - SLOT_GAP;
const PROPERTY_GRID_H = ROWS * ROW - SLOT_GAP;
const BANK_GAP = 3;
const BANK_LEFT = PROPERTY_GRID_W + BANK_GAP;
const BANK_W = STACK_W + 6;
const BANK_VERTICAL_INSET = 3;

/**
 * Every chair owns the same ten property cells and one bank lane. The content
 * never changes these dimensions, which is the core stability guarantee.
 */
const PILE_W = BANK_LEFT + BANK_W;
const PILE_H = PROPERTY_GRID_H;
const SEAT = Math.ceil(Math.hypot(PILE_W, PILE_H));
/** Clear space between two neighbouring blocks on the ring. */
const SEAT_GAP = 22;
/** Pull the ring clear of the screen-edge overlays, such as the activity log. */
const SEAT_RING_INSET = 0.15;

/**
 * Give roomy phones a little more table presence without making compact
 * devices crowded. 390pt is the iPhone 16's logical width; larger screens
 * cap at a 25% increase rather than growing without limit.
 */
function pileScaleForWidth(width: number) {
    return Math.min(1.25, Math.max(1, 1 + (width - 320) * 0.25 / 70));
}

// The two piles at the middle of the felt.
const DECK_W = 30;
const DECK_H = 43;
/**
 * The Pass Go prompt's line box, centred on the deck. Wide enough for the
 * longest of the three translations on one line — it is not allowed to clamp
 * itself, so a line that does not fit would wrap into the felt instead.
 */
const PROMPT_W = 120;

/**
 * A play mat, not a card table. Green baize is the visual language of a casino
 * and this is a game children play, so the mat is a blueberry board-game
 * surface: still dark enough for the glass panels, and red card backs and brass
 * accents read louder on it than they did on teal.
 */
const MAT = ['#4a5893', '#5b6aa6', '#2f3a69'] as const;

/** The travelling turn lamp: three dots, the plays left in the current turn. */
const MARKER_W = 34;
const MARKER_H = 14;
/** How far outside the seat ring it rides, clear of everyone's cards. */
const MARKER_OUT = -60;

/** Timing for the lamp's trip round the ring; instant when motion is off. */
function animateMarker(target: number, animate: boolean) {
    'worklet';
    return animate
        ? withTiming(target, { duration: 520, easing: Easing.inOut(Easing.cubic) })
        : target;
}

/** How far inside the table edge the rim line runs. */
const RIM = 12;

/** The room the table stands in: darker, so the mat reads as a lit surface. */
const ROOM = ['#151a33', '#0e1226'] as const;

/**
 * How much smaller the far side of the table is than the near side. Shallow
 * enough that the far seats stay tappable where they look.
 */
const DEPTH = 0.16;

/** A seat's tap target, in coordinates local to the felt. */
export interface SeatHit {
    id: string;
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Where a remote player's chip stands, in coordinates local to the felt. */
export interface ChairAnchor {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Clear space between a seat's cards and the chip standing behind them. */
const CHIP_GAP = 10;
/** Keeps the tilted ring's outermost chip off the very edge of the screen. */
const TILT_MARGIN = 10;
/** Gap between neighbouring seats on a tilted table, as a share of a seat. */
const TILT_SEAT_GAP = 0.32;
/** Points along the tilted table's outline; plenty for a smooth oval. */
const OVAL_STEPS = 72;
/** How far the table's apron shows below its near edge. */
const APRON = 9;

interface Flight {
    key: string;
    to: { x: number; y: number };
    spin: number;
}

/** Stable seats and public cards only, matching the web FeltCards layer. */
export function FeltTable({
    players,
    you,
    layoutKey,
    cardAreaHeight,
    deckCount,
    discardCount,
    discardTop,
    turnId,
    playsLeft = 3,
    onSeats,
    onOpenDiscard,
    onDrawTwo,
    debugSeats,
    hotelVisual = 'hotel',
    tilted = false,
    chip,
    onChairs,
    centreAction,
}: {
    players: PlayerView[];
    you: string;
    /** Changes once per match, resetting client-local property slot history. */
    layoutKey: string;
    cardAreaHeight: number;
    deckCount: number;
    discardCount: number;
    discardTop: CardT | null;
    /** Whose turn it is; the live marker rides round to their seat. */
    turnId?: string;
    /** Plays the active player has left, drawn as the marker's three dots. */
    playsLeft?: number;
    onSeats?: (seats: SeatHit[]) => void;
    onOpenDiscard?: () => void;
    /**
     * Set only while the player is holding a Pass Go they could play now. The
     * deck then offers it: the prompt appears on the pile and a tap plays the
     * card, which is the gesture the card describes — you take two off the top.
     * Undefined leaves the deck the scenery it normally is.
     */
    onDrawTwo?: () => void;
    /** Dev only: outlines each seat box where the felt itself thinks it is. */
    debugSeats?: boolean;
    /** Optional artwork experiment; gameplay remains a normal hotel. */
    hotelVisual?: HotelVisual;
    /**
     * Lean the mat away from the player (roomy screens). The ring, the chairs
     * and the seat maths are the same; only the camera changes.
     */
    tilted?: boolean;
    /** The chip size to reserve beside each remote chair; tilted tables only. */
    chip?: { w: number; h: number };
    /** Where each remote chair's chip goes, for the table screen to render. */
    onChairs?: (chairs: ChairAnchor[]) => void;
    /** A roomy-screen drop target placed beside the centre deck and discard. */
    centreAction?: ReactNode;
}) {
    const { t } = useI18n();
    const reduced = useReducedMotion();
    const motion = useStore(s => s.motion);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const viewport = useWindowDimensions();
    const previous = useRef<Set<string> | null>(null);
    const ids = new Set(players.flatMap(p => [...p.bank, ...p.sets.flatMap(s => s.cards)].map(c => c.id)));
    const fresh = (id: string) => previous.current !== null && !previous.current.has(id);
    useEffect(() => { previous.current = ids; });
    const start = players.findIndex(p => p.id === you);
    const seats = start < 0 ? players : [...players.slice(start), ...players.slice(0, start)];
    const assignedTableSlots = tableSeatSlots(seats.length);

    // The server preserves first-created set order but prunes empty sets. Keep
    // the missing cells locally so the remaining colours never close the gap.
    const propertySlots = useRef(new Map<string, (Color | null)[]>());
    const propertySlotsKey = useRef(layoutKey);
    if (propertySlotsKey.current !== layoutKey) {
        propertySlotsKey.current = layoutKey;
        propertySlots.current.clear();
    }
    const activePlayers = new Set(seats.map(player => player.id));
    for (const playerId of propertySlots.current.keys()) {
        if (!activePlayers.has(playerId)) propertySlots.current.delete(playerId);
    }
    for (const player of seats) {
        propertySlots.current.set(
            player.id,
            reconcilePropertySlots(propertySlots.current.get(player.id), player.sets.map(set => set.color)),
        );
    }
    const playerAtTableSlot = new Map<number, PlayerView>();
    seats.forEach((player, index) => playerAtTableSlot.set(assignedTableSlots[index] ?? index, player));

    /*
     * One ring, one centre.
     *
     * The centre is the deck and the discard — that is what the table is built
     * around — and every seat block sits on the circumference at the same
     * radius, so no player's cards are nearer the middle than another's. The
     * ring is a circle, so five equal angles also make five equal sides.
     */
    const field = Math.max(90, cardAreaHeight);
    const camera = tilted ? TILTED_CAMERA : FLAT_CAMERA;

    // The ring is always calculated for five chairs. Empty chairs remain real
    // positions instead of causing every occupied chair to move. Include the
    // visual scale here, then pull the ring slightly away from edge overlays.
    const minRadiusFor = (scale: number) => tilted
        // A tilted table has room to spare and big piles, so neighbours keep
        // a gap in proportion to their size; the phone's fixed 22pt, pulled
        // in besides, left big seats shoulder to shoulder.
        ? (SEAT * scale * (1 + TILT_SEAT_GAP)) / (2 * Math.sin(Math.PI / TABLE_SEAT_COUNT))
        : (SEAT * scale + SEAT_GAP) / (2 * Math.sin(Math.PI / TABLE_SEAT_COUNT)) * (1 - SEAT_RING_INSET);
    const chipSlots = assignedTableSlots.slice(1);
    const tiltedRing = tilted && size.width > 0
        ? fitTiltedRing({
              width: size.width,
              height: field,
              margin: TILT_MARGIN,
              minRadius: minRadiusFor,
              pileW: PILE_W,
              pileH: PILE_H,
              pileScale: tiltedPileScale(size.width, viewport.height),
              // Never smaller than the phone's own cards.
              minPileScale: pileScaleForWidth(size.width) * 0.8,
              chip,
              chipGap: CHIP_GAP,
              chipSlots,
          })
        : null;
    // A tilted table may have shrunk its piles to fit a short window.
    const pileScale = tiltedRing?.pileScale ?? pileScaleForWidth(size.width);
    const scaledSeat = SEAT * pileScale;
    // The deck, the discard and the turn lamp grow with the piles, or a
    // big table ends up with a phone's deck lost in the middle of it.
    const centreScale = tiltedRing ? pileScale / pileScaleForWidth(size.width) * 1.93 : 1;
    const centre = tiltedRing?.centre ?? { x: size.width / 2, y: field * 0.54 };
    const centreWidth = centreAction ? DECK_W * 2 + 16 + 40 : DECK_W * 2 + 8;
    const radius = tiltedRing?.radius ?? Math.max(minRadiusFor(pileScale), Math.min(
        (size.width - scaledSeat) / 2 - 6,
        centre.y - scaledSeat / 2 - 4,
        field - centre.y - scaledSeat / 2 - 4,
    ));

    /** One fixed chair: permanent anchor, inward turn and transformed bounds. */
    const seatAt = (tableSlot: number) => {
        if (tilted) {
            // Leaning away, a far chair is smaller because it *is* further
            // off — the perspective scale replaces the flat ring's fake depth.
            const chair = tiltedChair(tableSlot, radius, {
                pileW: PILE_W, pileH: PILE_H, pileScale, chip, chipGap: CHIP_GAP, chipLean: tiltedRing?.chipLean,
            });
            return {
                x: centre.x + chair.seat.cx - chair.seat.w / 2,
                y: centre.y + chair.seat.cy - chair.seat.h / 2,
                w: chair.seat.w,
                h: chair.seat.h,
                angle: chair.angle,
                rotation: chair.rotation,
                seatScale: chair.k,
                seatSquash: 1,
                chip: chair.chip,
            };
        }
        // Slot 0 is always the local player's near edge. The remaining four
        // positions are permanent points clockwise around the five-seat mat.
        const angle = seatAngle(tableSlot);
        // The local player's mat stays horizontal. Every remote mat follows
        // the tangent of the five-seat ring, so the top edge of its cards
        // points directly at the shared deck and the five mats read as a star.
        const rotation = angle * 180 / Math.PI - 90;
        const turn = rotation * Math.PI / 180;
        const c = Math.abs(Math.cos(turn));
        const sn = Math.abs(Math.sin(turn));
        const w = (PILE_W * c + PILE_H * sn) * pileScale;
        const h = (PILE_W * sn + PILE_H * c) * pileScale;

        return {
            x: centre.x + Math.cos(angle) * radius - w / 2,
            y: centre.y + Math.sin(angle) * radius - h / 2,
            w,
            h,
            angle,
            rotation,
            // Depth: a seat across the table is further away, so its cards
            // are smaller and sit a little flatter than your own.
            seatScale: 1 - DEPTH * (0.5 - Math.sin(angle) * 0.5),
            seatSquash: 1 - DEPTH * 0.5 * (0.5 - Math.sin(angle) * 0.5),
            chip: null,
        };
    };

    /** Screen-space centre of a property slot inside a transformed seat pile. */
    const buildingCentreAt = (slot: number, place: ReturnType<typeof seatAt>, rotation: number, seatScale: number, seatSquash: number) => {
        const dx = (slot % COLS) * COL + STACK_W / 2 - PILE_W / 2;
        const dy = Math.floor(slot / COLS) * ROW + STACK_H / 2 - PILE_H / 2;
        const turn = rotation * Math.PI / 180;
        const rotatedX = (dx * Math.cos(turn) - dy * Math.sin(turn)) * pileScale * seatScale;
        const rotatedY = (dx * Math.sin(turn) + dy * Math.cos(turn)) * pileScale * seatScale * seatSquash * camera.cos;
        return { x: place.w / 2 + rotatedX, y: place.h / 2 + rotatedY };
    };

    // The chips, for the table screen to stand at each remote chair.
    const chairs: ChairAnchor[] = tilted && chip && size.width > 0
        ? seats.slice(1).flatMap((player, index) => {
              const place = seatAt(assignedTableSlots[index + 1] ?? index + 1);
              if (!place.chip) return [];
              return [{
                  id: player.id,
                  x: centre.x + place.chip.cx - place.chip.w / 2,
                  y: centre.y + place.chip.cy - place.chip.h / 2,
                  w: place.chip.w,
                  h: place.chip.h,
              }];
          })
        : [];
    const chairsKey = chairs.map(c => `${c.id}:${Math.round(c.x)}:${Math.round(c.y)}`).join('|');
    useEffect(() => {
        onChairs?.(chairs);
        // Same trick as `hitsKey` below: a fresh array every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chairsKey]);

    /*
     * The tilted table top: an oval on the mat, centred on the ring, pushed
     * through the same projection as the seats and drawn as a polygon. No 3D
     * transform, so it is the same shape on the web and inside the iOS blur
     * snapshot (see `stage` below), and it cannot disagree with the seats.
     */
    const tableOval = (() => {
        if (!tiltedRing) return null;
        const { rx, ry } = tableRadii(radius, PILE_W, PILE_H, pileScale);
        const outline = (inset: number, dy = 0) => Array.from({ length: OVAL_STEPS }, (_, i) => {
            const t = i / OVAL_STEPS * 2 * Math.PI;
            const p = projectFelt(Math.cos(t) * (rx - inset), Math.sin(t) * (ry - inset), camera);
            return `${(centre.x + p.x).toFixed(1)},${(centre.y + p.y + dy).toFixed(1)}`;
        }).join(' ');
        return { top: outline(0), apron: outline(0, APRON), rim: outline(RIM) };
    })();

    // The seat rectangles, in felt-local coordinates, for the hit layer the
    // table screen renders on top of everything.
    const hits: SeatHit[] = size.width > 0
        ? seats
              .map((player, index) => ({ player, place: seatAt(assignedTableSlots[index] ?? index) }))
              .filter(({ player }) => player.sets.length > 0 || player.bank.length > 0)
              .map(({ player, place }) => ({
                  id: player.id,
                  name: player.name,
                  x: place.x,
                  y: place.y,
                  w: place.w,
                  h: place.h,
              }))
        : [];
    const hitsKey = hits.map(h => `${h.id}:${Math.round(h.x)}:${Math.round(h.y)}`).join('|');
    useEffect(() => {
        onSeats?.(hits);
        // `hitsKey` collapses the rectangles to a string: the array is rebuilt
        // every render and would otherwise loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hitsKey]);

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
            const seat = seatAt(assignedTableSlots[index] ?? index);
            // Two is enough to read as "a draw"; five would be a shuffle.
            for (let i = 0; i < Math.min(drawn, 2); i++) {
                next.push({
                    key: `f${flightId.current++}`,
                    to: { x: seat.x + seat.w / 2 - DECK_W / 2, y: seat.y + seat.h / 2 - DECK_H / 2 },
                    spin: scatter(`${player.id}${i}`, 0, 12),
                });
            }
        });
        if (next.length) setFlights(current => [...current, ...next]);
        // Seats and geometry are read, not depended on: a flight is triggered by
        // the hand counts changing and nothing else.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players, size.width, motion, reduced]);

    /*
     * The live marker: one lamp that travels round the ring to whoever is
     * playing, rather than a badge that blinks out here and in there. Seeing it
     * *move* is what tells you the turn passed, and which way it went.
     */
    const turnIndex = Math.max(0, seats.findIndex(p => p.id === turnId));
    const turnTableSlot = assignedTableSlots[turnIndex] ?? 0;
    const turnAngle = seatAngle(turnTableSlot);
    const marker = useSharedValue(turnAngle);
    const markerReady = useRef(false);
    useEffect(() => {
        if (!size.width) return;
        if (!markerReady.current) {
            // First paint: be where the turn already is, do not fly in from 0.
            markerReady.current = true;
            marker.value = turnAngle;
            return;
        }
        // Go the short way round: without unwrapping, a turn passing the seam
        // sends the lamp all the way back across the table.
        const current = marker.value;
        let target = turnAngle;
        while (target - current > Math.PI) target -= 2 * Math.PI;
        while (current - target > Math.PI) target += 2 * Math.PI;
        marker.value = animateMarker(target, motion && !reduced);
    }, [turnAngle, size.width, marker, motion, reduced]);

    // A slow breath, so the marker reads as live without competing with the
    // cards. It is the quietest thing on the table that still moves.
    const pulse = useSharedValue(0);
    useEffect(() => {
        pulse.value = motion && !reduced
            ? withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), -1, true)
            : 0;
    }, [pulse, motion, reduced]);

    // The Pass Go prompt breathes on the same value as the marker, scaled a
    // little harder: it is asking for a tap, where the marker only reports.
    const promptStyle = useAnimatedStyle(() => ({
        opacity: 0.6 + 0.4 * pulse.value,
        transform: [{ scale: 1 + 0.06 * pulse.value }],
    }));

    const markerStyle = useAnimatedStyle(() => {
        // Inside the seats, not among them: at the seats' own radius the
        // marker sat on top of somebody's cards. Projected like everything
        // else on the mat, so it keeps to the ring when the table leans.
        const at = projectFelt(
            Math.cos(marker.value) * (radius + MARKER_OUT),
            Math.sin(marker.value) * (radius + MARKER_OUT),
            camera,
        );
        return {
            opacity: 0.55 + 0.3 * pulse.value,
            transform: [
                { translateX: centre.x + at.x - MARKER_W / 2 },
                { translateY: centre.y + at.y - MARKER_H / 2 },
                { scale: (1 + 0.05 * pulse.value) * at.k * centreScale },
            ],
        };
    });

    return <View style={styles.scene} pointerEvents="box-none"
        onLayout={e => setSize(e.nativeEvent.layout)}>
        <View style={styles.stage} pointerEvents="box-none">
        {/* Two layers make the depth: the room behind, and an oval table top
            sitting in it. An ellipse wider than the screen is what a round
            table looks like from a chair — the old dome was a top-down view
            with a rounded lid, which is why nothing on it looked seated. */}
        <LinearGradient pointerEvents="none" colors={ROOM} style={styles.room} />
        {tableOval ? (
            <Svg pointerEvents="none" width={size.width} height={size.height} style={styles.oval}>
                <Defs>
                    <SvgGradient id="felt-mat" x1="0" y1="0" x2="0" y2="1">
                        {MAT.map((color, i) => <Stop key={color} offset={i / (MAT.length - 1)} stopColor={color} />)}
                    </SvgGradient>
                </Defs>
                {/* The table's thickness, showing under the near edge: what
                    makes it a slab standing in the room rather than a shape
                    painted on the wall behind it. */}
                <Polygon points={tableOval.apron} fill="#1a2046" />
                <Polygon points={tableOval.top} fill="url(#felt-mat)" stroke="#c8d2ff42" strokeWidth={2} />
                {/* The rim line, a hair inside the edge — the eye takes the
                    double edge as a moulded lip. */}
                <Polygon points={tableOval.rim} fill="none" stroke="#ccd5ff40" strokeWidth={1} />
            </Svg>
        ) : (
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
                {/* The rim line, a hair inside the table edge — `.arena-surface::after`
                    on the web. It is what stops the mat reading as a flat shape:
                    the eye takes the double edge as a moulded lip. */}
                <View pointerEvents="none" style={[styles.rim, { borderRadius: size.width * 0.65 - RIM }]} />
            </LinearGradient>
        )}

        {size.width > 0 ? (
            <View style={[styles.centre, {
                left: centre.x - centreWidth / 2,
                top: centre.y - DECK_H / 2 * centreScale,
                transform: [{ scale: centreScale }, { scaleY: 0.9 }],
            }]} pointerEvents="box-none">
                {/* The draw pile: a few backs, each sitting slightly off true.
                    Inert unless a Pass Go is in hand, when the whole pile
                    becomes the button for it. `none` the rest of the time, so
                    the backs never take a touch meant for the felt behind. */}
                <Pressable
                    style={styles.pile}
                    pointerEvents={onDrawTwo ? 'auto' : 'none'}
                    disabled={!onDrawTwo}
                    accessibilityRole={onDrawTwo ? 'button' : undefined}
                    accessibilityLabel={
                        onDrawTwo
                            ? `${t('table.deck_count', { count: deckCount })}: ${t('table.tap_draw_two')}`
                            : undefined
                    }
                    onPress={onDrawTwo}
                >
                    {Array.from({ length: Math.min(4, Math.max(1, Math.ceil(deckCount / 14))) }, (_, i) => (
                        <View key={i} style={[styles.deckCard, {
                            left: i * 0.8,
                            top: -i * 1.2,
                            transform: [{ rotate: `${(i % 2 ? 1 : -1) * (1 + i * 0.6)}deg` }],
                        }]} />
                    ))}
                    <Text style={styles.pileCount}>{deckCount}</Text>
                    {/* The same slow breath as the turn lamp, off the same
                        shared value — two things pulsing out of step would read
                        as two separate alarms rather than one table. No
                        `numberOfLines`: it makes react-native-web clamp the
                        line to `max-width: 100%`, and 100% of a card back is
                        30pt, so the prompt came out as "Tap…". */}
                    {onDrawTwo ? (
                        <Animated.Text style={[styles.drawPrompt, promptStyle]}>
                            {t('table.tap_draw_two')}
                        </Animated.Text>
                    ) : null}
                </Pressable>

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
                {centreAction}
            </View>
        ) : null}

        {flights.map(flight => (
            <DrawFlight
                key={flight.key}
                from={{ x: centre.x - DECK_W, y: centre.y - DECK_H / 2 }}
                to={flight.to}
                spin={flight.spin}
                onDone={() => setFlights(current => current.filter(f => f.key !== flight.key))}
            />
        ))}

        {size.width > 0 ? (
            <Animated.View pointerEvents="none" style={[styles.marker, markerStyle]}>
                {/* The same three dots as the bottom bar: whose turn it is and
                    how much of it is left, in one mark. */}
                {Array.from({ length: 3 }, (_, i) => (
                    <View key={i} style={[styles.markerDot, i < playsLeft && styles.markerDotLeft]} />
                ))}
            </Animated.View>
        ) : null}

        {size.width > 0 && Array.from({ length: TABLE_SEAT_COUNT }, (_, tableSlot) => {
            const player = playerAtTableSlot.get(tableSlot);
            const place = seatAt(tableSlot);
            const angle = place.angle;
            const rotation = place.rotation;
            const bank = player ? [...player.bank].sort((a, b) => a.value - b.value).slice(-4) : [];
            const assignedProperties = player ? propertySlots.current.get(player.id) ?? [] : [];
            const setsByColor = new Map(player?.sets.map(set => [set.color, set]) ?? []);
            const { seatScale, seatSquash } = place;
            /*
             * Screen points per layout point. The pile is laid out at the size
             * it is drawn, not drawn at a phone's size and scaled up: a scaled
             * layer is rasterised at its layout size first, so on a big table
             * the cards came out as stretched, soft pixels. Only rotation and
             * foreshortening remain transforms.
             */
            const unit = pileScale * seatScale;
            const u = (n: number) => n * unit;
            // Visuals only. The taps are handled by `SeatHits`, rendered above
            // every panel — down here a pile sat under whatever the layout put
            // on top of the felt and could not be reached at all.
            return <View
                key={tableSlot}
                pointerEvents="none"
                style={[styles.seat, { left: place.x, top: place.y, width: place.w, height: place.h }, debugSeats && styles.debugSeat]}>
                {/* Depth: a seat across the table is further away, so its cards
                    are smaller and sit a little flatter than your own. The
                    outermost squash is the camera's: the pile turns within
                    the mat first, then the mat is foreshortened on screen. */}
                <View pointerEvents="none" style={{
                    width: u(PILE_W),
                    height: u(PILE_H),
                    transformOrigin: 'center',
                    transform: [
                        { scaleY: camera.cos },
                        { rotate: `${rotation}deg` },
                        { scaleY: seatSquash },
                    ],
                }}>
                    {/* The engraved mat is always present, including at empty
                        chairs, so all five spatial anchors remain visible. */}
                    {Array.from({ length: PROPERTY_SLOT_COUNT }, (_, slot) => (
                        <View key={`guide-${slot}`} style={[
                            styles.propertyGuide,
                            {
                                left: u((slot % COLS) * COL),
                                top: u(Math.floor(slot / COLS) * ROW),
                                width: u(STACK_W),
                                height: u(STACK_H),
                                borderWidth: u(0.75),
                                borderRadius: u(2),
                            },
                            !player && styles.emptyGuide,
                        ]} />
                    ))}
                    <View style={[styles.bankGuide, {
                        left: u(BANK_LEFT),
                        top: u(BANK_VERTICAL_INSET),
                        width: u(BANK_W),
                        height: u(PILE_H - BANK_VERTICAL_INSET * 2),
                        borderWidth: u(0.75),
                        borderRadius: u(2),
                    }, !player && styles.emptyGuide]} />

                    {assignedProperties.map((color, slot) => {
                        if (!color) return null;
                        const set = setsByColor.get(color);
                        if (!set) return null;
                        return <View key={color} style={{
                            position: 'absolute',
                            zIndex: built(set) !== 'none' ? 2 : 1,
                            left: u((slot % COLS) * COL),
                            top: u(Math.floor(slot / COLS) * ROW),
                            width: u(STACK_W),
                            height: u(STACK_H),
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                        }}>
                            {built(set) !== 'none' ? IS_WEB ? <MiniBuilding
                                kind={built(set) as 'house' | 'hotel'}
                                color={colorMeta(set.color).hex}
                                renderScale={BUILDING_FOOTPRINT_SCALE * unit}
                                visualScale={BUILDING_FOOTPRINT_SCALE * unit}
                                seatRotation={rotation}
                                seatSquash={seatSquash}
                                seatTilt={camera.cos}
                            /> : null : set.cards.map((card, i) => <MiniCard key={card.id} color={colorMeta(set.color).hex}
                                left={Math.min(i, FAN_STEPS) * FAN_OFFSET + scatter(card.id, 0, 1)}
                                top={Math.min(i, FAN_STEPS) * FAN_OFFSET + scatter(card.id, 3, 1)}
                                rotate={scatter(card.id, 6, 6)}
                                fresh={fresh(card.id)} complete={set.complete} unit={unit} />)}
                        </View>;
                    })}
                    {bank.map((card, i) => <MiniCard key={card.id} color={moneyMeta(card.value).hex}
                        value={card.value}
                        left={BANK_LEFT + Math.min(bank.length - 1 - i, FAN_STEPS) * FAN_OFFSET + scatter(card.id, 0, 1)}
                        top={(PILE_H - STACK_H) / 2 + Math.min(bank.length - 1 - i, FAN_STEPS) * FAN_OFFSET + scatter(card.id, 3, 1)}
                        rotate={scatter(card.id, 6, 6)}
                        fresh={fresh(card.id)} unit={unit} />)}
                </View>
                {!IS_WEB && assignedProperties.map((color, slot) => {
                    const set = color ? setsByColor.get(color) : undefined;
                    if (!set) return null;
                    const kind = built(set);
                    if (kind === 'none') return null;
                    const displayScale = pileScale * seatScale * BUILDING_FOOTPRINT_SCALE;
                    return <MiniBuilding
                        key={`building-${color}`}
                        kind={kind}
                        color={colorMeta(set.color).hex}
                        renderScale={displayScale}
                        visualScale={displayScale}
                        anchor={buildingCentreAt(slot, place, rotation, seatScale, seatSquash)}
                    />;
                })}
            </View>;
        })}
        </View>
    </View>;
}

const styles = StyleSheet.create({
    scene: { flex: 1 },
    // Dev only: where the felt itself places a seat. Compare against the pink
    // tap targets the table screen draws — if they disagree, the two layers
    // are not in the same coordinate space.
    debugSeat: { borderWidth: 1, borderColor: '#7cff5a', backgroundColor: '#7cff5a1f' },
    // No `rotateX` here, however much it would suit: the felt is the subtree
    // the glass panels blur, and a 3D-transformed layer inside that snapshot
    // does not render on iOS — the whole table disappears. Depth is faked in
    // 2D instead, by scaling each seat with its distance from the near edge.
    stage: { flex: 1 },
    room: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    oval: { position: 'absolute', left: 0, top: 0 },
    marker: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: MARKER_W,
        height: MARKER_H,
        borderRadius: MARKER_H / 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#dce64e14',
        borderWidth: 1,
        borderColor: '#dce64e3d',
    },
    markerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#dce64e2e' },
    markerDotLeft: { backgroundColor: '#dce64ec4' },
    rim: {
        position: 'absolute',
        top: RIM,
        right: RIM,
        bottom: RIM,
        left: RIM,
        borderWidth: 1,
        borderColor: '#ccd5ff40',
    },
    mat: {
        position: 'absolute',
        top: 4,
        borderWidth: 2,
        borderColor: '#c8d2ff42',
        // The rim catches light from above, which is most of what says the
        // table has an edge rather than being a painted background.
        boxShadow: '0px 10px 26px #05081c8f, inset 0px 2px 0px #e3e9ff2e',
    },
    // Every seat owns this same mat. Only its rotation and depth change.
    seat: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    propertyGuide: {
        position: 'absolute',
        width: STACK_W,
        height: STACK_H,
        borderWidth: 0.75,
        borderColor: '#dbe2ff24',
        borderRadius: 2,
        backgroundColor: '#dbe2ff08',
    },
    bankGuide: {
        position: 'absolute',
        left: BANK_LEFT,
        top: BANK_VERTICAL_INSET,
        width: BANK_W,
        height: PILE_H - BANK_VERTICAL_INSET * 2,
        borderWidth: 0.75,
        borderColor: '#e6cd7330',
        borderRadius: 2,
        backgroundColor: '#e6cd7308',
    },
    emptyGuide: { opacity: 0.38 },
    card: { position: 'absolute', width: CARD_W, height: CARD_H, backgroundColor: '#f7f2df', borderWidth: 0.75, borderRadius: 2, overflow: 'hidden', boxShadow: '0px 1px 2px #12173866' },
    value: { fontFamily: uiFont(900), fontSize: 8, lineHeight: 11, color: '#183139', textAlign: 'center' },
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
    /*
     * Pinned under the pile, not pushed down by it.
     *
     * A margin worked for the deck, whose cards are absolutely positioned and
     * so take no room in the flow — but the discard's card is a normal child,
     * so its count was pushed a whole card's height further down than the
     * deck's and read as floating loose on the felt.
     */
    pileCount: {
        position: 'absolute',
        top: DECK_H + 3,
        width: DECK_W,
        textAlign: 'center',
        fontFamily: uiFont(800),
        fontSize: 10,
        color: '#dbe2ffb8',
    },
    /**
     * Above the pile, not below it: the count already owns the space under the
     * deck, and the discard's count sits alongside that. Wider than the deck
     * and centred on it, because the line is several times the width of a card
     * back — the pile has no padding to give.
     */
    drawPrompt: {
        position: 'absolute',
        bottom: DECK_H + 7,
        left: (DECK_W - PROMPT_W) / 2,
        width: PROMPT_W,
        textAlign: 'center',
        // The count's font and size, as the deck's own lettering.
        fontFamily: uiFont(800),
        fontSize: 10,
        color: brand.brass,
    },
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
