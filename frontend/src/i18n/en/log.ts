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
    'log.joined': '{name} joined.',
    'log.left': '{name} left.',
    'log.disconnected': '{name} disconnected.',
    'log.asked_for_seat': '{name} asked for a seat.',
    'log.removed': '{name} was removed from the table.',
    'log.game_started': 'Game started — {mode}, {players} players.',
    'log.table_cleared': 'Table cleared.',
    'log.game_ended': '{name} ended the game.',
    'log.reshuffled': 'Discard pile reshuffled into the deck.',

    // Turn flow. The em dash marks the turn line, which LogList styles.
    'log.turn': "— {name}'s turn —",
    'log.timeout_respond': '{name} ran out of time to respond.',
    'log.timeout_turn': "{name}'s turn timed out.",

    // Plays
    'log.banked': '{name} banked {card} (${amount}M).',
    'log.banked_money': '{name} banked ${amount}M.',
    'log.played_property': '{name} played {card} as {color}.',
    'log.moved_wildcard': '{name} moved {card} to {color}.',
    'log.discarded': '{name} discarded {card}.',
    'log.pass_go.one': '{name} played Pass Go and drew {count} card.',
    'log.pass_go.other': '{name} played Pass Go and drew {count} cards.',
    'log.building': '{name} played {card} on {color} — rent is now ${rent}M.',

    // Charging and stealing
    'log.charge': '{name} played {card}: {targets} owes ${amount}M.',
    'log.charge_everyone': '{name} played {card}: everyone owes ${amount}M.',
    'log.sly_deal': '{name} wants a {color} property from {target}.',
    'log.forced_deal': '{name} wants to swap a {color} property with {target}.',
    'log.deal_breaker': "{name} wants {target}'s complete {color} set.",

    // Responses
    'log.nothing_to_pay': '{name} has nothing to pay with.',
    'log.just_say_no_cancelled': '{name} said Just Say No — {label} is cancelled.',
    'log.just_say_no_back_on': '{name} said Just Say No — {label} is back on.',
    'log.accepts_block': '{name} accepts the block.',

    // Settlements. `cards` counts the cards handed over, so this pluralises.
    'log.paid.one': '{from} paid {to} ${amount}M ({count} card).',
    'log.paid.other': '{from} paid {to} ${amount}M ({count} cards).',
    'log.stole': '{name} took {card} from {target}.',
    'log.swapped': '{name} gave {gave} to {target} and took {got}.',
    'log.took_set': "{name} took {target}'s complete {color} set.",

    // Wins
    'log.win_classic': '🏆 {name} wins with {sets} complete sets!',
    'log.win_deathmatch': '🏆 {name} wins the death match with {sets} complete sets!',

    // Chat lines the server announces.
    'chat.radio_on': '{name} tuned the radio to {station}',
    'chat.radio_off': '{name} switched the radio off',
    'chat.joined_call': '{name} joined the call',
    'chat.left_call': '{name} left the call',

    // Notices the server sends straight to one client.
    'notice.table_closed': '"{table}" was closed.',
    'notice.you_closed_table': 'Closed "{table}".',

    // Panel chrome
    'log.empty': 'Nothing yet.',
    'chat.empty': 'No messages yet. Say hello.',
    'chat.placeholder': 'Message the table…',
    'chat.send': 'Send',
    'panel.log': 'Log',
    'panel.chat': 'Chat',
    'panel.hide': 'Hide panel',
    'panel.show': 'Show log and chat',
    'panel.title_log': 'Table log',
    'panel.title_chat': 'Table chat',
};

export default log;
