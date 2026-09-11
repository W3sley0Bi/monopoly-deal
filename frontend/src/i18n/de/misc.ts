import type { Catalog } from '../types';

/** Strings for the table furniture: cards, boards, the call and the timer. */
const misc: Catalog = {
    // Card faces. The type badges are printed on the card itself, so they are
    // part of the card art rather than a sentence about it.
    'card.type.bank': 'Bank',
    'card.type.action': 'Aktion',
    'card.type.rent': 'Miete',
    'card.type.property': 'Immobilie',
    'card.type.wildcard': 'Joker',
    'card.million': 'Million',
    'card.value': 'Wert',

    // Blurbs under an action card's name, and the same text wherever an action
    // is explained away from the card.
    'action.pass_go.blurb': 'Zieh 2 Karten',
    'action.deal_breaker.blurb': 'Stiehl einen vollständigen Satz',
    'action.sly_deal.blurb': 'Stiehl 1 Immobilie',
    'action.forced_deal.blurb': 'Tausch eine Immobilie',
    'action.debt_collector.blurb': 'Kassiere $5M',
    'action.birthday.blurb': 'Alle zahlen $2M',
    'action.house.blurb': '+$3M Miete auf vollem Satz',
    'action.hotel.blurb': '+$4M Miete, braucht ein Haus',
    'action.just_say_no.blurb': 'Bricht eine Aktion gegen dich ab',
    'action.double_rent.blurb': 'Verdoppelt eine Mietkarte',

    'sets.empty': 'Noch keine Immobilien',
    'sets.empty_short': 'Keine Immobilien',

    'opponent.away': 'abwesend',
    'opponent.turn': 'Dran',
    'opponent.hand_title': 'Karten auf der Hand',
    'opponent.bank_title': 'Bank',
    'opponent.sets_title': 'Vollständige Sätze',

    'board.in_hand.one': '{count} auf der Hand',
    'board.in_hand.other': '{count} auf der Hand',
    'board.banked': '{amount} in der Bank',
    'board.sets': '{count}/3 Sätze',
    'board.in_play': '{amount} im Spiel',
    'board.their_turn': 'Ist dran',
    'board.properties': 'Immobilien',
    'board.bank': 'Bank',
    'board.bank_empty': 'Nichts in der Bank',

    'win.you': 'Du gewinnst!',
    'win.player': '{name} gewinnt!',
    'win.someone': 'Jemand',
    'win.blurb': 'Drei vollständige Farbsätze. Spiel vorbei.',
    'win.score': '{sets} Sätze · {amount}',
    'win.play_again': 'Nochmal spielen',
    'win.waiting': 'Warte darauf, dass {name} neu gibt.',
    'win.leave': 'Tisch verlassen',

    'call.unavailable': 'Anruf nicht verfügbar',
    'call.join': 'Anruf beitreten',
    'call.join_title': 'Kamera und Mikrofon einschalten',
    'call.starting': 'Startet…',
    'call.members.one': '{count} im Anruf',
    'call.members.other': '{count} im Anruf',
    'call.mute': 'Mikrofon stummschalten',
    'call.unmute': 'Stummschaltung aufheben',
    'call.cam_off': 'Kamera ausschalten',
    'call.cam_on': 'Kamera einschalten',
    'call.leave': 'Anruf verlassen',
    'call.leave_title': 'Den Anruf verlassen',
    'call.you': 'Du',

    'timer.turn': 'Restzeit in dieser Runde',
    'timer.respond': 'Restzeit zum Antworten, bevor der Server entscheidet',

    'sheet.close': 'Schließen',

    'video.cam_off': 'Kamera aus',
    'video.mic_off': 'Mikrofon aus',
    'call.err.no_browser_apis': 'Dieses Gerät hat keine Medien-APIs im Browser.',
    'call.err.insecure_origin': 'Kamera und Mikrofon brauchen eine sichere Seite. Öffne das Spiel über https:// oder auf localhost.',
    'call.err.unsupported_browser': 'Dieser Browser gibt keinen Zugriff auf die Kamera frei.',
    'call.err.permission_denied': 'Die Berechtigung für Kamera und Mikrofon wurde abgelehnt.',
    'call.err.no_devices': 'Keine Kamera und kein Mikrofon auf diesem Gerät gefunden.',
    'call.err.start_failed': 'Die Kamera konnte nicht gestartet werden.',
};

export default misc;
