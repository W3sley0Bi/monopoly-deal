import type { Catalog } from '../types';

/** Italian: the table itself — top bar, mat, hand, the action dialog and the pending panel. */
const table: Catalog = {
    'inspect.rent_rule': "Riscuoti l’affitto per un gruppo del colore indicato. L’importo dipende dalle carte e dagli edifici del gruppo.",
    'inspect.money_rule': "Metti questa carta in banca per pagare i debiti. I soldi in mano non possono pagare l’affitto.",
    'inspect.property_rule': "Gioca la carta in un gruppo dello stesso colore. Completa tre gruppi per vincere.",
    'inspect.banked_rule': "Questa carta è denaro in banca. Non puoi più usarne l’azione.",
    'inspect.played_as': "Colore attivo",
    'inspect.set_progress': "Progresso del gruppo",
    'inspect.protected': "Gruppo completo: protetto da Furto Furbo e Scambio Forzato. Un Affare Rotto può ancora prendere l’intero gruppo.",
    'inspect.exposed': "Gruppo incompleto: queste proprietà possono essere rubate o scambiate.",
    'inspect.wild_choose': "Scegli il colore quando giochi. Il lato scelto sarà in alto sul tavolo.",
    'inspect.buildings': "Edifici",
    'inspect.assets': "Patrimonio totale",
    'inspect.open_board': "Clicca per vedere tutte le carte sul tavolo.",
    'inspect.hand_hint': "Passa il mouse per i dettagli · Clicca per scegliere · Trascina per giocare",

    'table.reactions': "Reazioni",
    'table.reaction_0': "Ben giocato",
    'table.reaction_1': "Che furberia",
    'table.reaction_2': "Che ridere",
    'table.reaction_3': "Incredibile",

    'table.motion': "Animazione carte",
    'table.on': "Attiva",
    'table.off': "Disattiva",
    'table.turn_of': "Turno di {name}",
    'table.shared_space': "Un tavolo. Tutta l’azione.",
    'table.hero_title': "Piccole carte.",
    'table.hero_punch': "Grandi tradimenti.",
    'table.robot': "Robot",
    'table.player': "Giocatore",

    // ── Top bar ──────────────────────────────────────────────────────────
    'table.leave_hint': 'Lascia questo tavolo e torna alla lista dei tavoli',
    'table.tables': 'Tavoli',
    'table.your_turn': 'Tocca a te',
    'table.plays': 'Giocate',
    'table.plays_hint': 'Giocate rimaste in questo turno',
    'table.end_turn': 'Fine turno',
    'table.end_turn_hint': 'Concludi il tuo turno',
    'table.auto_end': 'Turno chiuso tra {seconds}s',
    'table.auto_end_short': '⏱ {seconds}s',
    'table.discard_first': 'Prima scarta fino a 7 carte',
    'table.deck_hint': 'Carte rimaste nel mazzo',
    'table.discard_hint': 'Scarti',
    'table.bank_hint': 'La tua banca',
    'table.sets_hint': 'Serie complete',

    // ── Table menu ───────────────────────────────────────────────────────
    'table.menu': 'Menu del tavolo',
    'table.menu_summary': '{mode} · {turn} · organizzatore {host}',
    'table.menu_robots': 'Robot: {difficulty}',
    'table.cancel_seat': 'Annulla la richiesta di posto',
    'table.ask_seat': 'Chiedi un posto per la prossima partita',
    'table.end_game': 'Termina questa partita',
    'table.end_game_confirm': 'Tocca di nuovo per terminarla per tutti',
    'table.tutorial_stop': 'Interrompi il tutorial',
    'table.tutorial_start': '🎓 Mostrami come si gioca',
    'table.leave': 'Lascia il tavolo',

    // ── Spectator bar ────────────────────────────────────────────────────
    'table.watching': '👁 Stai guardando',
    'table.seat_waiting': 'In attesa di un posto — annulla',
    'table.back_to_tables': 'Torna ai tavoli',
    'table.queue': 'In coda: {names}',

    // ── Deck, discard and the action space ───────────────────────────────
    'table.deck': 'Mazzo',
    'table.deck_count': 'Mazzo {count}',
    'table.discard': 'Scarti',
    'table.discard_count': 'Scarti {count}',
    'table.discard_empty': 'vuoto',
    'table.play_it': 'Giocala',
    'table.action_space': 'Spazio azioni',

    // ── Bank ─────────────────────────────────────────────────────────────
    'table.bank': 'Banca',
    'table.bank_drop': 'In banca {amount}',
    'table.your_bank': 'La tua banca',
    'table.bank_cards.one': '{count} carta',
    'table.bank_cards.other': '{count} carte',
    'table.bank_view': 'Apri ›',
    'table.bank_empty': 'Trascina qui denaro e carte azione per pagare l’affitto',
    'table.bank_sheet_total': '{amount} su {cards}',
    'table.bank_sheet_empty': 'Ancora niente in banca. Metti in banca denaro e carte azione per poter pagare l’affitto.',

    // ── Properties ───────────────────────────────────────────────────────
    'table.your_properties': 'Le tue proprietà',
    'table.board_fold': 'Chiudi il tuo tabellone',
    'table.hand_position': 'Mano',
    'table.hand_left': 'Sinistra',
    'table.hand_right': 'Destra',
    'table.hand_bottom': 'In basso',
    'table.board_unfold': 'Mostra il tuo tabellone',
    'table.sets_progress': '{done}/3 serie',
    'table.empty_hand_to_win': ' · svuota la mano per vincere',
    'table.new_set': 'nuova',
    'table.properties_tap': 'Tocca o trascina una carta proprietà in una serie',
    'table.properties_drag': 'Trascina qui una carta proprietà per iniziare una serie',
    // The wildcard rule changed: a card already on the table is no longer free
    // to shuffle around, so the mat says what a move now costs.
    'table.wildcard_move_cost': 'Spostare un jolly già sul tavolo costa una giocata.',

    // ── Hand ─────────────────────────────────────────────────────────────
    'table.hand': 'Mano · {count}',
    'table.over_limit': 'Più di 7 — scarta {count}',
    'table.hand_tap': 'Tocca una carta per le opzioni o trascinala in alto',
    'table.hand_drag': 'Trascina una carta sul tavolo, oppure toccala per le opzioni',
    'table.hand_empty': 'Nessuna carta — ne peschi 5 all’inizio del tuo prossimo turno.',

    // ── Selected card bar ────────────────────────────────────────────────
    'table.wait_your_turn': 'Aspetta il tuo turno.',
    'table.resolve_first': 'Prima risolvi l’azione in corso.',
    'table.place_property': 'Piazza la proprietà',
    'table.charge_rent': 'Chiedi l’affitto',
    'table.play_action': 'Gioca l’azione',
    'table.bank_card': 'In banca {amount}',
    'table.discard_card': 'Scarta',
    'table.discard_this': 'Scarta questa carta',
    'table.discard_locked': 'Puoi scartare solo quando superi il limite di 7 carte',
    'table.just_say_no_hint': 'Tienila in mano per bloccare le azioni contro di te.',
    'table.double_rent_hint': 'Sceglila dalla finestra dell’affitto per raddoppiare la richiesta.',

    // ── Sheets ───────────────────────────────────────────────────────────
    'table.their_board': 'Le loro proprietà e la loro banca',
    'table.talk': 'Chat e registro del tavolo',

    // ── Action dialog ────────────────────────────────────────────────────
    'dialog.move_wildcard': 'Sposta il jolly',
    'dialog.place_property': 'Piazza la proprietà',
    'dialog.pick_set': '{card} — scegli una serie di colore',
    'dialog.move_here': 'Spostala qui',
    'dialog.play_here': 'Giocala qui',
    'dialog.color': 'Colore',
    'dialog.sets_to_win': 'Completa 3 serie di colore per vincere.',
    // Both halves of the new wildcard rule, so a player learns the cost and the
    // restriction in the very dialog that enforces them.
    'dialog.move_costs_play': 'Spostare un jolly che è già sul tavolo costa una giocata.',
    'dialog.move_needs_property': 'Un jolly di qualsiasi colore può passare solo a un colore in cui hai già una proprietà.',
    'dialog.no_plays_left': 'Nessuna giocata rimasta in questo turno.',

    'dialog.charge_rent': 'Chiedi l’affitto',
    'dialog.rent_any': 'Qualsiasi colore — riguarda un solo avversario',
    'dialog.rent_all': 'Riguarda tutti gli avversari',
    'dialog.plays_used': 'Usa {needed} delle tue {left} giocate rimaste',
    'dialog.charge': 'Chiedi {amount}',
    'dialog.color_you_own': 'Colore che possiedi',
    'dialog.target': 'Bersaglio',
    'dialog.double_rent': 'Raddoppia l’Affitto (1 giocata in più ciascuna)',
    'dialog.rent_due': 'Affitto dovuto:',
    'dialog.not_enough_plays': 'Giocate rimaste insufficienti.',

    'dialog.build_house': 'Costruisci una casa',
    'dialog.build_hotel': 'Costruisci un albergo',
    'dialog.choose_complete_set': 'Scegli una serie completa',
    'dialog.no_buildable_set': 'Nessuna serie adatta — ti serve una serie completa (e una casa prima di un albergo)',
    'dialog.build': 'Costruisci',
    'dialog.bank_it_instead': 'Mettila in banca, oppure tienila per dopo.',

    'dialog.debt_collector': 'Esattore',
    'dialog.debt_collector_blurb': 'Un avversario ti deve {amount}',
    'dialog.collect': 'Incassa {amount}',
    'dialog.in_play': ' · {amount} in gioco',

    'dialog.deal_breaker': 'Affare Rotto',
    'dialog.deal_breaker_blurb': 'Ruba un’intera serie completa',
    'dialog.take_the_set': 'Prendi la serie',
    'dialog.victim': 'Vittima',
    'dialog.set_to_steal': 'Serie completa da rubare',
    'dialog.no_complete_set': '{name} non ha nessuna serie completa.',
    'dialog.full_sets.one': ' · {count} serie completa',
    'dialog.full_sets.other': ' · {count} serie complete',

    'dialog.forced_deal': 'Scambio Forzato',
    'dialog.sly_deal': 'Furto Furbo',
    'dialog.forced_deal_blurb': 'Scambia una tua proprietà con una loro',
    'dialog.sly_deal_blurb': 'Ruba una proprietà (non da una serie completa)',
    'dialog.offer_swap': 'Proponi lo scambio',
    'dialog.steal_it': 'Rubala',
    'dialog.their_properties': 'Proprietà di {name} — scegline una da prendere',
    'dialog.nothing_stealable': 'Niente da prendere — ogni proprietà è in una serie completa.',
    'dialog.your_give': 'La tua proprietà da cedere',
    'dialog.nothing_to_give': 'Non hai nessuna proprietà fuori da una serie completa.',

    'dialog.no_choices': 'Questa carta non ha altre scelte.',

    // ── Pending panel ────────────────────────────────────────────────────
    'pending.ui.deal_breaker': '{by} vuole prendere l’intera serie {color} di {victim}.',
    'pending.ui.sly_deal': '{by} vuole rubare una proprietà {color} a {victim}.',
    'pending.ui.forced_deal': '{by} vuole scambiare una proprietà con la proprietà {color} di {victim}.',
    'pending.ui.played': '{by} ha giocato {card}.',
    'pending.ui.someone': 'Qualcuno',
    'pending.ui.them': 'loro',

    'pending.ui.in_progress': 'Azione in corso',
    'pending.ui.waiting_on': 'In attesa di {names}',
    'pending.ui.resolving': 'Risoluzione…',
    'pending.ui.blocked_it': 'ha bloccato',
    'pending.ui.settled': 'ha saldato',
    'pending.ui.said_no': 'ha detto no',
    'pending.ui.owes': 'deve {amount}',
    'pending.ui.deciding': 'sta decidendo',

    'pending.ui.you_blocked': 'Sei stato bloccato!',
    'pending.ui.you_blocked_blurb': 'Gioca il tuo Dì Solo No per farla passare, oppure lascia perdere.',
    'pending.ui.let_it_go': 'Lascia perdere',
    'pending.ui.just_say_no': '🚫 Dì Solo No',

    'pending.ui.you_target': 'Sei tu il bersaglio',
    'pending.ui.you_target_blurb': 'Bloccala con Dì Solo No, oppure lasciala passare.',
    'pending.ui.allow_it': 'Lasciala passare',

    'pending.ui.you_owe': 'Devi {amount}',
    'pending.ui.give_everything': 'Hai solo {amount} in gioco — consegna tutto.',
    'pending.ui.pick_cards': 'Scegli le carte dalla tua banca e dalle tue proprietà. Non si dà resto.',
    'pending.ui.action_card': 'Carta giocata',
    'pending.ui.your_play': 'La tua giocata',
    'pending.ui.your_cards': 'Le tue carte — tocca per cederle',
    'pending.ui.selected': 'Selezionato {selected} di {owed}',
    'pending.ui.auto_pay': 'Scegli prima che scada il tempo, oppure vengono pagate le carte meno costose al posto tuo.',
    'pending.ui.pay': 'Paga {amount}',
    'pending.ui.nothing_in_play': 'Non hai niente in gioco — non paghi nulla.',
    'pending.ui.from_bank': 'Banca',

    // ── Pending labels the server names ──────────────────────────────────
    'pending.birthday': 'È il mio compleanno — ${amount}M',
    'pending.debt_collector': 'Esattore — ${amount}M',
    'pending.rent': 'Affitto {color} — ${amount}M',
    'pending.rent_multiplied': 'Affitto {color} (x{multiplier}) — ${amount}M',
    'pending.sly_deal': 'Furto Furbo',
    'pending.forced_deal': 'Scambio Forzato',
    'pending.deal_breaker': 'Affare Rotto',
};

export default table;
