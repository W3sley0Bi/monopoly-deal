import { useMemo, useState } from 'react';
import type { ClientMessage, GameView } from '../types';
import { ACTION_ICON, assets, myTarget } from '../game/meta';
import { useI18n } from '../i18n';
import type { I18n } from '../i18n';
import { money } from '../i18n/format';
import Modal from './Modal';
import PlayingCard from './PlayingCard';
import PropertySets from './PropertySets';
import TurnTimer from './TurnTimer';

interface Props {
    view: GameView;
    /** Server clock minus browser clock, in ms. */
    skewMs: number;
    send: (msg: ClientMessage) => void;
}

/** Describes what a pending action will do to its target. */
function describe(view: GameView, i18n: I18n): string {
    const { t, tCard, tColor } = i18n;
    const pd = view.pending!;
    const by = view.players.find(p => p.id === pd.by_id)?.name ?? t('pending.ui.someone');
    const victim = view.players.find(p => p.id === pd.target_player_id)?.name ?? t('pending.ui.them');
    const color = pd.target_color ? tColor(pd.target_color) : '';
    switch (pd.kind) {
        case 'deal_breaker':
            return t('pending.ui.deal_breaker', { by, victim, color });
        case 'sly_deal':
            return t('pending.ui.sly_deal', { by, victim, color });
        case 'forced_deal':
            return t('pending.ui.forced_deal', { by, victim, color });
        default:
            return t('pending.ui.played', { by, card: tCard(pd.card) });
    }
}

