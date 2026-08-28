import React from 'react';
import { FlatList, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import type { Scan } from '../api/types';
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
  radius,
  severity as sev,
  space,
} from '../ui';
import type { HomeStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<HomeStackParams, 'History'>;

export default function HistoryScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refreshing, reload } = useApi<{ scans: Scan[] }>('/api/scans', { limit: 60 });

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="calm" height={150 + insets.top} />
      <FlatList
        data={data?.scans ?? []}
        keyExtractor={(x) => x.id}
        refreshing={refreshing}
        onRefresh={reload}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.sm,
        }}
        ListHeaderComponent={
          <Row between style={{ marginBottom: space.sm }}>
            <Text variant="hero" color={palette.primaryDeep}>
              Scan history
            </Text>
            <PressableScale onPress={() => nav.goBack()} compact>
              <Icon name="close" size={22} color={palette.textMuted} />
            </PressableScale>
          </Row>
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
