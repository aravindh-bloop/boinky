import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { useT } from '../i18n';
import type { ClaimTrackListItem, MyEscalation, PolicyRef } from '../api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  PressableScale,
  Reveal,
  Row,
  ScreenHeader,
  SkeletonList,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';
import { stageLabel, slaBadge } from './insuranceShared';

type Nav = NativeStackNavigationProp<InsuranceStackParams, 'InsuranceHome'>;

export default function InsuranceScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const pols = useApi<{ policies: PolicyRef[] }>('/api/insurance/policies');
  const claims = useApi<{ claims: ClaimTrackListItem[] }>('/api/insurance/claims');
  const escs = useApi<{ escalations: MyEscalation[] }>('/api/insurance/escalations');

  const policies = pols.data?.policies ?? [];
  const claimList = claims.data?.claims ?? [];
  const openEsc = (escs.data?.escalations ?? []).filter(
    (e) => e.status !== 'resolved' && e.status !== 'closed',
  );
  const loading = pols.loading && claims.loading;

  const reload = () => {
    pols.reload();
    claims.reload();
    escs.reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: space.giant }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={pols.refreshing || claims.refreshing}
              onRefresh={reload}
              tintColor="#fff"
            />
          }
        >
          <ScreenHeader
            tone="weather"
            title={t('Crop insurance')}
            subtitle={t('Track your PMFBY claim and escalate it if it gets stuck.')}
            stats={
              policies.length
                ? [
                    { label: t('Policies'), value: policies.length, icon: 'umbrella' },
                    { label: t('Claims'), value: claimList.length, icon: 'scroll' },
                    { label: t('Escalations'), value: openEsc.length, icon: 'alerts' },
                  ]
                : undefined
            }
          />

          <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
            {loading ? (
              <SkeletonList count={3} />
            ) : pols.error ? (
              <ErrorState message={pols.error} onRetry={reload} />
            ) : policies.length === 0 ? (
              <EmptyState
                icon="umbrella"
                title={t('Add your PMFBY policy')}
                body={t(
                  'Enter the policy from your crop-insurance acknowledgement slip or SMS. Then you can track a claim through every stage and escalate it if it stalls.',
                )}
                action={{ label: t('Add a policy'), onPress: () => nav.navigate('PolicyForm') }}
              />
            ) : (
              <>
                {/* tracked claims first — they need attention */}
                {claimList.length > 0 && (
                  <View style={{ gap: space.sm }}>
                    <Text variant="overline">{t('Tracked claims')}</Text>
                    {claimList.map((c, i) => (
                      <Reveal key={c.id} index={Math.min(i, 5)}>
                        <ClaimRow claim={c} t={t} onPress={() => nav.navigate('ClaimTrack', { claimId: c.id })} />
                      </Reveal>
                    ))}
                  </View>
                )}

                {/* policies */}
                <Row between style={{ marginTop: claimList.length ? space.sm : 0 }}>
                  <Text variant="overline">{t('My policies')}</Text>
                  <PressableScale onPress={() => nav.navigate('PolicyForm')} compact>
                    <Row gap={4}>
                      <Icon name="plus" size={14} color={palette.primary} weight="bold" />
                      <Text variant="label" color={palette.primary}>
                        {t('Add')}
                      </Text>
                    </Row>
                  </PressableScale>
                </Row>
                {policies.map((p, i) => {
                  const claim = claimList.find((c) => c.policy_ref_id === p.id);
                  return (
                    <Reveal key={p.id} index={Math.min(i, 5)}>
                      <PolicyCard
                        policy={p}
                        hasClaim={!!claim}
                        t={t}
                        onTrack={() =>
                          claim
                            ? nav.navigate('ClaimTrack', { claimId: claim.id })
                            : nav.navigate('StartClaim', { policyRefId: p.id })
                        }
                        onEdit={() => nav.navigate('PolicyForm', { policyId: p.id })}
                      />
                    </Reveal>
                  );
                })}

                <Text variant="caption" faint style={{ marginTop: space.sm }}>
                  {t(
                    'AgriPod does not decide or pay claims — that is the government pipeline. It tracks yours and helps you push it forward.',
                  )}
                </Text>
              </>
            )}
          </View>
        </ScrollView>
    </View>
  );
}

function ClaimRow({
  claim,
  t,
  onPress,
}: {
  claim: ClaimTrackListItem;
  t: ReturnType<typeof useT>;
  onPress: () => void;
}) {
  const badge = slaBadge(claim.clock, claim.outcome, t);
  return (
    <PressableScale onPress={onPress} style={[cardStyle, { borderLeftWidth: 3, borderLeftColor: badge.color }]}>
      <Row between>
        <Text variant="subhead" raw>
          {t(claim.cause.replace('_', ' / '))} · {claim.crop}
        </Text>
        <Chip label={badge.label} size="sm" bg={badge.soft} color={badge.color} />
      </Row>
      <Row between style={{ marginTop: 2 }}>
        <Text variant="caption" muted raw>
          {t('Stage')}: {stageLabel(claim.stage, t)}
        </Text>
        <Icon name="right" size={14} color={palette.textFaint} />
      </Row>
    </PressableScale>
  );
}

function PolicyCard({
  policy,
  hasClaim,
  t,
  onTrack,
  onEdit,
}: {
  policy: PolicyRef;
  hasClaim: boolean;
  t: ReturnType<typeof useT>;
  onTrack: () => void;
  onEdit: () => void;
}) {
  return (
    <Card elevation="flat" accent={palette.sky}>
      <Row between>
        <Row gap={space.sm} style={{ flex: 1 }}>
          <Icon name="umbrella" size={16} color={palette.sky} weight="fill" />
          <Text variant="subhead" raw numberOfLines={1}>
            {policy.crop} · {policy.season}
          </Text>
        </Row>
        <PressableScale onPress={onEdit} compact hitSlop={8}>
          <Icon name="gear" size={15} color={palette.textFaint} />
        </PressableScale>
      </Row>
      <Text variant="caption" muted raw>
        {[
          policy.insurer_name,
          policy.application_no ? `#${policy.application_no}` : null,
          policy.sum_insured ? `${t('Sum insured')} ₹${policy.sum_insured.toLocaleString('en-IN')}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {policy.district ? (
        <Row gap={4}>
          <Icon name="hotspot" size={11} color={palette.textFaint} weight="fill" />
          <Text variant="caption" faint raw>
            {policy.district}
          </Text>
        </Row>
      ) : null}
      <View style={{ marginTop: space.xs }}>
        <Button
          title={hasClaim ? t('Open the claim') : t('Track a claim')}
          size="sm"
          variant={hasClaim ? 'primary' : 'soft'}
          onPress={onTrack}
        />
      </View>
    </Card>
  );
}

const cardStyle = {
  backgroundColor: palette.surface,
  borderRadius: radius.xl,
  borderWidth: 1,
  borderColor: palette.hairline,
  padding: space.md,
};
