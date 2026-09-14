import type { Catalog } from '../types';

/** The guided tour: one title/body (and sometimes a task) per step, plus the
 *  chrome around the card. Step keys mirror the step ids in Tutorial.tsx so a
 *  translator can follow the tour in order. */
const tutorial: Catalog = {
    'tutorial.label': 'Tutorial',
    'tutorial.progress': 'Tutorial {current}/{total}',
    'tutorial.skipTour': 'Tour überspringen',
    'tutorial.skipStep': 'Schritt überspringen',
    'tutorial.finish': 'Fertig',
    'tutorial.taskDone': '✓ Erledigt',
    'tutorial.waiting': 'Warte…',

    'tutorial.welcome.title': 'Willkommen am Übungstisch',
    'tutorial.welcome.body': 'Du spielst gegen zwei Roboter. Hier läuft keine Uhr und niemand wartet, du kannst dir also so viel Zeit lassen, wie du willst. Diese Tour führt dich durch eine ganze Runde.',
    'tutorial.welcome.task': 'Drück auf Weiter, um loszulegen.',

    'tutorial.goal.title': 'So gewinnst du',
    'tutorial.goal.body': 'Sammle drei vollständige Farbsätze. Ein Satz ist bei seiner echten Größe vollständig: zwei Karten bei Braun und Blau, drei bei den meisten Farben, vier bei den Bahnhöfen.',

    'tutorial.hand.title': 'Deine Hand',
    'tutorial.hand.body': 'Jede Runde ziehst du zwei Karten (fünf, wenn deine Hand leer ist) und hast bis zu drei Züge. Immobilien-, Geld-, Aktions- und Mietkarten liegen hier alle zusammen.',
    'tutorial.hand.task': 'Schau sie dir an und drück dann auf Weiter.',

    'tutorial.play-property.title': 'Spiel eine Immobilie aus',
    'tutorial.play-property.body': 'Nur Immobilien gewinnen das Spiel. Zieh eine aus deiner Hand auf die Matte oder tipp sie an und wähl eine Farbe.',
    'tutorial.play-property.task': 'Spiel eine Immobilienkarte in einen Farbsatz.',
    'tutorial.play-property.blocked': 'Warte auf die Roboter — die Tour geht weiter, wenn du dran bist.',

    'tutorial.bank.title': 'Bring Geld in die Bank',
    'tutorial.bank.body': 'Geld- und Aktionskarten kannst du statt auszuspielen als Bargeld in die Bank legen. Aus deiner Bank zahlst du Miete und Schulden — ist sie dünn, musst du Immobilien hergeben.',
    'tutorial.bank.task': 'Leg eine Geld- oder Aktionskarte in die Bank.',
    'tutorial.bank.blocked': 'Warte, bis du wieder dran bist.',

    'tutorial.plays.title': 'Drei Züge pro Runde',
    'tutorial.plays.body': 'Diese Punkte zählen herunter, während du spielst. Einen Joker, der schon auf deinem Tisch liegt, auf eine andere Farbe zu bewegen, kostet einen davon — plan den Umzug also, bevor du deine Züge ausgibst. Ein Joker für beliebige Farben darf nur auf eine Farbe ziehen, in der du schon eine Immobilie hast.',

    'tutorial.actions.title': 'Aktionskarten haben Zähne',
    'tutorial.actions.body': 'Miete kassiert bei jedem Gegner für eine Farbe, die du besitzt. Trickbetrug stiehlt eine Immobilie, Zwangstausch tauscht eine, Geschäftsbruch nimmt einen ganzen fertigen Satz. Sag einfach Nein bricht jede davon ab — behalt eine auf der Hand, wenn du kannst.',

    'tutorial.opponents.title': 'Behalt die Roboter im Blick',
    'tutorial.opponents.body': 'Bei jedem Gegner siehst du die Zahl der Handkarten, die Bank und den Fortschritt bei den Sätzen. Ein Roboter mit zwei vollständigen Sätzen ist eine Runde vom Sieg entfernt — kassier Miete bei ihm oder brich den Satz auf.',

    'tutorial.log.title': 'Das Tischlog',
    'tutorial.log.body': 'Jeder Zug wird hier festgehalten. Wenn ein Roboter spielt und du etwas verpasst hast, schau hier nach.',

    'tutorial.end-turn.title': 'Beende deine Runde',
    'tutorial.end-turn.body': 'Wenn deine Züge weg sind — oder du einfach aufhören willst — beende die Runde. Hältst du mehr als sieben Karten, musst du vorher auf sieben ablegen.',
    'tutorial.end-turn.task': 'Beende deine Runde und lass die Roboter spielen.',
    'tutorial.end-turn.blocked': 'Die Roboter spielen. Schau ins Log.',

    'tutorial.pending.title': 'Jemand will dein Geld',
    'tutorial.pending.body': 'Wenn ein Gegner bei dir kassiert, öffnet sich ein Feld mit deiner Schuld. Wähl Karten aus deiner Bank und deinen Immobilien, um sie zu decken — Wechselgeld gibt es nicht — oder spiel Sag einfach Nein und brich die ganze Sache ab.',
    'tutorial.pending.task': 'Antworte im Feld, um weiterzumachen.',

    'tutorial.done.title': 'Das ist das ganze Spiel',
    'tutorial.done.body': 'Drei vollständige Sätze und der Tisch gehört dir. Üb gegen die Roboter, so lange du magst — die Tour findest du jederzeit wieder im ⚙ Menü.',
    'tutorial.done.task': 'Drück auf Fertig und spiel weiter.',
};

export default tutorial;
