import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PendingPanelProps } from '../../../lib/contracts';
import { brand, ink, line, radius, status } from '../../../lib/theme';
import { colorMeta } from '../../game/meta';
import { Btn, LabelCaps, Modal } from '../../ui/kit';
import { Card } from '../../ui/card';
import { useI18n } from '../../i18n';
import { uiFont } from '../../../lib/fonts';
import { CountdownTimer } from './CountdownTimer';

/**
 * The modal that owns the screen while a demand is unresolved.
 *
 * It has four faces and they are not variations on one layout — a payer is
 * choosing what to hand over, a steal target is deciding whether to block, a
 * blocked instigator is deciding whether to escalate, and a bystander is only
 * watching. Each gets the buttons that belong to it and no others.
 */
export function PendingPanel({
    pending,
    role,
    myTarget,
    payableCards,
    you,
    players = [],
    deadlineMs = 0,
    deadlineSeconds = 0,
    skewMs,
    tutorialCopy,
    youHasJsn = false,
    disabled = false,
    isPending = false,
    onRespond,
}: PendingPanelProps) {
    const { t, tCard, tColor } = useI18n();
    const [picked, setPicked] = useState<string[]>([]);

    const playerName = (id: string) => {
        if (id === you) return t('common.you');
        return players.find((p) => p.id === id)?.name ?? id;
    };

    const actionNote = useMemo(() => {
        const by = players.find((p) => p.id === pending.by_id)?.name
            ?? (pending.by_id === you ? t('common.you') : t('pending.ui.someone'));
        const victim = players.find((p) => p.id === pending.target_player_id)?.name
            ?? (pending.target_player_id === you ? t('common.you') : t('pending.ui.them'));
        const color = pending.target_color ? tColor(pending.target_color) : '';
        switch (pending.kind) {
            case 'deal_breaker':
                return t('pending.ui.deal_breaker', { by, victim, color });
            case 'sly_deal':
                return t('pending.ui.sly_deal', { by, victim, color });
            case 'forced_deal':
                return t('pending.ui.forced_deal', { by, victim, color });
            default:
                return t('pending.ui.played', { by, card: tCard(pending.card) });
        }
    }, [pending, players, you, t, tCard, tColor]);

    // A fresh demand must never inherit the last one's selection.
    useEffect(() => setPicked([]), [pending.card.id, myTarget?.player_id]);

    const owed = myTarget?.amount ?? 0;
    const pool = payableCards ?? [];

    const selectedTotal = useMemo(
        () => pool.filter((p) => picked.includes(p.card.id)).reduce((sum, p) => sum + p.card.value, 0),
        [pool, picked],
    );
    const poolTotal = useMemo(() => pool.reduce((sum, p) => sum + p.card.value, 0), [pool]);

    // When everything you own still doesn't cover the debt, the rule is that it
    // all goes — so the button unlocks only once every card is selected.
    const mustGiveAll = poolTotal <= owed;
    const canPay = mustGiveAll ? picked.length === pool.length && pool.length > 0 : selectedTotal >= owed;

    const title =
        role === 'payer'
            ? t('pending.ui.you_owe', { amount: owed })
            : role === 'target'
              ? t('pending.ui.you_target')
              : role === 'blocked_instigator'
                ? t('pending.ui.you_blocked')
                : t('pending.ui.in_progress');

    return (
        <Modal open title={title}>
            <CountdownTimer
                deadlineMs={deadlineMs}
                totalSeconds={deadlineSeconds}
                skewMs={skewMs}
                kind="respond"
                compact
            />
            {tutorialCopy ? (
                <View style={styles.tutorial}>
                    <View style={styles.tutorialHead}>
                        <LabelCaps color={brand.brass}>{t('tutorial.label')}</LabelCaps>
                        <Pressable
                            accessibilityRole="button"
                            onPress={tutorialCopy.onSkip}
                            hitSlop={8}
                            style={({ pressed }) => [styles.tutorialSkip, pressed && styles.tutorialSkipPressed]}
                        >
                            <Text style={styles.tutorialSkipText}>{t('tutorial.skipTour')}</Text>
                        </Pressable>
                    </View>
                    <Text style={styles.tutorialTitle} accessibilityRole="header">{tutorialCopy.title}</Text>
                    <Text style={styles.tutorialBody}>{tutorialCopy.body}</Text>
                    <Text style={styles.tutorialTask}>→ {tutorialCopy.task}</Text>
                </View>
            ) : null}
            <View style={styles.head}>
                <Card card={pending.card} size="sm" />
                <View style={styles.headText}>
                    <Text style={styles.label}>{t(pending.label_key, pending.label_args)}</Text>
                    {actionNote ? <Text style={styles.note}>{actionNote}</Text> : null}
                    {role === 'payer' ? (
                        <Text style={styles.blurb}>
                            {mustGiveAll
                                ? t('pending.ui.give_everything', { amount: owed })
                                : t('pending.ui.pick_cards')}
                        </Text>
                    ) : role === 'target' ? (
                        <Text style={styles.blurb}>{t('pending.ui.you_target_blurb')}</Text>
                    ) : role === 'blocked_instigator' ? (
                        <Text style={styles.blurb}>{t('pending.ui.you_blocked_blurb')}</Text>
                    ) : null}
                </View>
            </View>

            {/* ---- bystander: who still owes what ---- */}
            {role === 'bystander' ? (
                <View style={styles.roster}>
                    {(pending.targets ?? []).map((tg) => (
                        <View key={tg.player_id} style={styles.rosterRow}>
                            <Text style={styles.rosterName}>{playerName(tg.player_id)}</Text>
                            <Text style={styles.rosterState}>
                                {tg.settled
                                    ? tg.note
                                        ? t('pending.ui.blocked_it')
                                        : t('pending.ui.settled')
                                    : tg.cancelled
                                      ? t('pending.ui.said_no')
                                      : tg.amount > 0
                                        ? t('pending.ui.owes', { amount: tg.amount })
                                        : t('pending.ui.deciding')}
                            </Text>
                        </View>
                    ))}
                    <Text style={styles.blurb}>{t('pending.ui.resolving')}</Text>
                </View>
            ) : null}

            {/* ---- payer: pick what leaves ---- */}
            {role === 'payer' ? (
                pool.length === 0 ? (
                    <Text style={styles.warn}>{t('pending.ui.nothing_in_play')}</Text>
                ) : (
                    <>
                        <LabelCaps>{t('pending.ui.your_cards')}</LabelCaps>
                        <View style={styles.pool}>
                            {pool.map(({ card, source }) => {
                                const on = picked.includes(card.id);
                                return (
                                    <Pressable
                                        key={card.id}
                                        onPress={() =>
                                            setPicked((prev) =>
                                                on ? prev.filter((x) => x !== card.id) : [...prev, card.id],
                                            )
                                        }
                                        disabled={disabled}
                                        style={styles.poolItem}
                                    >
                                        <Card card={card} size="xs" selected={on} pickTone={on ? 'give' : null} />
                                        <Text style={styles.source}>
                                            {source === 'bank'
                                                ? t('pending.ui.from_bank')
                                                : tColor(source)}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <Text style={styles.total}>
                            {t('pending.ui.selected', { selected: selectedTotal, owed })}
                        </Text>
                    </>
                )
            ) : null}

            {/* ---- buttons ---- */}
            {role !== 'bystander' ? (
                <View style={styles.actions}>
                    {/* Just Say No does not dismiss anything — it hands the
                        decision back to the other player, who may have one too. */}
                    <Btn
                        label={t('pending.ui.just_say_no')}
                        variant="red"
                        disabled={disabled || !youHasJsn}
                        pending={isPending}
                        onPress={() => onRespond({ say_no: true })}
                        style={styles.flex}
                    />

                    {role === 'payer' ? (
                        <Btn
                            label={t('pending.ui.pay', { amount: selectedTotal })}
                            variant="gold"
                            disabled={disabled || (!canPay && pool.length > 0)}
                            pending={isPending}
                            onPress={() => onRespond({ card_ids: picked })}
                            style={styles.flex}
                        />
                    ) : (
                        <Btn
                            label={
                                role === 'blocked_instigator'
                                    ? t('pending.ui.let_it_go')
                                    : t('pending.ui.allow_it')
                            }
                            disabled={disabled}
                            pending={isPending}
                            onPress={() => onRespond({})}
                            style={styles.flex}
                        />
                    )}
                </View>
            ) : null}
        </Modal>
    );
}

const styles = StyleSheet.create({
    tutorial: {
        gap: 4,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: '#dce64e42',
        backgroundColor: '#dce64e14',
        padding: 10,
    },
    tutorialHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tutorialSkip: { marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm },
    tutorialSkipPressed: { backgroundColor: '#ffffff12' },
    tutorialSkipText: { fontFamily: uiFont(800), fontSize: 10, color: ink.muted60 },
    tutorialTitle: { fontFamily: uiFont(900), fontSize: 15, color: brand.brass },
    tutorialBody: { fontFamily: uiFont(700), fontSize: 12, lineHeight: 17, color: ink.muted60 },
    tutorialTask: { fontFamily: uiFont(800), fontSize: 11, lineHeight: 15, color: ink.endTurnHint },
    head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    headText: { flex: 1, gap: 3 },
    label: { fontFamily: uiFont(800), fontSize: 14, color: ink.body },
    note: { fontFamily: uiFont(700), fontSize: 12, color: brand.brass, lineHeight: 16 },
    blurb: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60, lineHeight: 17 },
    roster: { gap: 6, marginTop: 4 },
    rosterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderTopWidth: 1,
        borderTopColor: line.hairlineWhite10,
    },
    rosterName: { fontFamily: uiFont(700), fontSize: 12, color: ink.body },
    rosterState: { fontFamily: uiFont(700), fontSize: 12, color: ink.muted60 },
    pool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    poolItem: { alignItems: 'center', gap: 2 },
    source: { fontFamily: uiFont(700), fontSize: 9, color: ink.muted45 },
    total: {
        fontFamily: uiFont(800),
        fontSize: 16,
        color: brand.brass,
        textAlign: 'center',
        marginTop: 2,
    },
    warn: { fontFamily: uiFont(700), fontSize: 12, color: status.give },
    actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
    flex: { flex: 1 },
});

export default PendingPanel;
