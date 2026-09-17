import type { Catalog } from '../types';

/**
 * Italian: every refusal the server can send back.
 *
 * The Go side returns a key plus the values it formatted its own fallback
 * with (`fault(...)` / `game.NewFault(...)`), so the placeholder names below
 * must match the argument names in those calls.
 */
const errors: Catalog = {
    // Identity and table ownership
    'err.choose_name': 'Scegli prima un nome.',
    'err.not_owner': 'Solo chi ha aperto il tavolo può farlo.',
    'err.missing_player_id': 'Id del giocatore mancante.',
    'err.no_such_table': 'Nessun tavolo con il codice "{code}".',
    'err.close_host_only': 'Solo {host} può chiudere quel tavolo finché c’è gente.',
    'err.not_at_table': 'Non sei a un tavolo.',
    'err.not_at_this_table': 'Quella persona non è a questo tavolo.',
    'err.table_full': 'Il tavolo è pieno.',
    'err.already_seated': 'Hai già un posto.',
    'err.game_started_ask_seat': 'La partita è già iniziata — chiedi invece un posto.',
    'err.end_seated_only': 'Solo i giocatori al tavolo possono terminare la partita.',
    'err.spectator': 'Gli spettatori non possono giocare.',
    'err.pick_someone_else': 'Scegli qualcun altro da rimuovere.',
    'err.remove_lobby_only': 'I giocatori possono essere rimossi solo prima che la partita inizi.',

    // Options and lobby
    'err.options_locked': 'Le opzioni possono cambiare solo prima che la partita inizi.',
    'err.unknown_mode': 'Modalità di gioco "{mode}" sconosciuta.',
    'err.mode_unavailable': 'Quella modalità non è ancora disponibile.',
    'err.bad_turn_length': 'Durata del turno non supportata.',
    'err.difficulty_lobby_only': 'La difficoltà dei robot può cambiare solo prima che la partita inizi.',
    'err.unknown_difficulty': 'Difficoltà "{difficulty}" sconosciuta.',
    'err.bots_lobby_only': 'I robot possono essere aggiunti o tolti solo prima che la partita inizi.',
    'err.no_bots': 'Nessun robot a questo tavolo.',
    'err.game_in_progress': 'Partita già in corso.',
    'err.game_full': 'La partita è al completo.',
    'err.already_started': 'Partita già iniziata.',
    'err.need_two_players': 'Servono almeno 2 giocatori.',

    // Turn state
    'err.no_game': 'Nessuna partita in corso.',
    'err.resolve_first': 'Prima risolvi l’azione in corso.',
    'err.player_not_found': 'Giocatore non trovato.',
    'err.not_your_turn': 'Non è il tuo turno.',
    'err.no_plays_left': 'Nessuna giocata rimasta in questo turno.',
    'err.card_not_in_hand': 'Quella carta non è nella tua mano.',
    'err.card_not_in_play': 'Quella carta non è in gioco.',

    // Playing cards
    'err.no_action': 'Quella carta non ha nessuna azione.',
    'err.unsupported_card': 'Carta non supportata.',
    'err.no_banking_property': 'Le carte proprietà non possono finire in banca.',
    'err.not_a_property': 'Quella non è una carta proprietà.',
    'err.choose_colour': 'Scegli un colore per questa proprietà.',
    'err.wrong_colour': '{card} non può essere giocata come {color}.',
    'err.only_wildcards_move': 'Solo i jolly possono essere spostati.',
    'err.already_that_colour': 'È già di quel colore.',
    'err.wild_any_needs_set': 'Non hai nessuna proprietà {color} a cui unire il jolly.',
    'err.wildcard_not_in_play': 'Quel jolly non è nelle tue serie.',

    // Targeting
    'err.no_opponents': 'Nessun avversario.',
    'err.choose_target': 'Scegli un giocatore bersaglio.',
    'err.no_self_target': 'Non puoi prendere di mira te stesso.',
    'err.target_not_found': 'Giocatore bersaglio non trovato.',
    'err.choose_property': 'Scegli una carta proprietà.',
    'err.complete_set_protected': 'Non puoi prendere una carta da una serie completa.',
    'err.property_not_found': 'Proprietà non trovata.',
    'err.deal_breaker_needs_set': 'Affare Rotto ha bisogno di una serie completa.',

    // Building
    'err.choose_set': 'Scegli su quale serie completa costruire.',
    'err.needs_complete_set': '{card} ha bisogno di una serie completa.',
    'err.cannot_build_here': 'Non puoi costruire su ferrovie o servizi.',
    'err.has_house': 'Quella serie ha già una casa.',
    'err.house_before_hotel': 'Costruisci una casa prima di un albergo.',
    'err.has_hotel': 'Quella serie ha già un albergo.',

    // Rent
    'err.choose_rent_colour': 'Scegli un colore su cui chiedere l’affitto.',
    'err.rent_wrong_colour': '{card} non può chiedere l’affitto {color}.',
    'err.no_properties_of_colour': 'Non possiedi nessuna proprietà {color}.',
    'err.no_rent': 'Quella serie non frutta nessun affitto.',
    'err.not_double_rent': 'Quella non è una carta Raddoppia l’Affitto.',
    'err.double_rent_with_rent': 'Raddoppia l’Affitto va giocata insieme a una carta affitto.',
    'err.need_plays': 'Ti servono {need} giocate, ne hai {have}.',

    // Responses and payment
    'err.nothing_to_respond': 'Non c’è niente a cui rispondere.',
    'err.not_your_response': 'Non tocca a te rispondere.',
    'err.jsn_response_only': 'Dì Solo No può essere giocata solo in risposta.',
    'err.no_jsn': 'Non hai nessuna carta Dì Solo No.',
    'err.waiting_other_player': 'In attesa dell’altro giocatore.',
    'err.duplicate_payment_card': 'Carta duplicata nel pagamento.',
    'err.pay_more': 'Paga ${amount}M (hai selezionato ${selected}M dei ${available}M disponibili).',

    // Transport
    'err.unknown_message': 'Tipo di messaggio "{type}" sconosciuto.',
    'err.bad_signal': 'Segnale malformato.',
    'err.no_self_signal': 'Non puoi segnalare te stesso.',
    'err.peer_offline': 'Quel giocatore non è connesso.',
};

export default errors;
