import type { Catalog } from '../types';

/**
 * Every refusal the server can send back.
 *
 * The Go side returns a key plus the values it formatted its own fallback
 * with (`fault(...)` / `game.NewFault(...)`), so the placeholder names below
 * must match the argument names in those calls.
 */
const errors: Catalog = {
    // Identity and table ownership
    'err.choose_name': 'Choose a name first.',
    'err.not_owner': 'Only the table owner can do that.',
    'err.bad_station': 'That station is not a usable https stream.',
    'err.missing_player_id': 'Missing player id.',
    'err.no_such_table': 'No table with code "{code}".',
    'err.close_host_only': 'Only {host} can close that table while people are at it.',
    'err.not_at_table': 'You are not at a table.',
    'err.not_at_this_table': 'That person is not at this table.',
    'err.table_full': 'The table is full.',
    'err.already_seated': 'You already have a seat.',
    'err.game_started_ask_seat': 'The game has already started — ask for a seat instead.',
    'err.end_seated_only': 'Only players at the table can end the game.',
    'err.spectator': 'Spectators cannot play.',
    'err.pick_someone_else': 'Pick someone else to remove.',
    'err.remove_lobby_only': 'Players can only be removed before the game starts.',

    // Options and lobby
    'err.options_locked': 'Options can only change before the game starts.',
    'err.unknown_mode': 'Unknown game mode "{mode}".',
    'err.mode_unavailable': 'That mode is not available yet.',
    'err.bad_turn_length': 'Unsupported turn length.',
    'err.difficulty_lobby_only': 'The robot difficulty can only change before the game starts.',
    'err.unknown_difficulty': 'Unknown difficulty "{difficulty}".',
    'err.bots_lobby_only': 'Bots can only be added or removed before the game starts.',
    'err.no_bots': 'No bots at this table.',
    'err.game_in_progress': 'Game already in progress.',
    'err.game_full': 'Game is full.',
    'err.already_started': 'Game already started.',
    'err.need_two_players': 'Need at least 2 players.',

    // Turn state
    'err.no_game': 'No game in progress.',
    'err.resolve_first': 'Resolve the current action first.',
    'err.player_not_found': 'Player not found.',
    'err.not_your_turn': 'Not your turn.',
    'err.no_plays_left': 'No plays left this turn.',
    'err.card_not_in_hand': 'That card is not in your hand.',
    'err.card_not_in_play': 'That card is not in play.',

    // Playing cards
    'err.no_action': 'That card has no action.',
    'err.unsupported_card': 'Unsupported card.',
    'err.no_banking_property': 'Property cards cannot be banked.',
    'err.not_a_property': 'That is not a property card.',
    'err.choose_colour': 'Choose a colour for this property.',
    'err.wrong_colour': '{card} cannot be played as {color}.',
    'err.only_wildcards_move': 'Only wildcards can be moved.',
    'err.already_that_colour': 'It is already that colour.',
    'err.wild_any_needs_set': 'You have no {color} property for the joker to join.',
    'err.wildcard_not_in_play': 'That wildcard is not in your sets.',

    // Targeting
    'err.no_opponents': 'No opponents.',
    'err.choose_target': 'Choose a target player.',
    'err.no_self_target': 'You cannot target yourself.',
    'err.target_not_found': 'Target player not found.',
    'err.choose_property': 'Choose a property card.',
    'err.complete_set_protected': 'You cannot take a card from a complete set.',
    'err.property_not_found': 'Property not found.',
    'err.deal_breaker_needs_set': 'Deal Breaker needs a complete set.',

    // Building
    'err.choose_set': 'Choose which complete set to build on.',
    'err.needs_complete_set': '{card} needs a complete set.',
    'err.cannot_build_here': 'You cannot build on railroads or utilities.',
    'err.has_house': 'That set already has a house.',
    'err.house_before_hotel': 'Build a house before a hotel.',
    'err.has_hotel': 'That set already has a hotel.',

    // Rent
    'err.choose_rent_colour': 'Choose a colour to charge rent on.',
    'err.rent_wrong_colour': '{card} cannot charge {color} rent.',
    'err.no_properties_of_colour': 'You own no {color} properties.',
    'err.no_rent': 'That set charges no rent.',
    'err.not_double_rent': 'That is not a Double The Rent card.',
    'err.double_rent_with_rent': 'Double The Rent must be played together with a rent card.',
    'err.need_plays': 'You need {need} plays, you have {have}.',

    // Responses and payment
    'err.nothing_to_respond': 'Nothing to respond to.',
    'err.not_your_response': 'It is not your turn to respond.',
    'err.jsn_response_only': 'Just Say No can only be played in response.',
    'err.no_jsn': 'You have no Just Say No card.',
    'err.waiting_other_player': 'Waiting on the other player.',
    'err.duplicate_payment_card': 'Duplicate card in payment.',
    'err.pay_more': 'Pay ${amount}M (you selected ${selected}M of ${available}M available).',

    // Transport
    'err.unknown_message': 'Unknown message type "{type}".',
    'err.bad_signal': 'Malformed signal.',
    'err.no_self_signal': 'You cannot signal yourself.',
    'err.peer_offline': 'That player is not connected.',
};

export default errors;
