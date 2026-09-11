import type { Catalog } from '../types';

/** Italian: the guided tour — one title/body (and sometimes a task) per step, plus
 *  the chrome around the card. Step keys mirror the step ids in Tutorial.tsx so a
 *  translator can follow the tour in order. */
const tutorial: Catalog = {
    'tutorial.label': 'Tutorial',
    'tutorial.progress': 'Tutorial {current}/{total}',
    'tutorial.skipTour': 'Salta il tutorial',
    'tutorial.skipStep': 'Salta il passo',
    'tutorial.finish': 'Fine',
    'tutorial.taskDone': '✓ Fatto',
    'tutorial.waiting': 'In attesa…',

    'tutorial.welcome.title': 'Benvenuto al tavolo di allenamento',
    'tutorial.welcome.body': 'Giochi contro due robot. Qui niente è a tempo e nessuno ti aspetta, quindi prenditi tutto il tempo che vuoi. Questo tutorial ti accompagna per un turno intero.',
    'tutorial.welcome.task': 'Premi Avanti per iniziare.',

    'tutorial.goal.title': 'Come si vince',
    'tutorial.goal.body': 'Colleziona tre serie di colore complete. Una serie è completa alla sua dimensione reale: due carte per il marrone e il blu, tre per la maggior parte dei colori, quattro per le ferrovie.',

    'tutorial.hand.title': 'La tua mano',
    'tutorial.hand.body': 'Ogni turno peschi due carte (cinque se hai la mano vuota) e puoi fare fino a tre giocate. Proprietà, denaro, azioni e affitti stanno tutti qui insieme.',
    'tutorial.hand.task': 'Dai un’occhiata, poi premi Avanti.',

    'tutorial.play-property.title': 'Gioca una proprietà',
    'tutorial.play-property.body': 'Le proprietà sono le uniche carte che fanno vincere la partita. Trascinane una dalla mano sul tavolo — oppure toccala e scegli un colore, che è il modo di giocare al telefono.',
    'tutorial.play-property.task': 'Gioca una carta proprietà in una serie di colore.',
    'tutorial.play-property.blocked': 'Aspetta i robot — il tutorial riprende quando tocca a te.',

    'tutorial.bank.title': 'Metti del denaro in banca',
    'tutorial.bank.body': 'Le carte denaro e azione possono finire in banca come contanti invece di essere giocate. La banca è ciò con cui paghi affitti e debiti, quindi una banca magra significa cedere proprietà.',
    'tutorial.bank.task': 'Metti in banca una carta denaro o azione.',
    'tutorial.bank.blocked': 'Aspetta che torni il tuo turno.',

    'tutorial.plays.title': 'Tre giocate a turno',
    'tutorial.plays.body': 'Questi segni calano man mano che giochi. Spostare su un altro colore un jolly che è già sul tuo tavolo ne costa uno, quindi pensa alla mossa prima di spendere le tue giocate. Un jolly di qualsiasi colore può passare solo a un colore in cui hai già una proprietà.',

    'tutorial.actions.title': 'Le carte azione mordono',
    'tutorial.actions.body': 'L’affitto fa pagare ogni avversario per un colore che possiedi. Furto Furbo ruba una proprietà, Scambio Forzato ne scambia una, Affare Rotto prende un’intera serie completa. Dì Solo No annulla qualsiasi di queste — se puoi, tienine uno in mano.',

    'tutorial.opponents.title': 'Tieni d’occhio i robot',
    'tutorial.opponents.body': 'Ogni avversario mostra quante carte ha in mano, la sua banca e i progressi delle sue serie. Un robot fermo su due serie complete è a un turno dalla vittoria — chiedigli l’affitto o rompigli la serie.',

    'tutorial.log.title': 'Il registro del tavolo',
    'tutorial.log.body': 'Ogni giocata viene annotata qui. Quando un robot muove e ti sfugge cosa è successo, è qui che devi guardare.',

    'tutorial.end-turn.title': 'Chiudi il turno',
    'tutorial.end-turn.body': 'Quando hai finito le giocate — o semplicemente vuoi fermarti — chiudi il turno. Se hai più di sette carte devi prima scartare fino a sette.',
    'tutorial.end-turn.task': 'Chiudi il turno e lascia giocare i robot.',
    'tutorial.end-turn.blocked': 'Stanno giocando i robot. Guarda il registro.',

    'tutorial.pending.title': 'Qualcuno vuole i tuoi soldi',
    'tutorial.pending.body': 'Quando un avversario ti chiede un pagamento si apre un pannello con quello che devi. Scegli le carte dalla banca e dalle proprietà per coprirlo — non si dà resto — oppure gioca Dì Solo No per annullare tutto.',
    'tutorial.pending.task': 'Rispondi al pannello per andare avanti.',

    'tutorial.done.title': 'Il gioco è tutto qui',
    'tutorial.done.body': 'Tre serie complete e il tavolo è tuo. Allenati contro i robot quanto vuoi — il tutorial è nel menu ⚙ ogni volta che ti serve.',
    'tutorial.done.task': 'Premi Fine e continua a giocare.',
};

export default tutorial;
