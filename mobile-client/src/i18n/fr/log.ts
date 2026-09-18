import type { Catalog } from '../types';

/**
 * French: The table log, the chat notices the server announces, and the chrome
 * of the log/chat panels.
 *
 * The server never sends a finished sentence: it sends a key plus values, so
 * each seat reads the same move in its own language. Keys here must match the
 * ones emitted by `g.log(...)` / `Announce(...)` in the Go code exactly.
 */
const log: Catalog = {
    // Table and seats
    'log.joined': '{name} a rejoint la table.',
    'log.left': '{name} est parti.',
    'log.disconnected': '{name} s’est déconnecté.',
    'log.asked_for_seat': '{name} a demandé une place.',
    'log.removed': '{name} a été retiré de la table.',
    'log.game_started': 'Partie commencée — {mode}, {players} joueurs.',
    'log.table_cleared': 'Table vidée.',
    'log.game_ended': '{name} a terminé la partie.',
    'log.reshuffled': 'La défausse a été remélangée dans la pioche.',

    // Turn flow. The em dash marks the turn line, which LogList styles.
    'log.turn': '— Tour de {name} —',
    // The scripted table rebuilds itself for each lesson; this marks where.
    'log.tutorial_lesson': '— Leçon : {lesson} —',
    'log.timeout_respond': '{name} a manqué de temps pour répondre.',
    'log.timeout_turn': 'Le tour de {name} est expiré.',

    // Plays
    'log.banked': '{name} a mis en banque {card} (${amount}M).',
    'log.banked_money': '{name} a mis en banque ${amount}M.',
    'log.played_property': '{name} a joué {card} en {color}.',
    'log.moved_wildcard': '{name} a déplacé {card} vers {color}.',
    'log.discarded_excess.one': 'La main de {name} dépassait la limite — 1 carte s’est envolée.',
    'log.discarded_excess.other': 'La main de {name} dépassait la limite — {count} cartes se sont envolées.',
    'log.pass_go.one': '{name} a joué Départ et pioché {count} carte.',
    'log.pass_go.other': '{name} a joué Départ et pioché {count} cartes.',
    'log.building': '{name} a joué {card} sur {color} — le loyer est maintenant de ${rent}M.',

    // Charging and stealing
    'log.charge': '{name} a joué {card} : {targets} doit ${amount}M.',
    'log.charge_everyone': '{name} a joué {card} : tout le monde doit ${amount}M.',
    'log.sly_deal': '{name} veut une propriété {color} de {target}.',
    'log.forced_deal': '{name} veut échanger une propriété {color} avec {target}.',
    'log.deal_breaker': '{name} veut le groupe complet {color} de {target}.',

    // Responses
    'log.nothing_to_pay': '{name} n’a rien pour payer.',
    'log.just_say_no_cancelled': '{name} a dit Juste dites non — {label} est annulé.',
    'log.just_say_no_back_on': '{name} a dit Juste dites non — {label} est rétabli.',
    'log.accepts_block': '{name} accepte le blocage.',

    // Settlements. `cards` counts the cards handed over, so this pluralises.
    'log.paid.one': '{from} a payé à {to} ${amount}M ({count} carte).',
    'log.paid.other': '{from} a payé à {to} ${amount}M ({count} cartes).',
    'log.stole': '{name} a pris {card} à {target}.',
    'log.swapped': '{name} a donné {gave} à {target} et a pris {got}.',
    'log.took_set': '{name} a pris le groupe complet {color} de {target}.',

    // Wins
    'log.win_classic': '🏆 {name} gagne avec {sets} groupes complets !',
    'log.win_deathmatch': '🏆 {name} gagne le combat à mort avec {sets} groupes complets !',

    // Notices the server sends straight to one client.
    'notice.table_closed': '« {table} » a été fermée.',
    'notice.you_closed_table': '« {table} » fermée.',

    // Panel chrome
    'log.empty': 'Rien pour l’instant.',
    'panel.log': 'Historique',
    'panel.chat': 'Discussion',
    'panel.hide': 'Masquer le panneau',
    'panel.show': 'Afficher historique et discussion',
    'panel.title_log': 'Historique de la table',
    'panel.title_chat': 'Discussion de la table',
};

export default log;
