import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { Card, Color } from '../../types';

export type DragFrom = 'hand' | 'board';

export interface DragState {
    card: Card;
    from: DragFrom;
    /** The stack a board wildcard was lifted out of. */
    fromColor?: Color;
}

/** A drop target's measured window rect, as the worklet sees it.
 *
 *  `active` travels with the rect rather than being looked up separately,
 *  because the hit-test runs on the UI thread and cannot reach the registry. */
export interface ZoneRect {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    active: boolean;
}

export interface ZoneEntry {
    id: string;
    active: boolean;
    onDrop: (card: Card) => void;
    measure: () => Promise<ZoneRect | null>;
}

export interface DragApi {
    /** Registers a drop zone. Returns an unregister function. */
    register: (entry: ZoneEntry) => () => void;
    /** Re-reads every registered zone's rect. Called when a drag starts, since
     *  rails scroll and a stale rect is the classic failure of this design. */
    refresh: () => void;

    begin: (state: DragState, origin: { x: number; y: number; w: number; h: number }) => void;
    cancel: () => void;

    /** Null when nothing is being carried. */
    dragging: DragState | null;
    /** The zone currently under the finger, for feedback. Shared so a zone can
     *  react on the UI thread without a React render per frame. */
    hoveredId: SharedValue<string | null>;
}

export const DragContext = createContext<DragApi | null>(null);

export function useDragLayer(): DragApi {
    const api = useContext(DragContext);
    if (!api) throw new Error('useDragLayer must be used inside <DragLayer>');
    return api;
}

/** Safe outside the provider — the tutorial coach stands down while a card is
 *  in the air and must be able to ask without being nested under the layer. */
export function useOptionalDragLayer(): DragApi | null {
    return useContext(DragContext);
}
