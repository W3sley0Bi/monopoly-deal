import type { Catalog } from '../types';

/**
 * French: every refusal the server can send back.
 *
 * The Go side returns a key plus the values it formatted its own fallback
 * with (`fault(...)` / `game.NewFault(...)`), so the placeholder names below
 * must match the argument names in those calls.
 */
const errors: Catalog = {
    // Identity and table ownership
    'err.choose_name': 'Choisissez d’abord un nom.',
    'err.not_owner': 'Seul le créateur de la table peut faire cela.',
    'err.bad_station': 'Cette station n’est pas un flux https utilisable.',
    'err.missing_player_id': 'Identifiant de joueur manquant.',
    'err.no_such_table': 'Aucune table avec le code « {code} ».',
    'err.close_host_only': 'Seul {host} peut fermer cette table tant qu’il y a des joueurs.',
    'err.not_at_table': 'Vous n’êtes pas à une table.',
    'err.not_at_this_table': 'Cette personne n’est pas à cette table.',
    'err.table_full': 'La table est pleine.',
    'err.already_seated': 'Vous avez déjà une place.',
    'err.game_started_ask_seat': 'La partie a déjà commencé — demandez plutôt une place.',
    'err.end_seated_only': 'Seuls les joueurs à la table peuvent terminer la partie.',
    'err.spectator': 'Les spectateurs ne peuvent pas jouer.',
    'err.pick_someone_else': 'Choisissez quelqu’un d’autre à retirer.',
    'err.remove_lobby_only': 'Les joueurs ne peuvent être retirés qu’avant le début de la partie.',

    // Options and lobby
    'err.options_locked': 'Les options ne peuvent être modifiées qu’avant le début de la partie.',
    'err.unknown_mode': 'Mode de jeu « {mode} » inconnu.',
    'err.mode_unavailable': 'Ce mode n’est pas encore disponible.',
    'err.bad_turn_length': 'Durée de tour non prise en charge.',
    'err.difficulty_lobby_only': 'La difficulté des robots ne peut être modifiée qu’avant le début de la partie.',
    'err.unknown_difficulty': 'Difficulté « {difficulty} » inconnue.',
    'err.bots_lobby_only': 'Les robots ne peuvent être ajoutés ou retirés qu’avant le début de la partie.',
    'err.no_bots': 'Aucun robot à cette table.',
    'err.game_in_progress': 'Partie déjà en cours.',
    'err.game_full': 'La partie est complète.',
    'err.already_started': 'Partie déjà commencée.',
    'err.need_two_players': 'Il faut au moins 2 joueurs.',

    // Turn state
    'err.no_game': 'Aucune partie en cours.',
    'err.resolve_first': 'Résolvez d’abord l’action en cours.',
    'err.player_not_found': 'Joueur introuvable.',
    'err.not_your_turn': 'Ce n’est pas votre tour.',
    'err.no_plays_left': 'Plus aucun coup restant ce tour-ci.',
    'err.card_not_in_hand': 'Cette carte n’est pas dans votre main.',
    'err.card_not_in_play': 'Cette carte n’est pas en jeu.',

    // Playing cards
    'err.no_action': 'Cette carte n’a aucune action.',
    'err.unsupported_card': 'Carte non prise en charge.',
    'err.no_banking_property': 'Les cartes propriétés ne peuvent pas être mises en banque.',
    'err.not_a_property': 'Ce n’est pas une carte propriété.',
    'err.choose_colour': 'Choisissez une couleur pour cette propriété.',
    'err.wrong_colour': '{card} ne peut pas être jouée comme {color}.',
    'err.only_wildcards_move': 'Seuls les jokers peuvent être déplacés.',
    'err.already_that_colour': 'Elle est déjà de cette couleur.',
    'err.wild_any_needs_set': 'Vous n’avez aucune propriété {color} à laquelle joindre le joker.',
    'err.wildcard_not_in_play': 'Ce joker n’est pas dans vos groupes.',

    // Targeting
    'err.no_opponents': 'Aucun adversaire.',
    'err.choose_target': 'Choisissez un joueur cible.',
    'err.no_self_target': 'Vous ne pouvez pas vous cibler vous-même.',
    'err.target_not_found': 'Joueur cible introuvable.',
    'err.choose_property': 'Choisissez une carte propriété.',
    'err.complete_set_protected': 'Vous ne pouvez pas prendre une carte d’un groupe complet.',
    'err.property_not_found': 'Propriété introuvable.',
    'err.deal_breaker_needs_set': 'Rupture de contrat nécessite un groupe complet.',

    // Building
    'err.choose_set': 'Choisissez sur quel groupe complet construire.',
    'err.needs_complete_set': '{card} nécessite un groupe complet.',
    'err.cannot_build_here': 'Impossible de construire sur les gares ou les compagnies.',
    'err.has_house': 'Ce groupe a déjà une maison.',
    'err.house_before_hotel': 'Construisez une maison avant un hôtel.',
    'err.has_hotel': 'Ce groupe a déjà un hôtel.',

    // Rent
    'err.choose_rent_colour': 'Choisissez une couleur pour réclamer un loyer.',
    'err.rent_wrong_colour': '{card} ne peut pas réclamer un loyer {color}.',
    'err.no_properties_of_colour': 'Vous ne possédez aucune propriété {color}.',
    'err.no_rent': 'Ce groupe ne rapporte aucun loyer.',
    'err.not_double_rent': 'Ce n’est pas une carte Doublez le loyer.',
    'err.double_rent_with_rent': 'Doublez le loyer doit être jouée avec une carte loyer.',
    'err.need_plays': 'Il vous faut {need} coups, vous en avez {have}.',

    // Responses and payment
    'err.nothing_to_respond': 'Rien à quoi répondre.',
    'err.not_your_response': 'Ce n’est pas à votre tour de répondre.',
    'err.jsn_response_only': 'Juste dites non ne peut être jouée qu’en réponse.',
    'err.no_jsn': 'Vous n’avez pas de carte Juste dites non.',
    'err.waiting_other_player': 'En attente de l’autre joueur.',
    'err.duplicate_payment_card': 'Carte en double dans le paiement.',
    'err.pay_more': 'Payez ${amount}M (vous avez sélectionné ${selected}M sur ${available}M disponibles).',

    // Transport
    'err.client_outdated': 'Cette application n’est pas à jour. Mettez-la à jour pour continuer à jouer en ligne.',
    'err.server_outdated': 'Le serveur est plus ancien que cette application. Demandez à l’hôte de le mettre à jour.',
    'err.unknown_message': 'Type de message inconnu « {type} ».',
};

export default errors;
