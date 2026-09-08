import React from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import type { Alert as AlertT, AlertSource, ReasonKind } from '../api/types';
import {
  Chip,
  ExpandableCard,
  Icon,
  EmptyState,
  ErrorState,
  Reveal,
  Row,
  ScreenHeader,
  SkeletonList,
  Text,
  palette,
  severity as sev,
  space,
} from '../ui';
import type { IconName } from '../ui';

const SOURCE_META: Record<AlertSource, { label: string; icon: IconName; tint: string; soft: string }> = {
  office: { label: 'Extension office', icon: 'scroll', tint: palette.info, soft: palette.skySoft },
  weather: { label: 'Weather', icon: 'weather', tint: palette.info, soft: palette.skySoft },
  forewarning: { label: 'Early warning', icon: 'shield', tint: palette.honey, soft: palette.warnSoft },
  outbreak: { label: 'Outbreak nearby', icon: 'hotspot', tint: palette.danger, soft: palette.dangerSoft },
};

const REASON_ICON: Record<ReasonKind, IconName> = {
  score: 'chart',
  humidity: 'humidity',
  weather: 'cloud',
  stage: 'leaf',
  pest: 'bug',
  history: 'hotspot',
};

export default function AlertsScreen() {
  const nav = useNavigation();
  const alerts = useApi<{ alerts: AlertT[] }>('/api/alerts');
  const list = alerts.data?.alerts ?? [];
  const highN = list.filter((a) => a.severity === 'high').length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        refreshing={alerts.refreshing}
        onRefresh={() => alerts.reload()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 0,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
        ListHeaderComponent={
          <ScreenHeader
            tone="alert"
            title="Alerts"
            subtitle="Weather, pest & disease warnings for your fields, plus notices from your extension office."
            onClose={() => nav.goBack()}
            style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
            stats={
              list.length
                ? [
                    { label: 'Active', value: list.length, icon: 'alerts' },
                    { label: 'High', value: highN, icon: 'warning' },
                  ]
                : undefined
            }
          />
        }
        ListEmptyComponent={
          alerts.loading ? (
            <SkeletonList count={3} />
          ) : alerts.error ? (
            <ErrorState message={alerts.error} onRetry={alerts.reload} />
          ) : (
            <EmptyState
              icon="alerts"
              title="Nothing to flag right now"
              body="When the forecast turns risky, a pest warning builds for your crop, or an outbreak is reported nearby, it shows up here."
            />
          )
        }
        renderItem={({ item, index }) => {
          const s = item.severity as 'low' | 'medium' | 'high' | null;
          const meta = item.source ? SOURCE_META[item.source] : null;
          return (
            <Reveal index={Math.min(index, 6)}>
              <ExpandableCard
                title={item.title}
                icon={meta?.icon ?? 'alerts'}
                accent={meta?.tint ?? palette.coral}
                accentSoft={meta?.soft ?? palette.coralSoft}
                subtitle={meta?.label}
                trailing={s ? <Chip label={s} size="sm" bg={sev[s].bg} color={sev[s].fg} /> : undefined}
              >
                <Text variant="body">{item.message}</Text>

                {item.reasons && item.reasons.length > 0 && (
                  <View
                    style={{
                      gap: 7,
                      marginTop: 2,
                      paddingTop: space.sm,
                      borderTopWidth: 1,
                      borderTopColor: palette.hairline,
                    }}
                  >
                    <Text variant="caption" faint style={{ fontWeight: '700', letterSpacing: 0.4 }}>
                      WHY WE'RE FLAGGING THIS
                    </Text>
                    {item.reasons.map((r, i) => (
                      <Row key={i} gap={8} style={{ alignItems: 'flex-start' }}>
                        <View style={{ paddingTop: 1 }}>
                          <Icon name={REASON_ICON[r.kind]} size={13} color={meta?.tint ?? palette.textMuted} />
                        </View>
                        <Text variant="caption" muted style={{ flex: 1 }}>
                          {r.text}
                        </Text>
                      </Row>
                    ))}
                  </View>
                )}

                <Text variant="caption" faint>
                  {item.match_reason ? `${item.match_reason} · ` : ''}
                  {item.official_name ? `${item.official_name} · ` : ''}
                  {new Date(item.created_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </ExpandableCard>
            </Reveal>
          );
        }}
      />
    </View>
  );
}
