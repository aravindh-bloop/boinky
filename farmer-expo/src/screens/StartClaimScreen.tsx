import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { api, ApiError } from '../api/client';
import { useT } from '../i18n';
import type { ClaimCause, LossType } from '../api/types';
import {
  Button,
  Card,
  Field,
  Icon,
  PressableScale,
  Row,
  Screen,
  SelectChip,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';
import { CAUSE_LABELS, LOSS_TYPE_LABELS } from './insuranceShared';

type R = RouteProp<InsuranceStackParams, 'StartClaim'>;

const CAUSES: ClaimCause[] = [
  'flood',
  'unseasonal_rain',
  'drought',
  'hailstorm',
  'cyclone',
  'frost',
  'fire',
  'pest_disease',
  'prevented_sowing',
  'other',
];
const LOSS_TYPES: LossType[] = ['localised', 'widespread', 'post_harvest', 'prevented_sowing', 'mid_season'];

export default function StartClaimScreen() {
  const nav = useNavigation<any>();
  const t = useT();
  const { policyRefId } = useRoute<R>().params;

  const [cause, setCause] = useState<ClaimCause | undefined>();
  const [lossType, setLossType] = useState<LossType>('localised');
  const [incidentDate, setIncidentDate] = useState('');
  const [docketId, setDocketId] = useState('');
  const [lossPct, setLossPct] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!cause) return alertT(t('Choose what caused the damage'));
    if (incidentDate && !/^\d{4}-\d{2}-\d{2}$/.test(incidentDate.trim()))
      return alertT(t('Date should look like 2026-08-30'));
    setBusy(true);
    try {
      const res = await api.request<{ claim: { id: string } }>('/api/insurance/claims', {
        method: 'POST',
        body: {
          policyRefId,
          cause,
          lossType,
          incidentDate: incidentDate.trim() || undefined,
          docketId: docketId.trim() || undefined,
          farmerEstimatedLossPct: lossPct ? Number(lossPct) : undefined,
          note: note.trim() || undefined,
        },
      });
      nav.replace('ClaimTrack', { claimId: res.claim.id });
    } catch (e) {
      alertT(t('Could not start tracking'), e instanceof ApiError ? e.message : t('Try again'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title={t('Start tracking')} onPress={save} loading={busy} size="lg" />}>
      {/* report-first reminder */}
      <View
        style={{
          backgroundColor: palette.warnSoft,
          borderRadius: radius.lg,
          padding: space.md,
          gap: space.xs,
        }}
      >
        <Row gap={space.sm}>
          <Icon name="warning" size={16} color={palette.warn} weight="fill" />
          <Text variant="subhead" color="#8A6A22">
            {t('Report the loss to the government first')}
          </Text>
        </Row>
        <Text variant="caption" color="#8A6A22">
          {t(
            'You must intimate the loss within 72 hours through the Crop Insurance App, pmfby.gov.in, or the KRPH helpline 14447. This screen only tracks a claim you have already reported.',
          )}
        </Text>
        <Row gap={space.sm} style={{ marginTop: space.xs }}>
          <PressableScale onPress={() => Linking.openURL('tel:14447')} compact>
            <Row gap={4}>
              <Icon name="alerts" size={13} color="#8A6A22" />
              <Text variant="label" color="#8A6A22">
                {t('Call 14447')}
              </Text>
            </Row>
          </PressableScale>
          <PressableScale onPress={() => Linking.openURL('https://pmfby.gov.in/')} compact>
            <Row gap={4}>
              <Icon name="arrowRight" size={13} color="#8A6A22" />
              <Text variant="label" color="#8A6A22">
                {t('Open pmfby.gov.in')}
              </Text>
            </Row>
          </PressableScale>
        </Row>
      </View>

      <Card accent={palette.sky}>
        <Text variant="subhead">{t('What caused the damage?')}</Text>
        <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
          {CAUSES.map((c) => (
            <SelectChip
              key={c}
              label={t(CAUSE_LABELS[c] ?? c)}
              selected={cause === c}
              onPress={() => setCause(c)}
              accent={palette.sky}
              accentSoft={palette.skySoft}
            />
          ))}
        </Row>
      </Card>

      <Card accent={palette.sky}>
        <Text variant="subhead">{t('How widespread is it?')}</Text>
        <Text variant="caption" faint>
          {t('This changes the timeline — a whole-area yield loss is assessed differently from damage to just your field.')}
        </Text>
        <View style={{ gap: space.xs, marginTop: space.xs }}>
          {LOSS_TYPES.map((lt) => (
            <SelectChip
              key={lt}
              label={t(LOSS_TYPE_LABELS[lt] ?? lt)}
              selected={lossType === lt}
              onPress={() => setLossType(lt)}
              accent={palette.sky}
              accentSoft={palette.skySoft}
              style={{ alignSelf: 'flex-start' }}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Field
          label={t('Date of loss')}
          value={incidentDate}
          onChangeText={setIncidentDate}
          placeholder="2026-08-30"
          hint="YYYY-MM-DD"
        />
        <Field
          label={t('Docket / intimation no. (from the app or 14447)')}
          value={docketId}
          onChangeText={setDocketId}
          placeholder="e.g. KRPH/2026/TN/114829"
        />
        <Field
          label={t('Roughly how much of the crop is lost? (%)')}
          value={lossPct}
          onChangeText={setLossPct}
          keyboardType="number-pad"
          placeholder="45"
        />
        <Field
          label={t('Note (optional)')}
          value={note}
          onChangeText={setNote}
          placeholder={t('e.g. Heavy rain lodged the crop on the low end of the plot')}
          multiline
        />
      </Card>
    </Screen>
  );
}
