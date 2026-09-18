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
    'err.choose_name': 'Wähl zuerst einen Namen.',
    'err.not_owner': 'Das kann nur der Besitzer des Tisches.',
    'err.missing_player_id': 'Spieler-ID fehlt.',
    'err.no_such_table': 'Kein Tisch mit dem Code "{code}".',
    'err.close_host_only': 'Solange Leute am Tisch sitzen, kann ihn nur {host} schließen.',
    'err.not_at_table': 'Du bist an keinem Tisch.',
    'err.not_at_this_table': 'Diese Person ist nicht an diesem Tisch.',
    'err.table_full': 'Der Tisch ist voll.',
    'err.already_seated': 'Du hast schon einen Platz.',
    'err.game_started_ask_seat': 'Das Spiel läuft schon — frag stattdessen nach einem Platz.',
    'err.end_seated_only': 'Nur Spieler am Tisch können das Spiel beenden.',
    'err.spectator': 'Zuschauer können nicht mitspielen.',
    'err.pick_someone_else': 'Wähl jemand anderen zum Entfernen.',
    'err.remove_lobby_only': 'Spieler können nur vor dem Spielstart entfernt werden.',

    // Options and lobby
    'err.options_locked': 'Die Optionen lassen sich nur vor dem Spielstart ändern.',
    'err.unknown_mode': 'Unbekannter Spielmodus "{mode}".',
    'err.mode_unavailable': 'Dieser Modus ist noch nicht verfügbar.',
    'err.bad_turn_length': 'Nicht unterstützte Rundenlänge.',
    'err.difficulty_lobby_only': 'Die Roboter-Stärke lässt sich nur vor dem Spielstart ändern.',
    'err.unknown_difficulty': 'Unbekannte Schwierigkeit "{difficulty}".',
    'err.bots_lobby_only': 'Roboter lassen sich nur vor dem Spielstart hinzufügen oder entfernen.',
    'err.no_bots': 'Keine Roboter an diesem Tisch.',
    'err.game_in_progress': 'Es läuft bereits ein Spiel.',
    'err.game_full': 'Das Spiel ist voll.',
    'err.already_started': 'Das Spiel hat schon begonnen.',
    'err.need_two_players': 'Es braucht mindestens 2 Spieler.',

    // Turn state
    'err.no_game': 'Es läuft kein Spiel.',
    'err.resolve_first': 'Klär zuerst die laufende Aktion.',
    'err.player_not_found': 'Spieler nicht gefunden.',
    'err.not_your_turn': 'Du bist nicht dran.',
    'err.no_plays_left': 'Keine Züge mehr in dieser Runde.',
    'err.card_not_in_hand': 'Diese Karte ist nicht auf deiner Hand.',
    'err.card_not_in_play': 'Diese Karte ist nicht im Spiel.',

    // Playing cards
    'err.no_action': 'Diese Karte hat keine Aktion.',
    'err.unsupported_card': 'Nicht unterstützte Karte.',
    'err.no_banking_property': 'Immobilienkarten können nicht in die Bank.',
    'err.not_a_property': 'Das ist keine Immobilienkarte.',
    'err.choose_colour': 'Wähl eine Farbe für diese Immobilie.',
    'err.wrong_colour': '{card} kann nicht als {color} gespielt werden.',
    'err.only_wildcards_move': 'Nur Joker können bewegt werden.',
    'err.already_that_colour': 'Sie hat diese Farbe schon.',
    'err.wild_any_needs_set': 'Du hast keine {color}-Immobilie, zu der der Joker passen könnte.',
    'err.wildcard_not_in_play': 'Dieser Joker liegt nicht in deinen Sätzen.',

    // Targeting
    'err.no_opponents': 'Keine Gegner.',
    'err.choose_target': 'Wähl einen Zielspieler.',
    'err.no_self_target': 'Du kannst nicht dich selbst wählen.',
    'err.target_not_found': 'Zielspieler nicht gefunden.',
    'err.choose_property': 'Wähl eine Immobilienkarte.',
    'err.complete_set_protected': 'Aus einem vollständigen Satz kannst du keine Karte nehmen.',
    'err.property_not_found': 'Immobilie nicht gefunden.',
    'err.deal_breaker_needs_set': 'Geschäftsbruch braucht einen vollständigen Satz.',

    // Building
    'err.choose_set': 'Wähl, auf welchem vollständigen Satz du bauen willst.',
    'err.needs_complete_set': '{card} braucht einen vollständigen Satz.',
    'err.cannot_build_here': 'Auf Bahnhöfen und Werken kannst du nicht bauen.',
    'err.has_house': 'Auf diesem Satz steht schon ein Haus.',
    'err.house_before_hotel': 'Bau ein Haus, bevor du ein Hotel baust.',
    'err.has_hotel': 'Auf diesem Satz steht schon ein Hotel.',

    // Rent
    'err.choose_rent_colour': 'Wähl eine Farbe, für die du Miete kassierst.',
    'err.rent_wrong_colour': '{card} kann keine {color}-Miete kassieren.',
    'err.no_properties_of_colour': 'Du besitzt keine {color}-Immobilien.',
    'err.no_rent': 'Dieser Satz bringt keine Miete.',
    'err.not_double_rent': 'Das ist keine Doppelte-Miete-Karte.',
    'err.double_rent_with_rent': 'Doppelte Miete muss zusammen mit einer Mietkarte gespielt werden.',
    'err.need_plays': 'Du brauchst {need} Züge, du hast {have}.',

    // Responses and payment
    'err.nothing_to_respond': 'Es gibt nichts zu beantworten.',
    'err.not_your_response': 'Du bist nicht mit Antworten dran.',
    'err.jsn_response_only': 'Sag einfach Nein kann nur als Antwort gespielt werden.',
    'err.no_jsn': 'Du hast keine Sag-einfach-Nein-Karte.',
    'err.waiting_other_player': 'Warte auf den anderen Spieler.',
    'err.duplicate_payment_card': 'Doppelte Karte in der Zahlung.',
    'err.pay_more': 'Zahl ${amount}M (du hast ${selected}M von ${available}M verfügbar gewählt).',

    // Transport
    'err.unknown_message': 'Unbekannter Nachrichtentyp "{type}".',
};

export default errors;
