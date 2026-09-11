import type { ActionType, Card, Color, GameView, PlayerView } from '../types';

interface ColorMeta {
    label: string;
    /** Fits in a card's colour stripe, where two labels share the width. */
    short: string;
    /** Deck swatch colour. */
    hex: string;
    /** Text colour that stays readable on `hex`. */
    ink: string;
}

export const COLORS: Record<Exclude<Color, 'all'>, ColorMeta> = {
    brown: { label: 'Brown', short: 'Brown', hex: '#8b5a2b', ink: '#fff8f0' },
    lightblue: { label: 'Light Blue', short: 'Lt Blue', hex: '#7dd3fc', ink: '#0b2b3a' },
    pink: { label: 'Pink', short: 'Pink', hex: '#ec4899', ink: '#fff' },
    orange: { label: 'Orange', short: 'Orange', hex: '#f97316', ink: '#2b1400' },
    red: { label: 'Red', short: 'Red', hex: '#dc2626', ink: '#fff' },
    yellow: { label: 'Yellow', short: 'Yellow', hex: '#facc15', ink: '#2b2200' },
    green: { label: 'Green', short: 'Green', hex: '#15803d', ink: '#fff' },
    blue: { label: 'Blue', short: 'Blue', hex: '#2563eb', ink: '#fff' },
    railroad: { label: 'Railroad', short: 'Rail', hex: '#334155', ink: '#fff' },
    utility: { label: 'Utility', short: 'Util', hex: '#94a3b8', ink: '#0f172a' },
};

export function colorMeta(c?: Color): ColorMeta {
    if (!c || c === 'all') return { label: 'Any Colour', short: 'Any', hex: '#a855f7', ink: '#fff' };
    return COLORS[c] ?? { label: c, short: c, hex: '#64748b', ink: '#fff' };
}

/** Colours a card may legally be played as. */
export function playableColors(card: Card, all: Color[]): Color[] {
    if (!card.colors?.length) return [];
    if (card.colors.length === 1 && card.colors[0] === 'all') {
        return all.filter(c => c !== 'all');
    }
    return card.colors.filter(c => c !== 'all');
}

export const ACTION_ICON: Record<ActionType, string> = {
    pass_go: '🎲',
    deal_breaker: '💥',
    sly_deal: '🥷',
    forced_deal: '🔁',
    debt_collector: '💰',
    birthday: '🎂',
    house: '🏠',
    hotel: '🏨',
    just_say_no: '🚫',
    double_rent: '✖️',
};

export const ACTION_BLURB: Record<ActionType, string> = {
    pass_go: 'Draw 2 cards',
    deal_breaker: 'Steal a complete set',
    sly_deal: 'Steal 1 property',
    forced_deal: 'Swap a property',
    debt_collector: 'Collect $5M',
    birthday: 'Everyone pays $2M',
    house: '+$3M rent on a full set',
    hotel: '+$4M rent, needs a house',
    just_say_no: 'Cancel an action against you',
    double_rent: 'Double a rent card',
};

/** Catalog key for each blurb, so components translate rather than read the
 *  English constant above. */
export const ACTION_BLURB_KEY: Record<ActionType, string> = {
    pass_go: 'action.pass_go.blurb',
    deal_breaker: 'action.deal_breaker.blurb',
    sly_deal: 'action.sly_deal.blurb',
    forced_deal: 'action.forced_deal.blurb',
    debt_collector: 'action.debt_collector.blurb',
    birthday: 'action.birthday.blurb',
    house: 'action.house.blurb',
    hotel: 'action.hotel.blurb',
    just_say_no: 'action.just_say_no.blurb',
    double_rent: 'action.double_rent.blurb',
};

/** Actions that need choices before they can be played. */
export function needsTargeting(card: Card): boolean {
    if (card.type === 'rent') return true;
    switch (card.action) {
        case 'sly_deal':
        case 'forced_deal':
        case 'deal_breaker':
        case 'debt_collector':
        case 'house':
        case 'hotel':
            return true;
        default:
            return false;
    }
}

/** Cards that do something when played, rather than only banking. */
export function isPlayableAction(card: Card): boolean {
    if (card.type === 'rent') return true;
    if (card.type !== 'action') return false;
    return card.action !== 'just_say_no' && card.action !== 'double_rent';
}

export function you(view: GameView): PlayerView | undefined {
    return (view.players ?? []).find(p => p.id === view.you);
}

export function opponents(view: GameView): PlayerView[] {
    return (view.players ?? []).filter(p => p.id !== view.you);
}

export function isYourTurn(view: GameView): boolean {
    return (view.players ?? [])[view.current_turn]?.id === view.you;
}

/**
 * Every card a player could hand over as payment. `from` stays an English
 * label for callers that still print it; `fromColor` is the untranslated
 * colour so a caller can name the pile in the reader's language (absent for
 * the bank, which has no colour).
 */
export function assets(p: PlayerView): { card: Card; from: string; fromColor?: Color }[] {
    const out: { card: Card; from: string; fromColor?: Color }[] = [];
    for (const c of p.bank) out.push({ card: c, from: 'Bank' });
    for (const s of p.sets) {
        for (const c of s.cards) out.push({ card: c, from: colorMeta(s.color).label, fromColor: s.color });
        for (const c of s.buildings) out.push({ card: c, from: colorMeta(s.color).label, fromColor: s.color });
    }
    return out;
}

/** Properties an opponent may take: anything outside a complete set. */
export function stealableCards(p: PlayerView): { card: Card; color: Color }[] {
    const out: { card: Card; color: Color }[] = [];
    for (const s of p.sets) {
        if (s.complete) continue;
        for (const c of s.cards) out.push({ card: c, color: s.color });
    }
    return out;
}

/** Where a hand card may be dropped: colour sets, the bank, or nothing. */
export function dropTargets(card: Card, all: Color[]): { colors: Color[]; bankable: boolean } {
    if (card.type === 'property' || card.type === 'property_wildcard') {
        return { colors: playableColors(card, all), bankable: false };
    }
    return { colors: [], bankable: true };
}

/** Formats a turn length for display. */
export function turnLabel(seconds: number): string {
    if (!seconds) return 'No limit';
    if (seconds % 60 === 0) return `${seconds / 60} min`;
    return `${seconds}s`;
}

/** The target entry that this player must act on, if any. */
export function myTarget(view: GameView) {
    const pd = view.pending;
    if (!pd) return undefined;
    return pd.targets.find(t => !t.settled && t.responder === view.you);
}
