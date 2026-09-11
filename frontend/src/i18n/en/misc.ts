import type { Catalog } from '../types';

/** Strings for the table furniture: cards, boards, the call and the timer. */
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

    'call.unavailable': 'Call unavailable',
    'call.join': 'Join call',
    'call.join_title': 'Turn on your camera and microphone',
    'call.starting': 'Starting…',
    'call.members.one': '{count} on call',
    'call.members.other': '{count} on call',
    'call.mute': 'Mute microphone',
    'call.unmute': 'Unmute microphone',
    'call.cam_off': 'Turn camera off',
    'call.cam_on': 'Turn camera on',
    'call.leave': 'Leave call',
    'call.leave_title': 'Leave the call',
    'call.you': 'You',

    'timer.turn': 'Time left in this turn',
    'timer.respond': 'Time left to respond before the server decides',

    'sheet.close': 'Close',

    'video.cam_off': 'Camera off',
    'video.mic_off': 'Microphone off',
    'call.err.no_browser_apis': 'This device has no browser media APIs.',
    'call.err.insecure_origin': 'Camera and microphone need a secure page. Open the game on https:// or on localhost.',
    'call.err.unsupported_browser': 'This browser does not expose camera access.',
    'call.err.permission_denied': 'Camera and microphone permission was denied.',
    'call.err.no_devices': 'No camera or microphone found on this device.',
    'call.err.start_failed': 'Could not start the camera.',
};

export default misc;
