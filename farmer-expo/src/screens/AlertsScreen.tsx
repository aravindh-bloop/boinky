import React from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import type { Alert as AlertT, AlertSource } from '../api/types';
import {
  Card,
  Chip,
  Icon,
  EmptyState,
  ErrorState,
  OrganicBackground,
  Reveal,
  Row,
  SkeletonList,
  Text,
  PressableScale,
  palette,
  severity as sev,
  space,
} from '../ui';
import type { IconName } from '../ui';

const SOURCE_META: Record<AlertSource, { label: string; icon: IconName; tint: string }> = {
  office: { label: 'Extension office', icon: 'scroll', tint: palette.info },
  weather: { label: 'Weather', icon: 'weather', tint: palette.info },
  forewarning: { label: 'Early warning', icon: 'shield', tint: palette.honey },
  outbreak: { label: 'Outbreak nearby', icon: 'hotspot', tint: palette.danger },
};

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const alerts = useApi<{ alerts: AlertT[] }>('/api/alerts');

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="harvest" height={150 + insets.top} />
      <FlatList
        data={alerts.data?.alerts ?? []}
        keyExtractor={(a) => a.id}
        refreshing={alerts.refreshing}
        onRefresh={() => alerts.reload()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: space.xs, marginBottom: space.xs }}>
            <Row between>
              <Text variant="hero" color={palette.primaryDeep}>
                Alerts
              </Text>
              <PressableScale onPress={() => nav.goBack()} compact>
                <Icon name="close" size={22} color={palette.textMuted} />
              </PressableScale>
            </Row>
            <Text variant="body" muted>
              Weather, pest &amp; disease warnings for your fields, and notices from your
              extension office.
            </Text>
          </View>
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
              <Card elevation="raised" accent={meta?.tint}>
                {meta && (
                  <Row gap={6}>
                    <Icon name={meta.icon} size={15} color={meta.tint} weight="fill" />
                    <Text variant="caption" color={meta.tint} style={{ fontWeight: '700' }}>
                      {meta.label}
                    </Text>
                  </Row>
                )}
                <Row between>
                  <Text variant="subhead" style={{ flex: 1 }}>
                    {item.title}
                  </Text>
                  {s && <Chip label={s} size="sm" bg={sev[s].bg} color={sev[s].fg} />}
                </Row>
                <Text variant="body">{item.message}</Text>
                <Text variant="caption" faint>
                  {item.match_reason ? `${item.match_reason} · ` : ''}
                  {item.official_name ? `${item.official_name} · ` : ''}
                  {new Date(item.created_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </Card>
            </Reveal>
          );
        }}
      />
    </View>
  );
}
