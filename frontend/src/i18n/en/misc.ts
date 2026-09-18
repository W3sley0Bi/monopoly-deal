import type { Catalog } from '../types';

/** Strings for the table furniture: cards, boards, and the timer. */
const misc: Catalog = {
    // Card faces. The type badges are printed on the card itself, so they are
    // part of the card art rather than a sentence about it.
    'card.type.bank': 'Bank',
    'card.type.action': 'Action',
    'card.type.rent': 'Rent',
    'card.type.property': 'Property',
    'card.type.wildcard': 'Wildcard',
    'card.million': 'Million',
    'card.value': 'Value',

    // Blurbs under an action card's name, and the same text wherever an action
    // is explained away from the card.
    'action.pass_go.blurb': 'Draw 2 cards',
    'action.deal_breaker.blurb': 'Steal a complete set',
    'action.sly_deal.blurb': 'Steal 1 property',
    'action.forced_deal.blurb': 'Swap a property',
    'action.debt_collector.blurb': 'Collect $5M',
    'action.birthday.blurb': 'Everyone pays $2M',
    'action.house.blurb': '+$3M rent on a full set',
    'action.hotel.blurb': '+$4M rent, needs a house',
    'action.just_say_no.blurb': 'Cancel an action against you',
    'action.double_rent.blurb': 'Double a rent card',

    'sets.empty': 'No properties yet',
    'sets.empty_short': 'No properties',

    'opponent.away': 'away',
    'opponent.turn': 'Turn',
    'opponent.hand_title': 'Cards in hand',
    'opponent.bank_title': 'Bank',
    'opponent.sets_title': 'Complete sets',

    'board.in_hand.one': '{count} in hand',
    'board.in_hand.other': '{count} in hand',
    'board.banked': '{amount} banked',
    'board.sets': '{count}/3 sets',
    'board.in_play': '{amount} in play',
    'board.their_turn': 'Their turn',
    'board.properties': 'Properties',
    'board.bank': 'Bank',
    'board.bank_empty': 'Nothing banked',

    'win.you': 'You win!',
    'win.player': '{name} wins!',
    'win.someone': 'Someone',
    'win.blurb': 'Three complete colour sets. Game over.',
    'win.score': '{sets} sets · {amount}',
    'win.play_again': 'Play again',
    'win.waiting': 'Waiting for {name} to deal again.',
    'win.leave': 'Leave table',


    'timer.turn': 'Time left in this turn',
    'timer.respond': 'Time left to respond before the server decides',

    'sheet.close': 'Close',

};

export default misc;
