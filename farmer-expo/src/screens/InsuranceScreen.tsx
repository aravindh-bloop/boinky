import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { useT } from '../i18n';
import type { ClaimListItem, InsurancePolicy } from '../api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Reveal,
  Row,
  Screen,
  SectionHeader,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<InsuranceStackParams, 'InsuranceHome'>;

export const CLAIM_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: palette.textMuted },
  submitted: { label: 'Submitted', color: palette.info },
  under_review: { label: 'Under review', color: palette.warn },
  surveyor_assigned: { label: 'Surveyor assigned', color: palette.warn },
  approved: { label: 'Approved', color: palette.primary },
  rejected: { label: 'Rejected', color: palette.danger },
  paid: { label: 'Paid', color: palette.success },
};

const CAUSE_LABEL: Record<string, string> = {
  flood: 'Flood',
  drought: 'Drought',
  pest_disease: 'Pest / disease',
  hailstorm: 'Hailstorm',
  cyclone: 'Cyclone',
  fire: 'Fire',
  unseasonal_rain: 'Unseasonal rain',
  frost: 'Frost',
  other: 'Other',
};

const rupee = (n: number | null) =>
  n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function InsuranceScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const policies = useApi<{ policies: InsurancePolicy[] }>('/api/insurance/policies');
  const claims = useApi<{ claims: ClaimListItem[] }>('/api/insurance/claims');

  const pols = policies.data?.policies ?? [];
  const cls = claims.data?.claims ?? [];

  return (
    <Screen
      scroll
      footer={
        <Button
          title={t('File a claim')}
          size="lg"
          disabled={pols.length === 0}
          onPress={() => nav.navigate('FileClaim', {})}
          icon={<Icon name="umbrella" size={18} color="#fff" weight="fill" />}
        />
      }
    >
      <View>
        <Text variant="hero" color={palette.primaryDeep}>{t('Crop insurance')}</Text>
        <Text variant="body" muted>
          {t('Insure a field, and claim with photo evidence if weather or pests damage the crop.')}
        </Text>
      </View>

      {/* policies */}
      <SectionHeader
        title={t('My policies')}
        action={{ label: t('Insure a field'), onPress: () => nav.navigate('Enroll') }}
      />
      {policies.loading ? (
        <Card elevation="flat"><Text variant="body" muted>{t('Loading…')}</Text></Card>
      ) : pols.length === 0 ? (
        <EmptyState
          icon="umbrella"
          title={t('No policies yet')}
          body={t('Enrol a field under a crop-insurance scheme to be able to claim.')}
          action={{ label: t('Insure a field'), onPress: () => nav.navigate('Enroll') }}
        />
      ) : (
        pols.map((p, i) => (
          <Reveal key={p.id} index={i}>
            <Card elevation="flat">
              <Row between>
                <Text variant="subhead">{p.field_name || p.crop}</Text>
                <Chip
                  label={t(p.status)}
                  bg={p.status === 'active' ? palette.successSoft : palette.surfaceSunken}
                  color={p.status === 'active' ? palette.success : palette.textMuted}
                />
              </Row>
              <Text variant="caption" muted>
                {p.crop} · {p.season}
                {p.scheme_title ? ` · ${p.scheme_title.split('(')[0].trim()}` : ''}
              </Text>
              <Row gap={space.lg} style={{ marginTop: space.xs }}>
                <View>
                  <Text variant="overline" color={palette.textFaint}>{t('Sum insured')}</Text>
                  <Text variant="bodyStrong">{rupee(p.sum_insured)}</Text>
                </View>
                <View>
                  <Text variant="overline" color={palette.textFaint}>{t('Premium paid')}</Text>
                  <Text variant="bodyStrong">{rupee(p.premium_paid)}</Text>
                </View>
                {p.claim_count > 0 && (
                  <View>
                    <Text variant="overline" color={palette.textFaint}>{t('Claims')}</Text>
                    <Text variant="bodyStrong">{p.claim_count}</Text>
                  </View>
                )}
              </Row>
            </Card>
          </Reveal>
        ))
      )}

      {/* claims */}
      <SectionHeader title={t('My claims')} style={{ marginTop: space.lg }} />
      {cls.length === 0 ? (
        <Text variant="body" muted style={{ paddingVertical: space.sm }}>
          {t('No claims filed.')}
        </Text>
      ) : (
        cls.map((c, i) => {
          const st = CLAIM_STATUS[c.status] ?? { label: c.status, color: palette.textMuted };
          return (
            <Reveal key={c.id} index={i}>
              <Card onPress={() => nav.navigate('ClaimDetail', { claimId: c.id })} elevation="flat">
                <Row between>
                  <Text variant="subhead">{t(CAUSE_LABEL[c.cause] ?? c.cause)}</Text>
                  <Row gap={5}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
                    <Text variant="caption" color={st.color}>{t(st.label)}</Text>
                  </Row>
                </Row>
                <Text variant="caption" muted>
                  {c.crop} · {c.field_name ?? c.season}
                  {c.incident_date ? ` · ${c.incident_date}` : ''}
                </Text>
                {c.status === 'paid' || c.approved_amount != null ? (
                  <Text variant="caption" color={palette.success}>
                    {t('Payout')}: {rupee(c.approved_amount)}
                  </Text>
                ) : null}
              </Card>
            </Reveal>
          );
        })
      )}
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
