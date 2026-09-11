import type { Catalog } from '../types';

/** Italian: strings for the table furniture — cards, boards, the call and the timer. */
const misc: Catalog = {
    // Card faces. The type badges are printed on the card itself, so they are
    // part of the card art rather than a sentence about it.
    'card.type.bank': 'Banca',
    'card.type.action': 'Azione',
    'card.type.rent': 'Affitto',
    'card.type.property': 'Proprietà',
    'card.type.wildcard': 'Jolly',
    'card.million': 'Milioni',
    'card.value': 'Valore',

    // Blurbs under an action card's name, and the same text wherever an action
    // is explained away from the card.
    'action.pass_go.blurb': 'Pesca 2 carte',
    'action.deal_breaker.blurb': 'Ruba una serie completa',
    'action.sly_deal.blurb': 'Ruba 1 proprietà',
    'action.forced_deal.blurb': 'Scambia una proprietà',
    'action.debt_collector.blurb': 'Incassa $5M',
    'action.birthday.blurb': 'Tutti pagano $2M',
    'action.house.blurb': '+$3M di affitto su una serie completa',
    'action.hotel.blurb': '+$4M di affitto, richiede una casa',
    'action.just_say_no.blurb': 'Annulla un’azione contro di te',
    'action.double_rent.blurb': 'Raddoppia una carta affitto',

    'sets.empty': 'Ancora nessuna proprietà',
    'sets.empty_short': 'Nessuna proprietà',

    'opponent.away': 'assente',
    'opponent.turn': 'Turno',
    'opponent.hand_title': 'Carte in mano',
    'opponent.bank_title': 'Banca',
    'opponent.sets_title': 'Serie complete',

    'board.in_hand.one': '{count} in mano',
    'board.in_hand.other': '{count} in mano',
    'board.banked': '{amount} in banca',
    'board.sets': '{count}/3 serie',
    'board.in_play': '{amount} in gioco',
    'board.their_turn': 'Tocca a loro',
    'board.properties': 'Proprietà',
    'board.bank': 'Banca',
    'board.bank_empty': 'Niente in banca',

    'win.you': 'Hai vinto!',
    'win.player': 'Vince {name}!',
    'win.someone': 'Qualcuno',
    'win.blurb': 'Tre serie di colore complete. Partita finita.',
    'win.score': '{sets} serie · {amount}',
    'win.play_again': 'Gioca di nuovo',
    'win.waiting': 'In attesa che {name} distribuisca di nuovo.',
    'win.leave': 'Lascia il tavolo',

    'call.unavailable': 'Chiamata non disponibile',
    'call.join': 'Entra in chiamata',
    'call.join_title': 'Accendi la videocamera e il microfono',
    'call.starting': 'Avvio…',
    'call.members.one': '{count} in chiamata',
    'call.members.other': '{count} in chiamata',
    'call.mute': 'Disattiva il microfono',
    'call.unmute': 'Attiva il microfono',
    'call.cam_off': 'Spegni la videocamera',
    'call.cam_on': 'Accendi la videocamera',
    'call.leave': 'Esci dalla chiamata',
    'call.leave_title': 'Esci dalla chiamata',
    'call.you': 'Tu',

    'timer.turn': 'Tempo rimasto in questo turno',
    'timer.respond': 'Tempo per rispondere prima che decida il server',

    'sheet.close': 'Chiudi',

    'video.cam_off': 'Videocamera spenta',
    'video.mic_off': 'Microfono spento',
    'call.err.no_browser_apis': 'Questo dispositivo non ha le API multimediali del browser.',
    'call.err.insecure_origin': 'Videocamera e microfono richiedono una pagina sicura. Apri il gioco su https:// o su localhost.',
    'call.err.unsupported_browser': 'Questo browser non consente l’accesso alla videocamera.',
    'call.err.permission_denied': 'L’accesso a videocamera e microfono è stato negato.',
    'call.err.no_devices': 'Nessuna videocamera o microfono trovati su questo dispositivo.',
    'call.err.start_failed': 'Impossibile avviare la videocamera.',
};

export default misc;
