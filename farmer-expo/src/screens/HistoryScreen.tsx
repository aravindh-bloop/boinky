import React from 'react';
import { FlatList, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import type { Scan } from '../api/types';
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Reveal,
  Row,
  ScreenHeader,
  SkeletonList,
  Text,
  palette,
  radius,
  severity as sev,
  space,
} from '../ui';
import type { HomeStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<HomeStackParams, 'History'>;

export default function HistoryScreen() {
  const nav = useNavigation<Nav>();
  const { data, loading, error, refreshing, reload } = useApi<{ scans: Scan[] }>('/api/scans', { limit: 60 });
  // A rejected scan means the photo wasn't a plant at all (e.g. pointed at
  // the wrong thing) — nothing was actually diagnosed, so it doesn't belong
  // in a history of diagnoses.
  const scans = (data?.scans ?? []).filter((s) => s.status !== 'rejected');
  const flagged = scans.filter((s) => s.severity === 'high' || s.severity === 'medium').length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FlatList
        data={scans}
        keyExtractor={(x) => x.id}
        refreshing={refreshing}
        onRefresh={reload}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 0,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.sm,
        }}
        ListHeaderComponent={
          <ScreenHeader
            tone="scan"
            title="Scan history"
            subtitle="Every crop photo you've had diagnosed."
            onClose={() => nav.goBack()}
            style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
            stats={
              scans.length
                ? [
                    { label: 'Scans', value: scans.length, icon: 'scan' },
                    { label: 'Needs care', value: flagged, icon: 'disease' },
                  ]
                : undefined
            }
          />
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <EmptyState icon="scan" title="No scans yet" body="Your crop diagnoses will appear here." />
          )
        }
        renderItem={({ item, index }) => {
          const s = item.severity as 'low' | 'medium' | 'high' | null;
          return (
            <Reveal index={Math.min(index, 8)}>
              <Card onPress={() => nav.navigate('ScanResult', { scanId: item.id })} elevation="flat" style={{ flexDirection: 'row', gap: space.md }}>
                <Image source={{ uri: item.image_url }} style={{ width: 60, height: 60, borderRadius: radius.md }} contentFit="cover" transition={150} />
                <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
                  <Text variant="subhead">{item.diagnosis_label ?? '—'}</Text>
                  <Row gap={space.sm}>
                    {s && <Chip label={s} size="sm" bg={sev[s].bg} color={sev[s].fg} />}
                    <Text variant="caption" faint>
                      {item.status.replace(/_/g, ' ')}
                    </Text>
                  </Row>
                  <Text variant="caption" faint>
                    {new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </Card>
            </Reveal>
          );
        }}
      />
    </View>
  );
}
