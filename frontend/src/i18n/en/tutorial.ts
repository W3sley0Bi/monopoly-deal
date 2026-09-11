import type { Catalog } from '../types';

/** The guided tour: one title/body (and sometimes a task) per step, plus the
 *  chrome around the card. Step keys mirror the step ids in Tutorial.tsx so a
 *  translator can follow the tour in order. */
const tutorial: Catalog = {
    'tutorial.label': 'Tutorial',
    'tutorial.progress': 'Tutorial {current}/{total}',
    'tutorial.skipTour': 'Skip tour',
    'tutorial.skipStep': 'Skip step',
    'tutorial.finish': 'Finish',
    'tutorial.taskDone': '✓ Done',
    'tutorial.waiting': 'Waiting…',

    'tutorial.welcome.title': 'Welcome to the practice table',
    'tutorial.welcome.body': 'You are playing two robots. Nothing here is timed and nobody is waiting, so take as long as you like. This tour walks you through one full turn.',
    'tutorial.welcome.task': 'Press Next to begin.',

    'tutorial.goal.title': 'How you win',
    'tutorial.goal.body': 'Collect three complete colour sets. A set is complete at its real size: two cards for brown and blue, three for most colours, four for railroads.',

    'tutorial.hand.title': 'Your hand',
    'tutorial.hand.body': 'Every turn you draw two cards (five if your hand is empty) and may make up to three plays. Property, money, action and rent cards all live here together.',
    'tutorial.hand.task': 'Have a look, then press Next.',

    'tutorial.play-property.title': 'Play a property',
    'tutorial.play-property.body': 'Properties are the only cards that win the game. Drag one from your hand onto the mat — or tap it and choose a colour, which is the way to play on a phone.',
    'tutorial.play-property.task': 'Play one property card into a colour set.',
    'tutorial.play-property.blocked': 'Wait for the robots — the tour continues on your turn.',

    'tutorial.bank.title': 'Bank some money',
    'tutorial.bank.body': 'Money and action cards can be banked as cash instead of played. Your bank is what you pay rent and debts from, so a thin bank means handing over property.',
    'tutorial.bank.task': 'Bank a money or action card.',
    'tutorial.bank.blocked': 'Wait for your turn to come back around.',

    'tutorial.plays.title': 'Three plays a turn',
    'tutorial.plays.body': 'These pips count down as you play. Moving a wildcard that is already on your table to another colour costs one of them, so plan the move before you spend your plays. An Any Colour wildcard may only move onto a colour where you already have a property.',

    'tutorial.actions.title': 'Action cards bite',
    'tutorial.actions.body': 'Rent charges every opponent for a colour you own. Sly Deal steals a property, Forced Deal swaps one, Deal Breaker takes a whole finished set. Just Say No cancels any of them — keep one in hand if you can.',

    'tutorial.opponents.title': 'Watch the robots',
    'tutorial.opponents.body': 'Each opponent shows their hand count, their bank and their set progress. A robot sitting on two complete sets is one turn from winning — charge them rent or break the set up.',

    'tutorial.log.title': 'The table log',
    'tutorial.log.body': 'Every play is written down here. When a robot moves and you missed what happened, this is where to look.',

    'tutorial.end-turn.title': 'End your turn',
    'tutorial.end-turn.body': 'When your plays are gone — or you simply want to stop — end the turn. If you are holding more than seven cards you must discard down to seven first.',
    'tutorial.end-turn.task': 'End your turn and let the robots play.',
    'tutorial.end-turn.blocked': 'The robots are playing. Watch the log.',

    'tutorial.pending.title': 'Someone wants your money',
    'tutorial.pending.body': 'When an opponent charges you, a panel opens with what you owe. Pick cards from your bank and property to cover it — there is no change given — or play Just Say No to cancel the whole thing.',
    'tutorial.pending.task': 'Answer the panel to carry on.',

    'tutorial.done.title': 'That is the whole game',
    'tutorial.done.body': 'Three complete sets and the table is yours. Keep practising against the robots for as long as you like — the tour is in the ⚙ menu whenever you want it again.',
    'tutorial.done.task': 'Press Finish and play on.',
};

export default tutorial;
