import React from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import type { Alert as AlertT, NearbyOutbreaks } from '../api/types';
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

export default function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const alerts = useApi<{ alerts: AlertT[] }>('/api/alerts');
  const nearby = useApi<NearbyOutbreaks>('/api/hotspots/nearby');
  const n = nearby.data;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="harvest" height={150 + insets.top} />
      <FlatList
        data={alerts.data?.alerts ?? []}
        keyExtractor={(a) => a.id}
        refreshing={alerts.refreshing}
        onRefresh={() => {
          alerts.reload();
          nearby.reload();
        }}
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
                Alerts
              </Text>
              <PressableScale onPress={() => nav.goBack()} compact>
                <Icon name="close" size={22} color={palette.textMuted} />
              </PressableScale>
            </Row>
            {n && n.count > 0 && (
              <Reveal from="scale">
                <Card accent={palette.warn}>
                  <Row gap={space.sm}>
                    <Icon name="hotspot" size={20} color={palette.warn} weight="fill" />
                    <Text variant="subhead" style={{ flex: 1 }}>
                      Outbreaks near you
                    </Text>
                  </Row>
                  <Text variant="body">
                    {n.count} confirmed case{n.count > 1 ? 's' : ''} within {n.radiusKm} km
                    {n.nearestKm != null ? `, nearest ${n.nearestKm} km away` : ''}.
                  </Text>
                  {n.topDiagnoses.map((d) => (
                    <Text key={d.label ?? 'x'} variant="caption" muted>
                      • {d.label} ({d.count})
                    </Text>
                  ))}
                </Card>
              </Reveal>
            )}
          </View>
        }
        ListEmptyComponent={
          alerts.loading ? (
            <SkeletonList count={3} />
          ) : alerts.error ? (
            <ErrorState message={alerts.error} onRetry={alerts.reload} />
          ) : (
            <EmptyState icon="alerts" title="No advisories" body="Alerts from your extension office will show up here." />
          )
        }
        renderItem={({ item, index }) => {
          const s = item.severity as 'low' | 'medium' | 'high' | null;
          return (
            <Reveal index={Math.min(index, 6)}>
              <Card elevation="raised">
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
                  {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </Text>
              </Card>
            </Reveal>
          );
        }}
      />
    </View>
  );
}
