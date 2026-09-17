import { useMemo, useState } from 'react';
import type { Card, ClientMessage, Color, GameView, PlayerView, SetView } from '../types';
import { colorMeta, opponents, playableColors, stealableCards, you } from '../game/meta';
import { useI18n } from '../i18n';
import { money } from '../i18n/format';
import Modal from './Modal';
import PlayingCard from './PlayingCard';
import PropertySets from './PropertySets';

interface Props {
    view: GameView;
    /** The card being played. */
    card: Card;
    /** 'property' places a property; 'action' resolves an action or rent card. */
    intent: 'property' | 'action' | 'move';
    onCancel: () => void;
    onConfirm: (msg: ClientMessage) => void;
}

function ColorPicker({ colors, value, onChange, disabledColors, note }: {
    colors: Color[];
    value?: Color;
    onChange: (c: Color) => void;
    disabledColors?: Set<Color>;
    note?: (c: Color) => string | undefined;
}) {
    const { tColor } = useI18n();

    return (
        <div className="flex flex-wrap gap-2">
            {colors.map(c => {
                const m = colorMeta(c);
                const disabled = disabledColors?.has(c);
                return (
                    <button
                        key={c}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(c)}
                        className={[
                            'btn !px-3 !py-1.5 !text-sm',
                            value === c ? 'shadow-[var(--shadow-glow)]' : '',
                            disabled ? 'opacity-35' : '',
                        ].join(' ')}
                        style={{ background: m.hex, color: m.ink }}
                    >
                        {tColor(c)}
                        {note?.(c) && <span className="ml-1 opacity-80">{note(c)}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Choosing a set, by the set rather than by its name. A colour swatch reading
 * "Brown $2M" is the label on a thing the player is already looking at — the
 * cards are right there on the table — so this shows the stack itself and
 * rings the chosen one. The cards inside take no clicks of their own: the
 * whole stack is the choice, and a card that answered separately would put a
 * button inside a button.
 */
function SetPicker({ sets, value, onChange }: {
    sets: SetView[];
    value?: Color;
    onChange: (c: Color) => void;
}) {
    return (
        <div className="set-picker">
            {sets.map(set => (
                <div
                    key={set.color}
                    role="button"
                    tabIndex={0}
                    aria-pressed={value === set.color}
                    className={`set-option ${value === set.color ? 'is-chosen' : ''}`}
                    onClick={() => onChange(set.color)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onChange(set.color);
                        }
                    }}
                >
                    <PropertySets sets={[set]} size="sm" />
                </div>
            ))}
        </div>
    );
}

function PlayerPicker({ players, value, onChange, hint }: {
    players: PlayerView[];
    value?: string;
    onChange: (id: string) => void;
    hint?: (p: PlayerView) => string;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {players.map(p => (
                <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange(p.id)}
                    className={`btn ${value === p.id ? 'btn-gold' : 'btn-ghost'} !text-sm`}
                >
                    {p.name}
                    {hint && <span className="opacity-70">{hint(p)}</span>}
                </button>
            ))}
        </div>
    );
}

export default function ActionDialog({ view, card, intent, onCancel, onConfirm }: Props) {
    const { t, tCard } = useI18n();
    const me = you(view)!;
    const foes = opponents(view);
    const [color, setColor] = useState<Color | undefined>(() => {
        const opts = playableColors(card, view.colors);
        // A rent card prints two colours, but only one is ever a real choice
        // once you only own a set in one of them — the other was never going
        // to charge anything, so there is nothing to ask about.
        if (card.type === 'rent') {
            const owned = opts.filter(c => me.sets.some(s => s.color === c && s.cards.length > 0));
            if (owned.length === 1) return owned[0];
        }
        return opts.length === 1 ? opts[0] : undefined;
    });
    const [targetPlayer, setTargetPlayer] = useState<string | undefined>(foes.length === 1 ? foes[0].id : undefined);
    const [targetCard, setTargetCard] = useState<string>();
    const [giveCard, setGiveCard] = useState<string>();
    const [doubles, setDoubles] = useState<string[]>([]);

    const doubleCards = useMemo(
        () => (me.hand ?? []).filter(c => c.action === 'double_rent'),
        [me.hand],
    );
    const target = foes.find(p => p.id === targetPlayer);

    // ---- Property placement -------------------------------------------------
    if (intent === 'property' || intent === 'move') {
        const isMove = intent === 'move';
        // An "any colour" joker is the one wildcard that may not open a colour:
        // it may only join a colour the player already owns a property in.
        const isAnyColor = card.type === 'property_wildcard'
            && card.colors?.length === 1 && card.colors[0] === 'all';
        // Where the card sits now, so a move never offers the set it came from.
        const currentColor = isMove ? me.sets.find(s => s.cards.some(c => c.id === card.id))?.color : undefined;
        const opts = playableColors(card, view.colors).filter(c => c !== currentColor);
        const owned = new Set(me.sets.filter(s => s.cards.length > 0 && s.color !== currentColor).map(s => s.color));
        const illegal = isMove && isAnyColor ? new Set(opts.filter(c => !owned.has(c))) : undefined;
        // Moving a card that is already on the table now costs a play, so a
        // player with none left may look but not move.
        const noPlays = isMove && view.plays_left === 0;

        return (
            <Modal
                title={t(isMove ? 'dialog.move_wildcard' : 'dialog.place_property')}
                subtitle={t('dialog.pick_set', { card: tCard(card) })}
                onClose={onCancel}
                footer={
                    <>
                        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
                        <button
                            type="button"
                            className="btn btn-green"
                            disabled={!color || noPlays || Boolean(color && illegal?.has(color))}
                            onClick={() => onConfirm({
                                type: isMove ? 'move_wildcard' : 'play_property',
                                card_id: card.id,
                                color,
                            })}
                        >
                            {t(isMove ? 'dialog.move_here' : 'dialog.play_here')}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4 sm:flex-row">
                    <PlayingCard card={card} activeColor={color} />
                    <div className="flex-1">
                        <p className="label-caps mb-2">{t('dialog.color')}</p>
                        <ColorPicker
                            colors={opts}
                            value={color}
                            onChange={setColor}
                            disabledColors={illegal}
                            note={c => {
                                const s = me.sets.find(x => x.color === c);
                                const size = view.set_sizes[c] ?? 3;
                                return `${s?.cards.length ?? 0}/${size}`;
                            }}
                        />
                        <p className="mt-3 text-xs text-white/50">
                            {t('dialog.sets_to_win')}
                            {isMove && ` ${t('dialog.move_costs_play')}`}
                            {isMove && isAnyColor && ` ${t('dialog.move_needs_property')}`}
                        </p>
                        {noPlays && <p className="mt-1 text-xs text-rose-300">{t('dialog.no_plays_left')}</p>}
                    </div>
                </div>
            </Modal>
        );
    }

    // ---- Rent ---------------------------------------------------------------
    if (card.type === 'rent') {
        const opts = playableColors(card, view.colors);
        const owned = new Set(me.sets.filter(s => s.cards.length > 0).map(s => s.color));
        const disabled = new Set(opts.filter(c => !owned.has(c)));
        const isWildRent = card.colors?.length === 1 && card.colors[0] === 'all';
        const set = me.sets.find(s => s.color === color);
        const amount = (set?.rent ?? 0) * 2 ** doubles.length;
        const playsNeeded = 1 + doubles.length;
        const enough = view.plays_left >= playsNeeded;

        return (
            <Modal
                title={t('dialog.charge_rent')}
                subtitle={t(isWildRent ? 'dialog.rent_any' : 'dialog.rent_all')}
                onClose={onCancel}
                footer={
                    <>
                        <span className="mr-auto text-sm text-white/60">
                            {t('dialog.plays_used', { needed: playsNeeded, left: view.plays_left })}
                        </span>
                        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
                        <button
                            type="button"
                            className="btn btn-gold"
                            disabled={!color || amount <= 0 || (isWildRent && !targetPlayer) || !enough}
                            onClick={() => onConfirm({
                                type: 'play_action',
                                card_id: card.id,
                                color,
                                target_player_id: isWildRent ? targetPlayer : undefined,
                                double_card_ids: doubles,
                            })}
                        >
                            {t('dialog.charge', { amount: money(t, amount) })}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <p className="label-caps mb-2">{t('dialog.color_you_own')}</p>
                        <ColorPicker
                            colors={opts}
                            value={color}
                            onChange={setColor}
                            disabledColors={disabled}
                            note={c => {
                                const s = me.sets.find(x => x.color === c);
                                return money(t, s?.rent ?? 0);
                            }}
                        />
                    </div>

                    {isWildRent && (
                        <div>
                            <p className="label-caps mb-2">{t('dialog.target')}</p>
                            <PlayerPicker players={foes} value={targetPlayer} onChange={setTargetPlayer}
                                hint={p => ` · ${money(t, p.asset_total)}`} />
                        </div>
                    )}

                    {doubleCards.length > 0 && (
                        <div>
                            <p className="label-caps mb-2">{t('dialog.double_rent')}</p>
                            <div className="flex gap-2">
                                {doubleCards.map(d => (
                                    <PlayingCard
                                        key={d.id}
                                        card={d}
                                        size="sm"
                                        selected={doubles.includes(d.id)}
                                        pick="take"
                                        onClick={() => setDoubles(cur =>
                                            cur.includes(d.id) ? cur.filter(x => x !== d.id) : [...cur, d.id])}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <p className="text-sm text-white/70">
                        {t('dialog.rent_due')} <span className="font-display text-xl text-brass">{money(t, amount)}</span>
                        {!enough && <span className="ml-2 text-rose-300">{t('dialog.not_enough_plays')}</span>}
                    </p>
                </div>
            </Modal>
        );
    }

    // ---- House / Hotel ------------------------------------------------------
    if (card.action === 'house' || card.action === 'hotel') {
        const buildable = me.sets.filter(s =>
            s.complete && s.color !== 'railroad' && s.color !== 'utility'
            && !s.buildings.some(b => b.action === card.action)
            && (card.action === 'house' || s.buildings.some(b => b.action === 'house')),
        );
        return (
            <Modal
                title={t(card.action === 'house' ? 'dialog.build_house' : 'dialog.build_hotel')}
                subtitle={t(buildable.length ? 'dialog.choose_complete_set' : 'dialog.no_buildable_set')}
                onClose={onCancel}
                footer={
                    <>
                        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
                        <button
                            type="button"
                            className="btn btn-green"
                            disabled={!color}
                            onClick={() => onConfirm({ type: 'play_action', card_id: card.id, color })}
                        >
                            {t('dialog.build')}
                        </button>
                    </>
                }
            >
                {buildable.length
                    ? <SetPicker sets={buildable} value={color} onChange={setColor} />
                    : <p className="text-sm text-white/60">{t('dialog.bank_it_instead')}</p>}
            </Modal>
        );
    }

    // ---- Debt Collector -----------------------------------------------------
    if (card.action === 'debt_collector') {
        return (
            <Modal
                title={t('dialog.debt_collector')}
                subtitle={t('dialog.debt_collector_blurb', { amount: money(t, 5) })}
                onClose={onCancel}
                footer={
                    <>
                        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
                        <button
                            type="button"
                            className="btn btn-gold"
                            disabled={!targetPlayer}
                            onClick={() => onConfirm({ type: 'play_action', card_id: card.id, target_player_id: targetPlayer })}
                        >
                            {t('dialog.collect', { amount: money(t, 5) })}
                        </button>
                    </>
                }
            >
                <PlayerPicker players={foes} value={targetPlayer} onChange={setTargetPlayer}
                    hint={p => t('dialog.in_play', { amount: money(t, p.asset_total) })} />
            </Modal>
        );
    }

    // ---- Deal Breaker -------------------------------------------------------
    if (card.action === 'deal_breaker') {
        const completeSets = target?.sets.filter(s => s.complete) ?? [];
        return (
            <Modal
                title={t('dialog.deal_breaker')}
                subtitle={t('dialog.deal_breaker_blurb')}
                onClose={onCancel}
                wide
                footer={
                    <>
                        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
                        <button
                            type="button"
                            className="btn btn-red"
                            disabled={!targetPlayer || !color}
                            onClick={() => onConfirm({
                                type: 'play_action', card_id: card.id, target_player_id: targetPlayer, color,
                            })}
                        >
                            {t('dialog.take_the_set')}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <p className="label-caps mb-2">{t('dialog.victim')}</p>
                        <PlayerPicker
                            players={foes}
                            value={targetPlayer}
                            onChange={id => { setTargetPlayer(id); setColor(undefined); }}
                            hint={p => t('dialog.full_sets', { count: p.complete_sets })}
                        />
                    </div>
                    {target && (
                        <div>
                            <p className="label-caps mb-2">{t('dialog.set_to_steal')}</p>
                            {completeSets.length
                                ? <SetPicker sets={completeSets} value={color} onChange={setColor} />
                                : <p className="text-sm text-white/60">{t('dialog.no_complete_set', { name: target.name })}</p>}
                        </div>
                    )}
                </div>
            </Modal>
        );
    }

    // ---- Sly Deal / Forced Deal --------------------------------------------
    if (card.action === 'sly_deal' || card.action === 'forced_deal') {
        const isSwap = card.action === 'forced_deal';
        const theirs = target ? stealableCards(target) : [];
        const mine = stealableCards(me);
        const theirIds = new Set(theirs.map(x => x.card.id));
        const myIds = new Set(mine.map(x => x.card.id));
        const takenCard = theirs.find(x => x.card.id === targetCard)?.card;
        const givenCard = mine.find(x => x.card.id === giveCard)?.card;

        return (
            <Modal
                title={t(isSwap ? 'dialog.forced_deal' : 'dialog.sly_deal')}
                subtitle={t(isSwap ? 'dialog.forced_deal_blurb' : 'dialog.sly_deal_blurb')}
                onClose={onCancel}
                wide
                footer={
                    <>
                        <button type="button" className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
                        <button
                            type="button"
                            className="btn btn-red"
                            disabled={!targetPlayer || !targetCard || (isSwap && !giveCard)}
                            onClick={() => onConfirm({
                                type: 'play_action',
                                card_id: card.id,
                                target_player_id: targetPlayer,
                                target_card_id: targetCard,
                                give_card_id: isSwap ? giveCard : undefined,
                            })}
                        >
                            {t(isSwap ? 'dialog.offer_swap' : 'dialog.steal_it')}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <p className="label-caps mb-2">{t('dialog.victim')}</p>
                        <PlayerPicker
                            players={foes}
                            value={targetPlayer}
                            onChange={id => { setTargetPlayer(id); setTargetCard(undefined); }}
                        />
                    </div>

                    {target && (
                        <div>
                            <p className="label-caps mb-2">{t('dialog.their_properties', { name: target.name })}</p>
                            {theirs.length
                                ? <PropertySets
                                    sets={target.sets}
                                    onCardClick={c => setTargetCard(c.id)}
                                    enabledIds={theirIds}
                                    selectedIds={targetCard ? new Set([targetCard]) : undefined}
                                    pickTone="take"
                                />
                                : <p className="text-sm text-white/60">{t('dialog.nothing_stealable')}</p>}
                            <p className="pick-line pick-line-take">
                                {takenCard
                                    ? t('dialog.chosen_take', { card: tCard(takenCard) })
                                    : t('dialog.chosen_take_none')}
                            </p>
                        </div>
                    )}

                    {isSwap && (
                        <div>
                            <p className="label-caps mb-2">{t('dialog.your_give')}</p>
                            {mine.length
                                ? <PropertySets
                                    sets={me.sets}
                                    onCardClick={c => setGiveCard(c.id)}
                                    enabledIds={myIds}
                                    selectedIds={giveCard ? new Set([giveCard]) : undefined}
                                    pickTone="give"
                                />
                                : <p className="text-sm text-white/60">{t('dialog.nothing_to_give')}</p>}
                            <p className="pick-line pick-line-give">
                                {givenCard
                                    ? t('dialog.chosen_give', { card: tCard(givenCard) })
                                    : t('dialog.chosen_give_none')}
                            </p>
                        </div>
                    )}
                </div>
            </Modal>
        );
    }

    return (
        <Modal title={tCard(card)} onClose={onCancel}>
            <p className="text-sm text-white/70">{t('dialog.no_choices')}</p>
        </Modal>
    );
}