export default function PendingPanel({ view, skewMs, send }: Props) {
    const i18n = useI18n();
    const { t, tColor } = i18n;
    const pd = view.pending!;
    const me = view.players.find(p => p.id === view.you);
    const mine = myTarget(view);
    const iAmInstigator = mine !== undefined && pd.by_id === view.you;
    const [picked, setPicked] = useState<Set<string>>(new Set());

    // `assets()` labels the source in English; its `fromColor` is the raw colour,
    // so the pile is named in the payer's own language here.
    const myAssets = useMemo(
        () => (me ? assets(me) : []).map(a => ({
            card: a.card,
            from: a.fromColor ? tColor(a.fromColor) : t('pending.ui.from_bank'),
        })),
        [me, t, tColor],
    );

    const selectedTotal = useMemo(
        () => myAssets.filter(a => picked.has(a.card.id)).reduce((s, a) => s + a.card.value, 0),
        [myAssets, picked],
    );

    const toggle = (id: string) => setPicked(cur => {
        const next = new Set(cur);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    // The countdown belongs in the dialog: the top bar is behind the overlay,
    // and this is the player the clock is running against.
    const countdown = view.deadline_ms > 0 && view.deadline_kind === 'respond' ? (
        <TurnTimer
            deadlineMs={view.deadline_ms}
            totalSeconds={view.deadline_seconds}
            skewMs={skewMs}
            kind="respond"
            size={52}
        />
    ) : null;

    // The card that was played and the cards you are being asked to hand over
    // sat in one undifferentiated row, so it was not obvious which was which.
    // The action now stands alone, named, and takes a side: a card aimed at
    // you is a red threat over the table, and one you played is your own
    // green move, resting at your edge of it.
    const byMe = pd.by_id === view.you;
    const actionCard = (
        <div className="pending-action">
            <PlayingCard card={pd.card} size="sm" />
            <span className="pending-action-tag">
                {t(byMe ? 'pending.ui.your_play' : 'pending.ui.action_card')}
            </span>
        </div>
    );
    const header = (
        <div className={`pending-header ${byMe ? 'is-mine' : 'is-against'}`}>
            {!byMe && actionCard}
            <p className="pending-action-title">
                {(pd.action && ACTION_ICON[pd.action]) || '💸'} {t(pd.label_key, pd.label_args)}
            </p>
            <p className="pending-action-note">{describe(view, i18n)}</p>
            {byMe && actionCard}
        </div>
    );

    // What the answer is actually about. The panel named the action and said
    // in a sentence what it would do, which leaves the player to find the card
    // on the table behind the dialog and work out whether they mind. A steal
    // is about one card, a swap about two, a Deal Breaker about a whole set —
    // so the panel shows them, ringed the way a chosen card is: amber for what
    // leaves your table, green for what arrives on it.
    const instigator = view.players.find(p => p.id === pd.by_id);
    const findCard = (id?: string) =>
        id ? assets(me!).find(a => a.card.id === id)?.card : undefined;
    const losingCard = me && pd.kind !== 'payment' ? findCard(pd.target_card_id) : undefined;
    const gainingCard = instigator && pd.give_card_id
        ? assets(instigator).find(a => a.card.id === pd.give_card_id)?.card
        : undefined;
    const losingSet = me && pd.kind === 'deal_breaker' && pd.target_color
        ? me.sets.find(x => x.color === pd.target_color)
        : undefined;
    const stakes = (losingCard || gainingCard || losingSet) ? (
        <div className="pending-stakes">
            {losingSet && (
                <div className="stake">
                    <p className="stake-label stake-label-give">{t('pending.ui.stake_lose_set')}</p>
                    <div className="stake-cards stake-give"><PropertySets sets={[losingSet]} size="sm" /></div>
                </div>
            )}
            {losingCard && !losingSet && (
                <div className="stake">
                    <p className="stake-label stake-label-give">{t('pending.ui.stake_lose')}</p>
                    <div className="stake-cards">
                        <PlayingCard card={losingCard} size="sm" selected pick="give" />
                    </div>
                </div>
            )}
            {gainingCard && (
                <div className="stake">
                    <p className="stake-label stake-label-take">{t('pending.ui.stake_gain')}</p>
                    <div className="stake-cards">
                        <PlayingCard card={gainingCard} size="sm" selected pick="take" />
                    </div>
                </div>
            )}
        </div>
    ) : null;

    // Nothing for this client to do — show who everyone is waiting on.
    if (!mine) {
        const waitingOn = pd.targets
            .filter(x => !x.settled)
            .map(x => view.players.find(p => p.id === x.responder)?.name ?? '?');
        return (
            <Modal
                title={t('pending.ui.in_progress')}
                subtitle={waitingOn.length
                    ? t('pending.ui.waiting_on', { names: waitingOn.join(', ') })
                    : t('pending.ui.resolving')}
                corner={countdown}
            >
                {header}
                <ul className="mt-4 flex flex-col gap-1 text-sm">
                    {pd.targets.map(x => {
                        const p = view.players.find(y => y.id === x.player_id);
                        return (
                            <li key={x.player_id} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-1.5">
                                <span>{p?.name}</span>
                                <span className={x.settled ? 'text-white/45' : 'text-brass'}>
                                    {x.settled
                                        ? (x.cancelled ? t('pending.ui.blocked_it') : (x.note ?? t('pending.ui.settled')))
                                        : x.cancelled
                                            ? t('pending.ui.said_no')
                                            : (pd.kind === 'payment'
                                                ? t('pending.ui.owes', { amount: money(t, x.amount) })
                                                : t('pending.ui.deciding'))}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </Modal>
        );
    }

    // The instigator was blocked and may counter with their own Just Say No.
    if (iAmInstigator) {
        return (
            <Modal
                title={t('pending.ui.you_blocked')}
                subtitle={t('pending.ui.you_blocked_blurb')}
                corner={countdown}
                footer={
                    <>
                        <button type="button" className="btn btn-ghost" onClick={() => send({ type: 'respond', player_id: view.you })}>
                            {t('pending.ui.let_it_go')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-red"
                            disabled={!me?.has_just_say_no}
                            onClick={() => send({ type: 'respond', player_id: view.you, say_no: true })}
                        >
                            {t('pending.ui.just_say_no')}
                        </button>
                    </>
                }
            >
                {header}
            </Modal>
        );
    }

    // A steal or swap aimed at this player.
    if (pd.kind !== 'payment') {
        return (
            <Modal
                title={t('pending.ui.you_target')}
                subtitle={t('pending.ui.you_target_blurb')}
                corner={countdown}
                footer={
                    <>
                        <button type="button" className="btn btn-ghost" onClick={() => send({ type: 'respond', player_id: view.you })}>
                            {t('pending.ui.allow_it')}
                        </button>
                        <button
                            type="button"
                            className="btn btn-red"
                            disabled={!me?.has_just_say_no}
                            onClick={() => send({ type: 'respond', player_id: view.you, say_no: true })}
                        >
                            {t('pending.ui.just_say_no')}
                        </button>
                    </>
                }
            >
                {header}
                {stakes}
            </Modal>
        );
    }

    // A debt aimed at this player.
    const owed = mine.amount;
    const total = me?.asset_total ?? 0;
    const mustGiveAll = total <= owed;
    const canPay = selectedTotal >= owed || (mustGiveAll && selectedTotal === total);

    return (
        <Modal
            title={t('pending.ui.you_owe', { amount: money(t, owed) })}
            subtitle={mustGiveAll
                ? t('pending.ui.give_everything', { amount: money(t, total) })
                : t('pending.ui.pick_cards')}
            corner={countdown}
            wide
            footer={
                <>
                    <span className="mr-auto flex flex-col text-sm">
                        <span>
                            {t('pending.ui.selected', {
                                selected: money(t, selectedTotal),
                                owed: money(t, owed),
                            })}
                        </span>
                        {countdown && (
                            <span className="text-xs text-white/50">
                                {t('pending.ui.auto_pay')}
                            </span>
                        )}
                    </span>
                    <button
                        type="button"
                        className="btn btn-red"
                        disabled={!me?.has_just_say_no}
                        onClick={() => send({ type: 'respond', player_id: view.you, say_no: true })}
                    >
                        {t('pending.ui.just_say_no')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-green"
                        disabled={!canPay}
                        onClick={() => send({ type: 'respond', player_id: view.you, card_ids: [...picked] })}
                    >
                        {t('pending.ui.pay', { amount: money(t, selectedTotal) })}
                    </button>
                </>
            }
        >
            {header}
            {myAssets.length === 0 ? (
                <p className="mt-4 text-sm text-white/60">{t('pending.ui.nothing_in_play')}</p>
            ) : (
                <section className="pending-mine">
                    <p className="pending-mine-head">
                        <span className="label-caps">{t('pending.ui.your_cards')}</span>
                        <span>{t('pending.ui.selected', {
                            selected: money(t, selectedTotal),
                            owed: money(t, owed),
                        })}</span>
                    </p>
                    <div className="pending-mine-cards">
                        {myAssets.map(({ card, from }) => (
                            <div
                                key={card.id}
                                className={`pending-pick ${picked.has(card.id) ? 'is-picked' : ''}`}
                            >
                                <PlayingCard
                                    card={card}
                                    size="sm"
                                    selected={picked.has(card.id)}
                                    onClick={() => toggle(card.id)}
                                />
                                <span>{from}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </Modal>
    );
}
