import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActionDialogProps } from '../../../lib/contracts';
import type { Card as CardT, Color, PlayerView } from '../../types';
import { brand, ink, line, radius, status } from '../../../lib/theme';
import { colorMeta, opponents, playableColors, stealableCards, you as youOf } from '../../game/meta';
import { Btn, LabelCaps, Modal } from '../../ui/kit';
import { Card } from '../../ui/card';
import { PropertySets } from '../board';
import { useI18n } from '../../i18n';
import { uiFont } from '../../../lib/fonts';

/** Rent owed for `color` on the player's own board, straight off the server's
 *  precomputed `SetView.rent` — never recomputed here. */
function rentFor(me: PlayerView | undefined, color: Color): number {
    return me?.sets.find((s) => s.color === color)?.rent ?? 0;
}

export function ActionDialog({
    open,
    intent,
    card,
    fromColor,
    game,
    you,
    onClose,
    onSubmit,
}: ActionDialogProps) {
    const { t, tCard, tColor } = useI18n();
    const me = youOf(game);
    const rivals = opponents(game);

    const [color, setColor] = useState<Color | null>(null);
    const [targetId, setTargetId] = useState<string | null>(rivals.length === 1 ? rivals[0].id : null);
    const [takeCardId, setTakeCardId] = useState<string | null>(null);
    const [giveCardId, setGiveCardId] = useState<string | null>(null);
    const [doubles, setDoubles] = useState<string[]>([]);

    // Re-opening on a different card must not inherit the last card's answers.
    useEffect(() => {
        setColor(null);
        setTakeCardId(null);
        setGiveCardId(null);
        setDoubles([]);
        setTargetId(rivals.length === 1 ? rivals[0].id : null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [card.id, intent]);

    // Choosing a different victim invalidates whatever was picked off the old one.
    useEffect(() => {
        setTakeCardId(null);
        if (action === 'deal_breaker') setColor(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetId]);

    const action = card.action;
    const isRent = card.type === 'rent';
    const victim = rivals.find((p) => p.id === targetId);

    const takeCard = useMemo(() => {
        if (!takeCardId || !victim) return null;
        for (const s of victim.sets) {
            const c = s.cards.find((x) => x.id === takeCardId);
            if (c) return { card: c, set: s };
        }
        return null;
    }, [takeCardId, victim]);

    const giveCard = useMemo(() => {
        if (!giveCardId || !me) return null;
        for (const s of me.sets) {
            const c = s.cards.find((x) => x.id === giveCardId);
            if (c) return { card: c, set: s };
        }
        return null;
    }, [giveCardId, me]);

    const completeSets = useMemo(() => {
        return (victim?.sets ?? []).filter((s) => s.complete);
    }, [victim]);

    const selectedCompleteSet = useMemo(() => {
        return completeSets.find((s) => s.color === color);
    }, [completeSets, color]);

    const doubleCards = useMemo(
        () => (me?.hand ?? []).filter((c) => c.action === 'double_rent'),
        [me?.hand],
    );

    // Each Double The Rent doubles the bill and costs one extra play.
    const multiplier = 1 << doubles.length;
    const playsNeeded = 1 + doubles.length;
    const rentAmount = color ? rentFor(me, color) * multiplier : 0;

    const colorChoices: Color[] = useMemo(() => {
        if (intent === 'property') return playableColors(card, game.colors);
        if (intent === 'move') return playableColors(card, game.colors).filter((c) => c !== fromColor);
        if (isRent) return (card.colors ?? []).filter((c) => c !== 'all').length
            ? (card.colors ?? []).filter((c) => c !== 'all')
            : game.colors;
        if (action === 'house' || action === 'hotel') {
            return (me?.sets ?? [])
                .filter(
                    (s) =>
                        s.complete &&
                        s.color !== 'railroad' &&
                        s.color !== 'utility' &&
                        (action === 'house'
                            ? !s.buildings.some((b) => b.action === 'house')
                            : s.buildings.some((b) => b.action === 'house') &&
                              !s.buildings.some((b) => b.action === 'hotel')),
                )
                .map((s) => s.color);
        }
        if (action === 'deal_breaker') return (victim?.sets ?? []).filter((s) => s.complete).map((s) => s.color);
        return [];
    }, [intent, card, game.colors, fromColor, isRent, action, me?.sets, victim]);

    const title =
        intent === 'property'
            ? t('dialog.place_property')
            : intent === 'move'
              ? t('dialog.move_wildcard')
              : isRent
                ? t('dialog.charge_rent')
                : action === 'house'
                  ? t('dialog.build_house')
                  : action === 'hotel'
                    ? t('dialog.build_hotel')
                    : action === 'debt_collector'
                      ? t('dialog.debt_collector')
                      : action === 'deal_breaker'
                        ? t('dialog.deal_breaker')
                        : action === 'sly_deal'
                          ? t('dialog.sly_deal')
                          : action === 'forced_deal'
                            ? t('dialog.forced_deal')
                            : tCard(card);

    const needsVictim =
        action === 'debt_collector' ||
        action === 'deal_breaker' ||
        action === 'sly_deal' ||
        action === 'forced_deal' ||
        (isRent && (card.colors ?? []).includes('all'));

    const needsTakeCard = action === 'sly_deal' || action === 'forced_deal';
    const needsGiveCard = action === 'forced_deal';

    let confirmLabel = t('dialog.play_here');
    if (intent === 'move') confirmLabel = t('dialog.move_here');
    else if (isRent) confirmLabel = t('dialog.charge', { amount: rentAmount });
    else if (action === 'house' || action === 'hotel') confirmLabel = t('dialog.build');
    else if (action === 'debt_collector') confirmLabel = t('dialog.collect', { amount: 5 });
    else if (action === 'deal_breaker') confirmLabel = t('dialog.take_the_set');
    else if (action === 'sly_deal') confirmLabel = t('dialog.steal_it');
    else if (action === 'forced_deal') confirmLabel = t('dialog.offer_swap');

    const notEnoughPlays = isRent && playsNeeded > game.plays_left;
    const movingWithNoPlays = intent === 'move' && game.plays_left <= 0;

    const ready =
        (colorChoices.length === 0 || !!color) &&
        (!needsVictim || !!targetId) &&
        (!needsTakeCard || !!takeCardId) &&
        (!needsGiveCard || !!giveCardId) &&
        (!isRent || rentAmount > 0) &&
        !notEnoughPlays &&
        !movingWithNoPlays;

    function submit() {
        if (intent === 'property' && color) {
            onSubmit({ type: 'play_property', card_id: card.id, color });
        } else if (intent === 'move' && color) {
            onSubmit({ type: 'move_wildcard', card_id: card.id, color });
        } else {
            onSubmit({
                type: 'play_action',
                card_id: card.id,
                ...(color ? { color } : {}),
                ...(targetId ? { target_player_id: targetId } : {}),
                ...(takeCardId ? { target_card_id: takeCardId } : {}),
                ...(giveCardId ? { give_card_id: giveCardId } : {}),
                ...(doubles.length ? { double_card_ids: doubles } : {}),
            });
        }
    }

    const noChoices =
        colorChoices.length === 0 && !needsVictim && intent === 'action' && !isRent;

    return (
        <Modal open={open} onClose={onClose} title={title} wide={needsTakeCard || action === 'deal_breaker'}>
            <View style={styles.cardRow}>
                <Card card={card} size="sm" activeColor={color} />
                <Text style={styles.blurb}>{tCard(card)}</Text>
            </View>

            {noChoices ? <Text style={styles.warn}>{t('dialog.no_choices')}</Text> : null}

            {/* ---- victim ---- */}
            {needsVictim ? (
                <>
                    <LabelCaps>{t('dialog.victim')}</LabelCaps>
                    <View style={styles.row}>
                        {rivals.map((p) => {
                            const fullSetCount = p.complete_sets ?? p.sets.filter((s) => s.complete).length;
                            return (
                                <Pressable
                                    key={p.id}
                                    onPress={() => setTargetId(p.id)}
                                    style={[styles.chip, targetId === p.id && styles.chipOn]}
                                >
                                    <Text style={[styles.chipText, targetId === p.id && styles.chipTextOn]}>
                                        {p.name}
                                    </Text>
                                    <Text style={styles.chipHint}>
                                        {t('dialog.in_play', { amount: p.asset_total })}
                                        {action === 'deal_breaker' && fullSetCount > 0
                                            ? fullSetCount === 1
                                                ? t('dialog.full_sets.one', { count: 1 })
                                                : t('dialog.full_sets.other', { count: fullSetCount })
                                            : null}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </>
            ) : null}

            {/* ---- Deal Breaker: complete set inspector ---- */}
            {action === 'deal_breaker' ? (
                victim ? (
                    completeSets.length ? (
                        <>
                            <LabelCaps>{t('dialog.set_to_steal')}</LabelCaps>
                            <View style={styles.completeSetGrid}>
                                {completeSets.map((s) => {
                                    const cm = colorMeta(s.color);
                                    const isSelected = color === s.color;
                                    return (
                                        <Pressable
                                            key={s.color}
                                            accessibilityRole="button"
                                            testID={`complete-set-${s.color}`}
                                            onPress={() => setColor(s.color)}
                                            style={[
                                                styles.completeSetCard,
                                                isSelected && styles.completeSetCardSelected,
                                            ]}
                                        >
                                            <View style={styles.completeSetHeader}>
                                                <View style={[styles.swatchDot, { backgroundColor: cm.hex }]} />
                                                <Text style={[styles.completeSetTitle, isSelected && styles.completeSetTitleSelected]}>
                                                    {tColor(s.color).toUpperCase()}
                                                </Text>
                                                <Text style={styles.completeSetRent}>
                                                    ${s.rent}M
                                                </Text>
                                                {s.buildings.length ? (
                                                    <View style={styles.buildingBadgeRow}>
                                                        {s.buildings.map((b) => (
                                                            <Text key={b.id} style={styles.buildingIcon}>
                                                                {b.action === 'hotel' ? '▥' : '⌂'}
                                                            </Text>
                                                        ))}
                                                    </View>
                                                ) : null}
                                            </View>
                                            <View style={styles.completeSetCardsRow}>
                                                {s.cards.map((c, i) => (
                                                    <View key={c.id} style={i > 0 ? styles.setCardOverlap : undefined}>
                                                        <Card card={c} size="dense" activeColor={s.color} />
                                                    </View>
                                                ))}
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                            {selectedCompleteSet ? (
                                <Text style={styles.selectedSetSummary}>
                                    {t('dialog.chosen_take', {
                                        card: `${tColor(selectedCompleteSet.color)} (${selectedCompleteSet.cards.length} ${selectedCompleteSet.cards.length === 1 ? 'card' : 'cards'}${selectedCompleteSet.buildings.length ? ` + ${selectedCompleteSet.buildings.length} bldg` : ''} · $${selectedCompleteSet.rent}M rent)`,
                                    })}
                                </Text>
                            ) : null}
                        </>
                    ) : (
                        <Text style={styles.warn}>{t('dialog.no_complete_set', { name: victim.name })}</Text>
                    )
                ) : null
            ) : null}

            {/* ---- colour / set (for other actions) ---- */}
            {action !== 'deal_breaker' && colorChoices.length ? (
                <>
                    <LabelCaps>{t('dialog.color')}</LabelCaps>
                    <View style={styles.row}>
                        {colorChoices.map((c) => {
                            const cm = colorMeta(c);
                            const owned = me?.sets.find((s) => s.color === c);
                            const rent = isRent ? rentFor(me, c) : 0;
                            const dead = isRent && rent === 0;
                            return (
                                <Pressable
                                    key={c}
                                    disabled={dead}
                                    onPress={() => setColor(c)}
                                    style={[styles.swatch, color === c && styles.swatchOn, dead && styles.dim]}
                                >
                                    <View style={[styles.swatchDot, { backgroundColor: cm.hex }]} />
                                    <Text style={[styles.chipText, color === c && styles.chipTextOn]}>
                                        {tColor(c)}
                                    </Text>
                                    {isRent ? (
                                        <Text style={styles.chipHint}>${rent}M</Text>
                                    ) : owned ? (
                                        <Text style={styles.chipHint}>
                                            {owned.cards.length}/{owned.size}
                                        </Text>
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                </>
            ) : action === 'house' || action === 'hotel' ? (
                <Text style={styles.warn}>{t('dialog.no_buildable_set')}</Text>
            ) : null}

            {/* ---- Forced Deal: two-way trade exchange banner ---- */}
            {action === 'forced_deal' ? (
                <View style={styles.tradePreviewBox}>
                    <LabelCaps>{t('dialog.trade_preview')}</LabelCaps>
                    <View style={styles.tradeRow}>
                        {/* YOU GIVE */}
                        <View style={[styles.tradeColumn, styles.tradeColumnGive]}>
                            <Text style={styles.tradeRoleGive}>{t('dialog.you_give').toUpperCase()}</Text>
                            {giveCard ? (
                                <View style={styles.tradeCardRow}>
                                    <Card card={giveCard.card} size="xs" activeColor={giveCard.set.color} pickTone="give" selected />
                                    <View style={styles.tradeCardInfo}>
                                        <Text style={styles.tradeCardName} numberOfLines={1}>
                                            {tCard(giveCard.card)}
                                        </Text>
                                        <Text style={styles.tradeCardDetail}>
                                            {tColor(giveCard.set.color)} · ${giveCard.card.value}M
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.tradePlaceholder}>
                                    <Text style={styles.tradePlaceholderText}>{t('dialog.chosen_give_none')}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.swapIconContainer}>
                            <Text style={styles.swapArrow}>⇄</Text>
                        </View>

                        {/* YOU RECEIVE */}
                        <View style={[styles.tradeColumn, styles.tradeColumnTake]}>
                            <Text style={styles.tradeRoleTake}>{t('dialog.you_get').toUpperCase()}</Text>
                            {takeCard ? (
                                <View style={styles.tradeCardRow}>
                                    <Card card={takeCard.card} size="xs" activeColor={takeCard.set.color} pickTone="take" selected />
                                    <View style={styles.tradeCardInfo}>
                                        <Text style={styles.tradeCardName} numberOfLines={1}>
                                            {tCard(takeCard.card)}
                                        </Text>
                                        <Text style={styles.tradeCardDetail}>
                                            {tColor(takeCard.set.color)} · ${takeCard.card.value}M
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.tradePlaceholder}>
                                    <Text style={styles.tradePlaceholderText}>{t('dialog.chosen_take_none')}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            ) : null}

            {/* ---- Sly Deal: selected property preview ---- */}
            {action === 'sly_deal' && victim ? (
                <View style={styles.targetPreviewBox}>
                    <LabelCaps>{t('pending.ui.targeted_property')}</LabelCaps>
                    {takeCard ? (
                        <View style={styles.targetCardRow}>
                            <Card card={takeCard.card} size="xs" activeColor={takeCard.set.color} pickTone="take" selected />
                            <View style={styles.targetCardDetails}>
                                <Text style={styles.targetCardName}>{tCard(takeCard.card)}</Text>
                                <Text style={styles.targetCardSubtitle}>
                                    {tColor(takeCard.set.color)} · ${takeCard.card.value}M
                                </Text>
                                {(() => {
                                    const owned = me?.sets.find((s) => s.color === takeCard.set.color);
                                    if (owned) {
                                        const nextCount = owned.cards.length + 1;
                                        const willComplete = nextCount >= owned.size;
                                        return (
                                            <Text style={[styles.synergyHint, willComplete && styles.synergyComplete]}>
                                                {willComplete
                                                    ? t('dialog.set_synergy_complete')
                                                    : t('dialog.set_synergy_progress', {
                                                          current: owned.cards.length,
                                                          next: nextCount,
                                                          total: owned.size,
                                                      })}
                                            </Text>
                                        );
                                    }
                                    return (
                                        <Text style={styles.synergyHint}>
                                            {t('dialog.set_synergy_new', { color: tColor(takeCard.set.color) })}
                                        </Text>
                                    );
                                })()}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.targetPlaceholder}>
                            <Text style={styles.targetPlaceholderText}>{t('dialog.chosen_take_none')}</Text>
                        </View>
                    )}
                </View>
            ) : null}

            {/* ---- double the rent ---- */}
            {isRent && doubleCards.length ? (
                <>
                    <LabelCaps>{t('dialog.double_rent')}</LabelCaps>
                    <View style={styles.row}>
                        {doubleCards.map((d) => {
                            const on = doubles.includes(d.id);
                            return (
                                <Pressable
                                    key={d.id}
                                    onPress={() =>
                                        setDoubles((prev) =>
                                            on ? prev.filter((x) => x !== d.id) : [...prev, d.id],
                                        )
                                    }
                                >
                                    <Card card={d} size="xs" pickTone={on ? 'take' : null} selected={on} />
                                </Pressable>
                            );
                        })}
                    </View>
                    <Text style={styles.hint}>
                        {t('dialog.plays_used', { needed: playsNeeded, left: game.plays_left })}
                    </Text>
                    {notEnoughPlays ? <Text style={styles.warn}>{t('dialog.not_enough_plays')}</Text> : null}
                </>
            ) : null}

            {/* ---- their board, for a steal or a swap ---- */}
            {needsTakeCard && victim ? (
                <>
                    <LabelCaps>{t('dialog.their_properties', { name: victim.name })}</LabelCaps>
                    {stealableCards(victim).length ? (
                        <PropertySets
                            sets={victim.sets}
                            size="propertyZone"
                            enabledIds={new Set(stealableCards(victim).map((s) => s.card.id))}
                            selectedIds={takeCardId ? new Set([takeCardId]) : undefined}
                            pickTone="take"
                            onCardPress={(c: CardT) => setTakeCardId(c.id)}
                        />
                    ) : (
                        <Text style={styles.warn}>{t('dialog.nothing_stealable')}</Text>
                    )}
                </>
            ) : null}

            {needsGiveCard && me ? (
                <>
                    <LabelCaps>{t('dialog.your_give')}</LabelCaps>
                    {stealableCards(me).length ? (
                        <PropertySets
                            sets={me.sets}
                            size="propertyZone"
                            enabledIds={new Set(stealableCards(me).map((s) => s.card.id))}
                            selectedIds={giveCardId ? new Set([giveCardId]) : undefined}
                            pickTone="give"
                            onCardPress={(c: CardT) => setGiveCardId(c.id)}
                        />
                    ) : (
                        <Text style={styles.warn}>{t('dialog.nothing_to_give')}</Text>
                    )}
                </>
            ) : null}

            {movingWithNoPlays ? <Text style={styles.warn}>{t('dialog.no_plays_left')}</Text> : null}
            {intent === 'move' ? <Text style={styles.hint}>{t('dialog.move_costs_play')}</Text> : null}

            <View style={styles.actions}>
                <Btn label={t('common.cancel')} onPress={onClose} style={styles.flex} />
                {!noChoices ? (
                    <Btn
                        label={confirmLabel}
                        variant="gold"
                        disabled={!ready}
                        onPress={submit}
                        style={styles.flex}
                    />
                ) : null}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    blurb: { flex: 1, fontFamily: uiFont(700), fontSize: 12, color: ink.muted60, lineHeight: 17 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
        minHeight: 44,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius.md,
        backgroundColor: '#ffffff0f',
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipOn: { borderColor: brand.brass, backgroundColor: brand.brassGlow12 },
    chipText: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60 },
    chipTextOn: { color: ink.body },
    chipHint: { fontFamily: uiFont(700), fontSize: 10, color: ink.muted45 },
    swatch: {
        minHeight: 44,
        minWidth: 74,
        paddingHorizontal: 10,
        borderRadius: radius.md,
        backgroundColor: '#ffffff0f',
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    swatchOn: { borderColor: brand.brass, backgroundColor: brand.brassGlow12 },
    swatchDot: { width: 20, height: 5, borderRadius: radius.xs },
    dim: { opacity: 0.35 },
    hint: { fontFamily: uiFont(700), fontSize: 11, color: ink.muted45 },
    warn: { fontFamily: uiFont(700), fontSize: 12, color: status.give },
    actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    flex: { flex: 1 },

    // Complete Set Inspector (Deal Breaker)
    completeSetGrid: { gap: 8 },
    completeSetCard: {
        padding: 10,
        borderRadius: radius.md,
        backgroundColor: '#ffffff0a',
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        gap: 8,
    },
    completeSetCardSelected: {
        borderColor: brand.brass,
        backgroundColor: brand.brassGlow12,
    },
    completeSetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    completeSetTitle: {
        fontFamily: uiFont(800),
        fontSize: 12,
        color: ink.body,
    },
    completeSetTitleSelected: {
        color: brand.brass,
    },
    completeSetRent: {
        fontFamily: uiFont(700),
        fontSize: 11,
        color: '#74e8bd',
        marginLeft: 'auto',
    },
    buildingBadgeRow: {
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
    },
    buildingIcon: {
        fontFamily: uiFont(700),
        fontSize: 12,
        color: brand.brass,
    },
    completeSetCardsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    setCardOverlap: {
        marginLeft: -24,
    },
    selectedSetSummary: {
        fontFamily: uiFont(700),
        fontSize: 11,
        color: brand.brass,
        marginTop: 2,
    },

    // Trade Preview (Forced Deal)
    tradePreviewBox: {
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: line.hairlineWhite10,
        backgroundColor: '#ffffff08',
        padding: 10,
        gap: 6,
    },
    tradeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tradeColumn: {
        flex: 1,
        padding: 8,
        borderRadius: radius.sm,
        borderWidth: 1,
        minHeight: 90,
        justifyContent: 'center',
    },
    tradeColumnGive: {
        borderColor: '#fad03e4d',
        backgroundColor: '#fad03e0a',
    },
    tradeColumnTake: {
        borderColor: '#63ea894d',
        backgroundColor: '#63ea890a',
    },
    tradeRoleGive: {
        fontFamily: uiFont(800),
        fontSize: 10,
        color: status.give,
        marginBottom: 4,
    },
    tradeRoleTake: {
        fontFamily: uiFont(800),
        fontSize: 10,
        color: status.take,
        marginBottom: 4,
    },
    tradeCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    tradeCardInfo: {
        flex: 1,
        gap: 2,
    },
    tradeCardName: {
        fontFamily: uiFont(800),
        fontSize: 11,
        color: ink.body,
    },
    tradeCardDetail: {
        fontFamily: uiFont(700),
        fontSize: 10,
        color: ink.muted60,
    },
    tradePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
    },
    tradePlaceholderText: {
        fontFamily: uiFont(700),
        fontSize: 10,
        color: ink.muted45,
        textAlign: 'center',
    },
    swapIconContainer: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    swapArrow: {
        fontFamily: uiFont(800),
        fontSize: 18,
        color: ink.cream,
    },

    // Target Preview (Sly Deal)
    targetPreviewBox: {
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: '#63ea894d',
        backgroundColor: '#63ea890d',
        padding: 10,
        gap: 6,
    },
    targetCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    targetCardDetails: {
        flex: 1,
        gap: 3,
    },
    targetCardName: {
        fontFamily: uiFont(800),
        fontSize: 12,
        color: ink.body,
    },
    targetCardSubtitle: {
        fontFamily: uiFont(700),
        fontSize: 11,
        color: ink.muted60,
    },
    synergyHint: {
        fontFamily: uiFont(700),
        fontSize: 11,
        color: ink.cream,
    },
    synergyComplete: {
        color: status.take,
    },
    targetPlaceholder: {
        paddingVertical: 6,
    },
    targetPlaceholderText: {
        fontFamily: uiFont(700),
        fontSize: 11,
        color: ink.muted45,
    },
});

export default ActionDialog;
