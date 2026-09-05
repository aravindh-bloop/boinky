import { alertT } from '../i18n/alert';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useT } from '../i18n';
import type { Field, InsuranceScheme } from '../api/types';
import {
  Button,
  Card,
  Field as TextField,
  Row,
  Screen,
  SelectChip,
  Stagger,
  Text,
  palette,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<InsuranceStackParams, 'Enroll'>;

function currentSeason(): string {
  const m = new Date().getMonth(); // 0-11
  const y = new Date().getFullYear();
  // Kharif Jun-Oct, Rabi Nov-Mar, Zaid Apr-May
  if (m >= 5 && m <= 9) return `Kharif ${y}`;
  if (m >= 10 || m <= 2) return `Rabi ${m >= 10 ? y : y - 1}`;
  return `Zaid ${y}`;
}

export default function InsuranceEnrollScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const { data: fieldsData } = useApi<{ fields: Field[] }>('/api/fields');
  const { data: schemesData } = useApi<{ schemes: InsuranceScheme[] }>('/api/insurance/schemes');
  const fields = fieldsData?.fields ?? [];
  const schemes = schemesData?.schemes ?? [];

  const [fieldId, setFieldId] = useState<string | undefined>(fields[0]?.id);
  const [schemeId, setSchemeId] = useState<string | undefined>();
  const [season, setSeason] = useState(currentSeason());
  const [sumInsured, setSumInsured] = useState('');
  const [premium, setPremium] = useState('');
  const [busy, setBusy] = useState(false);

  const field = useMemo(() => fields.find((f) => f.id === fieldId), [fields, fieldId]);

  async function save() {
    if (!field) return alertT('Pick a field');
    setBusy(true);
    try {
      await api.request('/api/insurance/policies', {
        method: 'POST',
        body: {
          fieldId: field.id,
          schemeId,
          crop: field.crop,
          season: season.trim(),
          sumInsured: sumInsured ? Number(sumInsured) : undefined,
          premiumPaid: premium ? Number(premium) : undefined,
          areaAcres: field.area_acres ?? undefined,
        },
      });
      nav.goBack();
    } catch (e) {
      alertT('Could not enrol', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title={t('Enrol this field')} onPress={save} loading={busy} size="lg" />}>
      <Stagger>
        <Card>
          <Text variant="subhead">{t('Which field?')}</Text>
          <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
            {fields.map((f) => (
              <SelectChip
                key={f.id}
                label={`${f.name || f.crop}`}
                selected={fieldId === f.id}
                onPress={() => setFieldId(f.id)}
              />
            ))}
          </Row>
          {field && (
            <Text variant="caption" faint style={{ marginTop: space.xs }}>
              {field.crop}
              {field.area_acres ? ` · ${field.area_acres} ${t('acres')}` : ''}
              {field.district ? ` · ${field.district}` : ''}
            </Text>
          )}
        </Card>

        <Card>
          <Text variant="subhead">{t('Scheme')}</Text>
          <View style={{ gap: space.xs, marginTop: space.xs }}>
            {schemes.map((s) => (
              <SelectChip
                key={s.id}
                label={s.title.split('(')[0].trim()}
                selected={schemeId === s.id}
                onPress={() => setSchemeId(schemeId === s.id ? undefined : s.id)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <TextField label={t('Season')} value={season} onChangeText={setSeason} placeholder="Kharif 2026" />
          <Row gap={space.md}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('Sum insured (₹)')}
                value={sumInsured}
                onChangeText={setSumInsured}
                keyboardType="number-pad"
                placeholder="45000"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('Premium paid (₹)')}
                value={premium}
                onChangeText={setPremium}
                keyboardType="number-pad"
                placeholder="900"
              />
            </View>
          </Row>
          <Text variant="caption" faint>
            {t('The sum insured is usually the scale of finance for your crop and area. Your district office can confirm it.')}
          </Text>
        </Card>
      </Stagger>
    </Screen>
  );
}
