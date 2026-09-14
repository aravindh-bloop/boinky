import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { api, ApiError } from '../api/client';
import { useApi } from '../api/useApi';
import { useT } from '../i18n';
import type { ClaimStage, ClaimTrackDetail } from '../api/types';
import {
  Button,
  Card,
  Field,
  Icon,
  LoaderScreen,
  ErrorState,
  PressableScale,
  Row,
  ScreenHeader,
  SelectChip,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';
import { CAUSE_LABELS, slaBadge, stageLabel } from './insuranceShared';

type R = RouteProp<InsuranceStackParams, 'ClaimTrack'>;

const NEXT_STAGES: ClaimStage[] = ['intimation', 'survey', 'assessment', 'approval', 'payout', 'closed'];

export default function ClaimTrackScreen() {
  const nav = useNavigation<any>();
  const t = useT();
  const { claimId } = useRoute<R>().params;
  const { data, loading, error, reload, refreshing } = useApi<ClaimTrackDetail>(
    `/api/insurance/claims/${claimId}`,
  );

  const [updating, setUpdating] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (loading) return <LoaderScreen label="Loading your claim" />;
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />;
  if (!data.timeline || !data.clock || !data.stageInfo) {
    return (
      <ErrorState
        message={t('The server needs updating to show claim tracking. Please try again later.')}
        onRetry={reload}
      />
    );
  }

  const { claim, clock, timeline, events, escalations } = data;
  const badge = slaBadge(clock, claim.outcome, t);
  const stageInfo = data.stageInfo;

  async function submitNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api.request(`/api/insurance/claims/${claimId}/notes`, {
        method: 'POST',
        body: { body: note.trim() },
      });
      setNote('');
      setNoteOpen(false);
      reload();
    } catch (e) {
      alertT(t('Could not save'), e instanceof ApiError ? e.message : '');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor="#fff" />}
      >
        <ScreenHeader
          tone="weather"
          title={`${t(CAUSE_LABELS[claim.cause] ?? claim.cause)} — ${claim.crop}`}
          subtitle={`${claim.season}${claim.district ? ` · ${claim.district}` : ''}`}
          onBack={() => nav.goBack()}
        />

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
          {/* status banner */}
          <Card elevation="raised" accent={badge.color}>
            <Row between>
              <Text variant="overline">{t('Status')}</Text>
              <View
                style={{
                  backgroundColor: badge.soft,
                  paddingHorizontal: space.sm,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                }}
              >
                <Text variant="label" color={badge.color}>
                  {badge.label}
                </Text>
              </View>
            </Row>
            <Text variant="subhead" raw>
              {stageLabel(claim.stage, t)}
            </Text>
            <Text variant="body" muted>
              {t(stageInfo.meaning)}
            </Text>
            <Row gap={6}>
              <Icon name="user" size={12} color={palette.textFaint} />
              <Text variant="caption" faint>
                {t(stageInfo.owner)}
              </Text>
            </Row>
            {clock.slaDays != null && (
              <Text variant="caption" color={clock.breached ? palette.danger : palette.textMuted}>
                {clock.breached
                  ? t('{n} days past the {sla}-day limit for this stage.', {
                      n: clock.overdueBy,
                      sla: clock.slaDays,
                    })
                  : t('Day {d} of the {sla}-day limit for this stage.', {
                      d: clock.daysAtStage,
                      sla: clock.slaDays,
                    })}
              </Text>
            )}
            {clock.breached && (
              <View
                style={{
                  backgroundColor: palette.surfaceSunken,
                  borderRadius: radius.md,
                  padding: space.sm,
                  marginTop: 2,
                }}
              >
                <Text variant="caption" color={palette.text}>
                  {t(stageInfo.ifStuck)}
                </Text>
              </View>
            )}
          </Card>

          {/* escalate */}
          <PressableScale onPress={() => nav.navigate('Escalate', { claimId })} feedback="press">
            <Card elevation="flat" accent={data.canEscalate ? palette.coral : palette.sky}>
              <Row between>
                <Row gap={space.sm} style={{ flex: 1 }}>
                  <Icon
                    name="shield"
                    size={18}
                    color={data.canEscalate ? palette.coral : palette.sky}
                    weight="fill"
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="subhead">
                      {data.canEscalate ? t('This claim needs a push') : t('Escalate this claim')}
                    </Text>
                    <Text variant="caption" muted>
                      {data.canEscalate
                        ? t('It has crossed its time limit. Send a grievance to the right officer.')
                        : t('Find the right officer and send a pre-filled grievance.')}
                    </Text>
                  </View>
                </Row>
                <Icon name="right" size={16} color={palette.textFaint} />
              </Row>
            </Card>
          </PressableScale>

          {escalations.length > 0 && (
            <Card elevation="flat">
              <Text variant="overline">{t('Escalations')}</Text>
              {escalations.map((e) => (
                <Row key={e.id} between style={{ paddingVertical: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" raw>
                      {e.rung.toUpperCase()} · {e.channel}
                    </Text>
                    {e.officer_note ? (
                      <Text variant="caption" muted raw>
                        {e.officer_note}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    variant="caption"
                    color={
                      e.status === 'resolved'
                        ? palette.success
                        : e.status === 'in_progress'
                          ? palette.info
                          : palette.textMuted
                    }
                  >
                    {t(e.status.replace('_', ' '))}
                  </Text>
                </Row>
              ))}
            </Card>
          )}

          {/* timeline */}
          <Card elevation="flat">
            <Text variant="overline">{t('The six stages')}</Text>
            <View style={{ gap: space.sm, marginTop: space.xs }}>
              {timeline.map((s) => (
                <Row key={s.key} gap={space.sm} style={{ alignItems: 'flex-start' }}>
                  <Icon
                    name={s.state === 'done' ? 'check' : 'circle'}
                    size={18}
                    color={
                      s.state === 'done'
                        ? palette.success
                        : s.state === 'current'
                          ? badge.color
                          : palette.borderStrong
                    }
                    weight={s.state === 'upcoming' ? 'regular' : 'fill'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      variant={s.state === 'current' ? 'subhead' : 'body'}
                      color={s.state === 'upcoming' ? palette.textMuted : palette.text}
                      raw
                    >
                      {t(s.label)}
                    </Text>
                    {s.state === 'current' && (
                      <Text variant="caption" faint>
                        {t(s.meaning)}
                      </Text>
                    )}
                  </View>
                </Row>
              ))}
            </View>
          </Card>

          {/* update the stage */}
          <Card elevation="flat">
            <PressableScale onPress={() => setUpdating((v) => !v)} feedback="tap">
              <Row between>
                <Row gap={space.sm}>
                  <Icon name="retry" size={16} color={palette.primary} weight="fill" />
                  <Text variant="subhead">{t('I have an update from the office')}</Text>
                </Row>
                <Icon name={updating ? 'up' : 'right'} size={14} color={palette.primary} weight="bold" />
              </Row>
            </PressableScale>
            {updating && (
              <Animated.View entering={FadeIn.duration(150)} style={{ marginTop: space.sm }}>
                <StageUpdater claim={claim} onDone={reload} />
              </Animated.View>
            )}
          </Card>

          {/* claim facts — reference info, collapsed by default */}
          <Card elevation="flat">
            <PressableScale onPress={() => setFactsOpen((v) => !v)} feedback="tap">
              <Row between>
                <Text variant="overline">{t('Claim details')}</Text>
                <Icon name={factsOpen ? 'up' : 'right'} size={14} color={palette.textFaint} weight="bold" />
              </Row>
            </PressableScale>
            {factsOpen && (
              <Animated.View entering={FadeIn.duration(150)} style={{ marginTop: space.xs }}>
                <Fact label={t('PMFBY application')} value={claim.application_no} />
                <Fact label={t('Docket / intimation')} value={claim.docket_id} />
                <Fact label={t('Date of loss')} value={fmtDate(claim.incident_date)} />
                <Fact label={t('Insurer')} value={claim.insurer_name} />
                <Fact
                  label={t('Sum insured')}
                  value={claim.sum_insured ? `₹${claim.sum_insured.toLocaleString('en-IN')}` : null}
                />
                <Fact
                  label={t('Amount expected')}
                  value={claim.amount_expected ? `₹${Math.round(claim.amount_expected).toLocaleString('en-IN')}` : null}
                />
                <Fact
                  label={t('Amount paid')}
                  value={claim.amount_paid ? `₹${Math.round(claim.amount_paid).toLocaleString('en-IN')}` : null}
                />
              </Animated.View>
            )}
          </Card>

          {/* events + note — history collapsed by default, adding a note always reachable */}
          <Card elevation="flat">
            <Row between>
              <PressableScale onPress={() => setHistoryOpen((v) => !v)} feedback="tap" style={{ flex: 1 }}>
                <Row gap={4}>
                  <Text variant="overline">{t('History')}</Text>
                  <Icon name={historyOpen ? 'up' : 'right'} size={13} color={palette.textFaint} weight="bold" />
                </Row>
              </PressableScale>
              <PressableScale onPress={() => setNoteOpen((v) => !v)} compact>
                <Text variant="label" color={palette.primary}>
                  {t('Add a note')}
                </Text>
              </PressableScale>
            </Row>
            {noteOpen && (
              <Animated.View entering={FadeIn.duration(150)} style={{ gap: space.sm, marginVertical: space.xs }}>
                <Field
                  value={note}
                  onChangeText={setNote}
                  placeholder={t('What happened?')}
                  multiline
                />
                <Button title={t('Save note')} size="sm" loading={busy} onPress={submitNote} />
              </Animated.View>
            )}
            {historyOpen && (
              <Animated.View entering={FadeIn.duration(150)} style={{ gap: space.sm, marginTop: space.xs }}>
                {events.map((e) => (
                  <Row key={e.id} gap={space.sm} style={{ alignItems: 'flex-start' }}>
                    <Icon
                      name={e.kind === 'escalation' ? 'shield' : e.kind === 'stage_change' ? 'check' : 'circle'}
                      size={12}
                      color={palette.textFaint}
                      weight="fill"
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" raw>
                        {e.body ??
                          (e.to_stage ? `${t('Moved to')} ${stageLabel(e.to_stage as ClaimStage, t)}` : '—')}
                      </Text>
                      <Text variant="caption" faint raw>
                        {new Date(e.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {e.source === 'officer' ? ` · ${t('officer')}` : ''}
                      </Text>
                    </View>
                  </Row>
                ))}
              </Animated.View>
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

function StageUpdater({
  claim,
  onDone,
}: {
  claim: ClaimTrackDetail['claim'];
  onDone: () => void;
}) {
  const t = useT();
  const [stage, setStage] = useState<ClaimStage>(claim.stage);
  const [date, setDate] = useState('');
  const [outcome, setOutcome] = useState<'approved' | 'rejected' | 'partial' | null>(
    claim.outcome && claim.outcome !== 'pending' ? claim.outcome : null,
  );
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const showOutcome = stage === 'approval' || stage === 'payout';

  async function save() {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return alertT(t('Date should look like 2026-08-30'));
    setBusy(true);
    try {
      await api.request(`/api/insurance/claims/${claim.id}`, {
        method: 'PATCH',
        body: {
          stage,
          stageSince: date.trim() || undefined,
          outcome: showOutcome ? outcome : undefined,
          amountExpected: outcome === 'approved' && amount ? Number(amount) : undefined,
          amountPaid: stage === 'payout' && amount ? Number(amount) : undefined,
        },
      });
      onDone();
    } catch (e) {
      alertT(t('Could not update'), e instanceof ApiError ? e.message : '');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" faint>
        {t('Move the tracker to where your claim actually is, from the SMS or what the office told you.')}
      </Text>
      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
        {NEXT_STAGES.map((s) => (
          <SelectChip
            key={s}
            label={stageLabel(s, t)}
            selected={stage === s}
            onPress={() => setStage(s)}
            accent={palette.sky}
            accentSoft={palette.skySoft}
          />
        ))}
      </Row>
      <Field
        label={t('Since when? (optional)')}
        value={date}
        onChangeText={setDate}
        placeholder="2026-09-01"
        hint="YYYY-MM-DD"
      />
      {showOutcome && (
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {(['approved', 'partial', 'rejected'] as const).map((o) => (
            <SelectChip
              key={o}
              label={t(o)}
              selected={outcome === o}
              onPress={() => setOutcome(o)}
              accent={o === 'rejected' ? palette.danger : palette.primary}
              accentSoft={o === 'rejected' ? palette.dangerSoft : palette.primarySoft}
            />
          ))}
        </Row>
      )}
      {(outcome === 'approved' || stage === 'payout') && (
        <Field
          label={stage === 'payout' ? t('Amount paid (₹)') : t('Amount approved (₹)')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="23400"
        />
      )}
      <Button title={t('Update the tracker')} size="sm" loading={busy} onPress={save} />
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <Row between style={{ paddingVertical: 2 }}>
      <Text variant="caption" faint>
        {label}
      </Text>
      <Text variant="caption" raw>
        {value}
      </Text>
    </Row>
  );
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
