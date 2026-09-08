import { alertT } from '../i18n/alert';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { api, ApiError } from '../api/client';
import { useApi } from '../api/useApi';
import { useT } from '../i18n';
import type { Field as FieldT, PolicyRef } from '../api/types';
import {
  Button,
  Card,
  Field,
  Icon,
  Row,
  Screen,
  SelectChip,
  Text,
  palette,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';

type R = RouteProp<InsuranceStackParams, 'PolicyForm'>;

function currentSeasons(): string[] {
  const y = new Date().getFullYear();
  return [`Kharif ${y}`, `Rabi ${y}-${String((y + 1) % 100).padStart(2, '0')}`, `Kharif ${y - 1}`];
}

export default function PolicyFormScreen() {
  const nav = useNavigation<any>();
  const t = useT();
  const editId = useRoute<R>().params?.policyId;

  const { data: fieldsData } = useApi<{ fields: FieldT[] }>('/api/fields');
  const { data: polData } = useApi<{ policies: PolicyRef[] }>('/api/insurance/policies');
  const fields = fieldsData?.fields ?? [];
  const existing = useMemo(
    () => polData?.policies.find((p) => p.id === editId),
    [polData, editId],
  );

  const [fieldId, setFieldId] = useState<string | undefined>(existing?.field_id ?? undefined);
  const [applicationNo, setApplicationNo] = useState(existing?.application_no ?? '');
  const [season, setSeason] = useState(existing?.season ?? currentSeasons()[0]!);
  const [crop, setCrop] = useState(existing?.crop ?? '');
  const [insurer, setInsurer] = useState(existing?.insurer_name ?? '');
  const [insuranceUnit, setInsuranceUnit] = useState(existing?.insurance_unit ?? '');
  const [sumInsured, setSumInsured] = useState(existing?.sum_insured ? String(existing.sum_insured) : '');
  const [premium, setPremium] = useState(existing?.premium_paid ? String(existing.premium_paid) : '');
  const [district, setDistrict] = useState(existing?.district ?? '');
  const [busy, setBusy] = useState(false);

  // prefill crop/district from the chosen field
  React.useEffect(() => {
    if (!fieldId || existing) return;
    const f = fields.find((x) => x.id === fieldId);
    if (f) {
      if (!crop) setCrop(f.crop);
      if (!district && f.district) setDistrict(f.district);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId]);

  async function save() {
    if (!crop.trim()) return alertT(t('Crop is required'));
    if (!season.trim()) return alertT(t('Season is required'));
    setBusy(true);
    const body = {
      fieldId,
      applicationNo: applicationNo.trim() || undefined,
      season: season.trim(),
      crop: crop.trim(),
      insurerName: insurer.trim() || undefined,
      insuranceUnit: insuranceUnit.trim() || undefined,
      sumInsured: sumInsured ? Number(sumInsured) : undefined,
      premiumPaid: premium ? Number(premium) : undefined,
      district: district.trim() || undefined,
    };
    try {
      if (editId) {
        await api.request(`/api/insurance/policies/${editId}`, { method: 'PATCH', body });
      } else {
        await api.request('/api/insurance/policies', { method: 'POST', body });
      }
      nav.goBack();
    } catch (e) {
      alertT(t('Could not save'), e instanceof ApiError ? e.message : t('Try again'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editId) return;
    alertT(t('Remove this policy?'), t('The tracked claim and its history will be removed too.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.request(`/api/insurance/policies/${editId}`, { method: 'DELETE' });
            nav.goBack();
          } catch (e) {
            alertT(t('Could not remove'), e instanceof ApiError ? e.message : '');
          }
        },
      },
    ]);
  }

  return (
    <Screen footer={<Button title={t('Save policy')} onPress={save} loading={busy} size="lg" />}>
      <Card accent={palette.sky}>
        <Row gap={space.sm}>
          <Icon name="umbrella" size={16} color={palette.sky} weight="fill" />
          <Text variant="subhead">{t('From your acknowledgement slip / SMS')}</Text>
        </Row>
        <Text variant="caption" faint>
          {t('Enter the PMFBY policy exactly as it appears on the paper receipt or the enrolment SMS.')}
        </Text>

        <Field
          label={t('PMFBY application / receipt no.')}
          value={applicationNo}
          onChangeText={setApplicationNo}
          placeholder="e.g. TN2026K-0489217"
          autoCapitalize="characters"
        />

        <View style={{ gap: space.xs }}>
          <Text variant="label" color={palette.textMuted}>
            {t('Season')}
          </Text>
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {currentSeasons().map((s) => (
              <SelectChip
                key={s}
                label={s}
                selected={season === s}
                onPress={() => setSeason(s)}
                accent={palette.sky}
                accentSoft={palette.skySoft}
              />
            ))}
          </Row>
        </View>

        {fields.length > 0 && (
          <View style={{ gap: space.xs }}>
            <Text variant="label" color={palette.textMuted}>
              {t('Which field?')}
            </Text>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              <SelectChip label={t('None')} selected={!fieldId} onPress={() => setFieldId(undefined)} />
              {fields.map((f) => (
                <SelectChip
                  key={f.id}
                  label={f.name || f.crop}
                  selected={fieldId === f.id}
                  onPress={() => setFieldId(f.id)}
                  accent={palette.sky}
                  accentSoft={palette.skySoft}
                />
              ))}
            </Row>
          </View>
        )}

        <Field label={t('Crop')} value={crop} onChangeText={setCrop} placeholder="rice, groundnut…" />
        <Field
          label={t('District')}
          value={district}
          onChangeText={setDistrict}
          placeholder="e.g. Tiruvallur"
        />
        <Field
          label={t('Insurance company')}
          value={insurer}
          onChangeText={setInsurer}
          placeholder="e.g. Agriculture Insurance Company of India"
        />
        <Field
          label={t('Notified insurance unit (optional)')}
          value={insuranceUnit}
          onChangeText={setInsuranceUnit}
          placeholder={t('village / panchayat on the slip')}
        />
        <Row gap={space.md}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Sum insured (₹)')}
              value={sumInsured}
              onChangeText={setSumInsured}
              keyboardType="number-pad"
              placeholder="52000"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('Premium paid (₹)')}
              value={premium}
              onChangeText={setPremium}
              keyboardType="number-pad"
              placeholder="780"
            />
          </View>
        </Row>
      </Card>

      {editId ? (
        <Button title={t('Remove this policy')} variant="ghost" onPress={remove} />
      ) : null}
    </Screen>
  );
}
