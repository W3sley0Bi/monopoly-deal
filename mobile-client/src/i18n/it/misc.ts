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
    'opponent.hand_short': 'Carte',
    'opponent.bank_short': 'Banca',
    'opponent.sets_short': 'Serie',

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


    'timer.turn': 'Tempo rimasto in questo turno',
    'timer.respond': 'Tempo per rispondere prima che decida il server',

    'sheet.close': 'Chiudi',

};

export default misc;
