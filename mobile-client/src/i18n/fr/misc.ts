import type { Catalog } from '../types';

/** Strings for the table furniture: cards, boards, and the timer. */
const misc: Catalog = {
    // Card faces. The type badges are printed on the card itself, so they are
    // part of the card art rather than a sentence about it.
    'card.type.bank': 'Banque',
    'card.type.action': 'Action',
    'card.type.rent': 'Loyer',
    'card.type.property': 'Propriété',
    'card.type.wildcard': 'Joker',
    'card.million': 'Million',
    'card.value': 'Valeur',

    // Blurbs under an action card's name, and the same text wherever an action
    // is explained away from the card.
    'action.pass_go.blurb': 'Piochez 2 cartes',
    'action.deal_breaker.blurb': 'Volez un groupe complet',
    'action.sly_deal.blurb': 'Volez 1 propriété',
    'action.forced_deal.blurb': 'Échangez une propriété',
    'action.debt_collector.blurb': 'Réclamez $5M',
    'action.birthday.blurb': 'Chaque joueur paie $2M',
    'action.house.blurb': '+$3M de loyer sur un groupe complet',
    'action.hotel.blurb': '+$4M de loyer, nécessite une maison',
    'action.just_say_no.blurb': 'Annulez une action contre vous',
    'action.double_rent.blurb': 'Doublez une carte loyer',

    'sets.empty': 'Aucune propriété pour l’instant',
    'sets.empty_short': 'Aucune propriété',

    'opponent.away': 'absent',
    'opponent.turn': 'Tour',
    'opponent.hand_title': 'Cartes en main',
    'opponent.bank_title': 'Banque',
    'opponent.sets_title': 'Groupes complets',
    'opponent.hand_short': 'Cartes',
    'opponent.bank_short': 'Banque',
    'opponent.sets_short': 'Groupes',

    'board.in_hand.one': '{count} en main',
    'board.in_hand.other': '{count} en main',
    'board.banked': '{amount} en banque',
    'board.sets': '{count}/3 groupes',
    'board.in_play': '{amount} en jeu',
    'board.their_turn': 'Leur tour',
    'board.properties': 'Propriétés',
    'board.bank': 'Banque',
    'board.bank_empty': 'Rien en banque',

    'win.you': 'Vous avez gagné !',
    'win.player': '{name} a gagné !',
    'win.someone': 'Quelqu’un',
    'win.blurb': 'Trois groupes complets de couleur. Fin de partie.',
    'win.score': '{sets} groupes · {amount}',
    'win.play_again': 'Rejouer',
    'win.waiting': 'En attente que {name} redistribue.',
    'win.leave': 'Quitter la table',

    'timer.turn': 'Temps restant pour ce tour',
    'timer.respond': 'Temps restant pour répondre avant décision du serveur',

    'sheet.close': 'Fermer',

    // Protocol mismatch — the app and the server can no longer understand each other.
    'update.client.title': 'Mise à jour requise',
    'update.client.body': 'Cette version de Deal ne peut plus communiquer avec le serveur de jeu. Mettez l’application à jour pour continuer à jouer en ligne.',
    'update.server.title': 'Le serveur nécessite une mise à jour',
    'update.server.body': 'Le serveur de jeu est plus ancien que cette application. Demandez à son administrateur de le mettre à jour, puis réessayez.',
    'update.play_offline': 'Jouer en solo hors ligne',
    'notice.offline_moves_dropped.one': 'Vous étiez hors ligne, votre dernier coup n’a pas été envoyé.',
    'notice.offline_moves_dropped.other': 'Vous étiez hors ligne, vos {count} derniers coups n’ont pas été envoyés.',
};

export default misc;
