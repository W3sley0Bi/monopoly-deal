import { useMemo, useState } from 'react';
import type { ClientMessage, GameView } from '../types';
import { ACTION_ICON, assets, myTarget } from '../game/meta';
import { useI18n } from '../i18n';
import type { I18n } from '../i18n';
import { money } from '../i18n/format';
import Modal from './Modal';
import PlayingCard from './PlayingCard';
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

    const header = (
        <div className="flex items-center gap-3">
            <PlayingCard card={pd.card} size="sm" />
            <div>
                <p className="font-display text-xl tracking-wide text-brass">
                    {(pd.action && ACTION_ICON[pd.action]) || '💸'} {t(pd.label_key, pd.label_args)}
                </p>
                <p className="text-sm text-white/70">{describe(view, i18n)}</p>
            </div>
        </div>
    );

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
                <div className="mt-4 flex flex-wrap gap-2">
                    {myAssets.map(({ card, from }) => (
                        <div key={card.id} className="flex flex-col items-center gap-1">
                            <PlayingCard
                                card={card}
                                size="sm"
                                selected={picked.has(card.id)}
                                onClick={() => toggle(card.id)}
                            />
                            <span className="text-[0.6rem] uppercase tracking-wide text-white/45">{from}</span>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}
