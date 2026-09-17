import type { Catalog } from '../types';

/**
 * The table log, the chat notices the server announces, and the chrome of the
 * log/chat panels.
 *
 * The server never sends a finished sentence: it sends a key plus values, so
 * each seat reads the same move in its own language. Keys here must match the
 * ones emitted by `g.log(...)` / `Announce(...)` in the Go code exactly.
 */
const log: Catalog = {
    // Table and seats
    'log.joined': '{name} ist dazugekommen.',
    'log.left': '{name} ist gegangen.',
    'log.disconnected': '{name} hat die Verbindung verloren.',
    'log.asked_for_seat': '{name} hat um einen Platz gebeten.',
    'log.removed': '{name} wurde vom Tisch entfernt.',
    'log.game_started': 'Spiel gestartet — {mode}, {players} Spieler.',
    'log.table_cleared': 'Tisch abgeräumt.',
    'log.game_ended': '{name} hat das Spiel beendet.',
    'log.reshuffled': 'Ablagestapel wurde in den Nachziehstapel gemischt.',

    // Turn flow. The em dash marks the turn line, which LogList styles.
    'log.turn': '— {name} ist dran —',
    // The scripted table rebuilds itself for each lesson; this marks where.
    'log.tutorial_lesson': '— Lektion: {lesson} —',
    'log.timeout_respond': '{name} hatte keine Zeit mehr zu antworten.',
    'log.timeout_turn': 'Die Runde von {name} ist abgelaufen.',

    // Plays
    'log.banked': '{name} hat {card} in die Bank gelegt (${amount}M).',
    'log.banked_money': '{name} hat ${amount}M in die Bank gelegt.',
    'log.played_property': '{name} hat {card} als {color} gespielt.',
    'log.moved_wildcard': '{name} hat {card} auf {color} bewegt.',
    'log.discarded_excess.one': '{name} hatte zu viele Karten — 1 Karte wehte davon.',
    'log.discarded_excess.other': '{name} hatte zu viele Karten — {count} Karten wehten davon.',
    'log.pass_go.one': '{name} hat Los! gespielt und {count} Karte gezogen.',
    'log.pass_go.other': '{name} hat Los! gespielt und {count} Karten gezogen.',
    'log.building': '{name} hat {card} auf {color} gespielt — die Miete liegt jetzt bei ${rent}M.',

    // Charging and stealing
    'log.charge': '{name} hat {card} gespielt: {targets} schuldet ${amount}M.',
    'log.charge_everyone': '{name} hat {card} gespielt: alle schulden ${amount}M.',
    'log.sly_deal': '{name} will eine {color}-Immobilie von {target}.',
    'log.forced_deal': '{name} will eine {color}-Immobilie mit {target} tauschen.',
    'log.deal_breaker': '{name} will den vollständigen {color}-Satz von {target}.',

    // Responses
    'log.nothing_to_pay': '{name} hat nichts zum Zahlen.',
    'log.just_say_no_cancelled': '{name} sagte einfach Nein — {label} ist abgebrochen.',
    'log.just_say_no_back_on': '{name} sagte einfach Nein — {label} gilt wieder.',
    'log.accepts_block': '{name} akzeptiert den Block.',

    // Settlements. `cards` counts the cards handed over, so this pluralises.
    'log.paid.one': '{from} hat {to} ${amount}M gezahlt ({count} Karte).',
    'log.paid.other': '{from} hat {to} ${amount}M gezahlt ({count} Karten).',
    'log.stole': '{name} hat {card} von {target} genommen.',
    'log.swapped': '{name} hat {gave} an {target} gegeben und {got} genommen.',
    'log.took_set': '{name} hat den vollständigen {color}-Satz von {target} genommen.',

    // Wins
    'log.win_classic': '🏆 {name} gewinnt mit {sets} vollständigen Sätzen!',
    'log.win_deathmatch': '🏆 {name} gewinnt das Deathmatch mit {sets} vollständigen Sätzen!',

    // Chat lines the server announces.
    'chat.joined_call': '{name} ist dem Anruf beigetreten',
    'chat.left_call': '{name} hat den Anruf verlassen',

    // Notices the server sends straight to one client.
    'notice.table_closed': '"{table}" wurde geschlossen.',
    'notice.you_closed_table': '"{table}" geschlossen.',

    // Panel chrome
    'log.empty': 'Noch nichts.',
    'chat.empty': 'Noch keine Nachrichten. Sag hallo.',
    'chat.placeholder': 'Nachricht an den Tisch…',
    'chat.send': 'Senden',
    'panel.log': 'Log',
    'panel.chat': 'Chat',
    'panel.hide': 'Feld ausblenden',
    'panel.show': 'Log und Chat anzeigen',
    'panel.title_log': 'Tischlog',
    'panel.title_chat': 'Tischchat',
};

export default log;
