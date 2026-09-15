import type { Catalog } from '../types';

/**
 * Italian: the table log, the chat notices the server announces, and the chrome
 * of the log/chat panels.
 *
 * The server never sends a finished sentence: it sends a key plus values, so
 * each seat reads the same move in its own language. Keys here must match the
 * ones emitted by `g.log(...)` / `Announce(...)` in the Go code exactly.
 */
const log: Catalog = {
    // Table and seats
    'log.joined': '{name} è entrato.',
    'log.left': '{name} se n’è andato.',
    'log.disconnected': '{name} si è disconnesso.',
    'log.asked_for_seat': '{name} ha chiesto un posto.',
    'log.removed': '{name} è stato rimosso dal tavolo.',
    'log.game_started': 'Partita iniziata — {mode}, {players} giocatori.',
    'log.table_cleared': 'Tavolo sgombrato.',
    'log.game_ended': '{name} ha terminato la partita.',
    'log.reshuffled': 'Gli scarti sono stati rimescolati nel mazzo.',

    // Turn flow. The em dash marks the turn line, which LogList styles.
    'log.turn': '— Turno di {name} —',
    'log.timeout_respond': '{name} non ha risposto in tempo.',
    'log.timeout_turn': 'Il turno di {name} è scaduto.',

    // Plays
    'log.banked': '{name} ha messo in banca {card} (${amount}M).',
    'log.banked_money': '{name} ha messo in banca ${amount}M.',
    'log.played_property': '{name} ha giocato {card} come {color}.',
    'log.moved_wildcard': '{name} ha spostato {card} su {color}.',
    'log.discarded_excess.one': '{name} aveva troppe carte — 1 carta è volata via.',
    'log.discarded_excess.other': '{name} aveva troppe carte — {count} carte sono volate via.',
    'log.pass_go.one': '{name} ha giocato Via! e ha pescato {count} carta.',
    'log.pass_go.other': '{name} ha giocato Via! e ha pescato {count} carte.',
    'log.building': '{name} ha giocato {card} su {color} — ora l’affitto è ${rent}M.',

    // Charging and stealing
    'log.charge': '{name} ha giocato {card}: {targets} deve ${amount}M.',
    'log.charge_everyone': '{name} ha giocato {card}: tutti devono ${amount}M.',
    'log.sly_deal': '{name} vuole una proprietà {color} da {target}.',
    'log.forced_deal': '{name} vuole scambiare una proprietà {color} con {target}.',
    'log.deal_breaker': '{name} vuole la serie {color} completa di {target}.',

    // Responses
    'log.nothing_to_pay': '{name} non ha niente con cui pagare.',
    'log.just_say_no_cancelled': '{name} ha detto Dì Solo No — {label} è annullato.',
    'log.just_say_no_back_on': '{name} ha detto Dì Solo No — {label} vale di nuovo.',
    'log.accepts_block': '{name} accetta il blocco.',

    // Settlements. `cards` counts the cards handed over, so this pluralises.
    'log.paid.one': '{from} ha pagato ${amount}M a {to} ({count} carta).',
    'log.paid.other': '{from} ha pagato ${amount}M a {to} ({count} carte).',
    'log.stole': '{name} ha preso {card} da {target}.',
    'log.swapped': '{name} ha dato {gave} a {target} e ha preso {got}.',
    'log.took_set': '{name} ha preso la serie {color} completa di {target}.',

    // Wins
    'log.win_classic': '🏆 {name} vince con {sets} serie complete!',
    'log.win_deathmatch': '🏆 {name} vince lo scontro mortale con {sets} serie complete!',

    // Chat lines the server announces.
    'chat.radio_on': '{name} ha sintonizzato la radio su {station}',
    'chat.radio_off': '{name} ha spento la radio',
    'chat.joined_call': '{name} è entrato in chiamata',
    'chat.left_call': '{name} è uscito dalla chiamata',

    // Notices the server sends straight to one client.
    'notice.table_closed': '"{table}" è stato chiuso.',
    'notice.you_closed_table': 'Hai chiuso "{table}".',

    // Panel chrome
    'log.empty': 'Ancora niente.',
    'chat.empty': 'Ancora nessun messaggio. Saluta.',
    'chat.placeholder': 'Scrivi al tavolo…',
    'chat.send': 'Invia',
    'panel.log': 'Registro',
    'panel.chat': 'Chat',
    'panel.hide': 'Nascondi il pannello',
    'panel.show': 'Mostra registro e chat',
    'panel.title_log': 'Registro del tavolo',
    'panel.title_chat': 'Chat del tavolo',
};

export default log;
