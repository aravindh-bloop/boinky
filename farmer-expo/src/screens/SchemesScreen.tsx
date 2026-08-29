import React, { useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { alertT } from '../i18n/alert';
import type { Scheme, SchemeApplication } from '../api/types';
import {
  Button,
  Card,
  Chip,
  Icon,
  ErrorState,
  EmptyState,
  OrganicBackground,
  Reveal,
  Row,
  SegmentedControl,
  SkeletonList,
  Text,
  palette,
  space,
  PressableScale,
} from '../ui';

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Applied — submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Not approved',
  disbursed: 'Received',
};
const STATUS_COLOR: Record<string, string> = {
  submitted: palette.textMuted,
  under_review: palette.info,
  approved: palette.primary,
  rejected: palette.danger,
  disbursed: palette.success,
};

export default function SchemesScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const [forMe, setForMe] = useState<'me' | 'all'>('me');
  const [applying, setApplying] = useState<string | null>(null);
  const { data, loading, error, refreshing, reload } = useApi<{ schemes: Scheme[] }>('/api/schemes', {
    forMe: forMe === 'me',
  });
  const applied = useApi<{ applications: SchemeApplication[] }>('/api/schemes/applications');
  const byScheme = new Map((applied.data?.applications ?? []).map((a) => [a.scheme_id, a]));

  async function apply(scheme: Scheme) {
    setApplying(scheme.id);
    try {
      await api.request(`/api/schemes/${scheme.id}/apply`, { method: 'POST', body: {} });
      alertT('Application sent', 'Your extension officer will review it. Track it under "My schemes".');
      applied.reload();
    } catch (e) {
      alertT('Could not apply', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setApplying(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="calm" height={150 + insets.top} />
      <FlatList
        data={data?.schemes ?? []}
        keyExtractor={(x) => x.id}
        refreshing={refreshing}
        onRefresh={reload}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <Row between>
              <Text variant="hero" color={palette.primaryDeep}>
                Schemes & subsidies
              </Text>
              <PressableScale onPress={() => nav.navigate('MySchemes')} compact>
                <Row gap={4}>
                  <Icon name="scroll" size={16} color={palette.primary} weight="fill" />
                  <Text variant="label" color={palette.primary}>
                    My schemes
                  </Text>
                </Row>
              </PressableScale>
            </Row>
            <SegmentedControl
              value={forMe}
              onChange={setForMe}
              options={[
                { value: 'me', label: 'For me' },
                { value: 'all', label: 'All schemes' },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <EmptyState icon="schemes" title="Nothing here" body="No matching schemes right now." />
          )
        }
        renderItem={({ item, index }) => (
          <Reveal index={Math.min(index, 8)}>
            <Card elevation="flat">
              <Text variant="subhead">{item.title}</Text>
              {item.match_reasons?.length ? (
                <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
                  {item.match_reasons.map((r) => (
                    <Chip key={r} label={r} size="sm" bg={palette.leafSoft} color={palette.primaryDeep} />
                  ))}
                </Row>
              ) : null}
              {item.description ? (
                <Text variant="body" muted>
                  {item.description}
                </Text>
              ) : null}
              {item.benefit_amount ? (
                <Row gap={space.xs}>
                  <Icon name="money" size={16} color={palette.primaryDeep} weight="fill" />
                  <Text variant="bodyStrong" color={palette.primaryDeep}>
                    {item.benefit_amount}
                  </Text>
                </Row>
              ) : null}
              {(() => {
                const app = byScheme.get(item.id);
                return app ? (
                  <Row gap={6} style={{ marginTop: space.xs }}>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: STATUS_COLOR[app.status] ?? palette.textMuted,
                      }}
                    />
                    <Text variant="caption" color={STATUS_COLOR[app.status] ?? palette.textMuted}>
                      {STATUS_LABEL[app.status] ?? app.status}
                      {app.status === 'disbursed' && app.amount
                        ? ` · ₹${Math.round(app.amount).toLocaleString('en-IN')}`
                        : ''}
                    </Text>
                  </Row>
                ) : (
                  <Row gap={space.sm} style={{ marginTop: space.xs, flexWrap: 'wrap' }}>
                    <View style={{ minWidth: 130 }}>
                      <Button
                        title="Apply for this"
                        size="sm"
                        variant="soft"
                        loading={applying === item.id}
                        onPress={() => apply(item)}
                      />
                    </View>
                    <PressableScale
                      onPress={() =>
                        nav.navigate('SchemeThread', { schemeId: item.id, schemeTitle: item.title })
                      }
                      compact
                    >
                      <Row gap={4} style={{ paddingVertical: 8 }}>
                        <Icon name="alerts" size={14} color={palette.textMuted} />
                        <Text variant="caption" muted>
                          Ask a question
                        </Text>
                      </Row>
                    </PressableScale>
                  </Row>
                );
              })()}
              {item.apply_link ? (
                <PressableScale onPress={() => Linking.openURL(item.apply_link!)} style={{ alignSelf: 'flex-start' }}>
                  <Row gap={4}>
                    <Text variant="caption" color={palette.textMuted}>
                      Official page
                    </Text>
                    <Icon name="arrowRight" size={13} color={palette.textMuted} />
                  </Row>
                </PressableScale>
              ) : null}
            </Card>
          </Reveal>
        )}
      />
    </View>
  );
}
