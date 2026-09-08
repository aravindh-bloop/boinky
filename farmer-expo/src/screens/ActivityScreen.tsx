import React from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import type { Activity } from '../api/types';
import {
  Button,
  Card,
  Icon,
  EmptyState,
  ErrorState,
  Reveal,
  Row,
  ScreenHeader,
  SkeletonList,
  Text,
  kindMeta,
  palette,
  radius,
  space,
} from '../ui';

export default function ActivityScreen() {
  const nav = useNavigation<any>();
  const { data, loading, error, refreshing, reload } = useApi<{ activities: Activity[] }>('/api/activities', {
    limit: 60,
  });

  const acts = data?.activities ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FlatList
        data={acts}
        keyExtractor={(a) => a.id}
        refreshing={refreshing}
        onRefresh={reload}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: 0,
          paddingBottom: space.giant,
          gap: space.sm,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.sm }}>
            <ScreenHeader
              tone="crop"
              title="Activity log"
              subtitle="Your running record of everything done on the farm."
              onBack={() => nav.goBack()}
              style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
              stats={acts.length ? [{ label: 'Logged', value: acts.length, icon: 'activity' }] : undefined}
            />
            <Button title="Log an activity" variant="soft" onPress={() => nav.navigate('LogActivity')} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <EmptyState icon="activity" title="No activity yet" body="Log irrigation, spraying, fertilising and more to build your farm record." />
          )
        }
        renderItem={({ item, index }) => {
          const km = kindMeta(item.kind);
          return (
            <Reveal index={Math.min(index, 8)}>
              <Card elevation="flat" accent={km.tint} style={{ flexDirection: 'row', gap: space.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: km.soft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={km.icon} size={20} color={km.tint} weight="fill" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{item.title}</Text>
                  <Text variant="caption" faint>
                    {item.field_name ?? 'no field'} · {fmt(item.activity_date)}
                    {item.quantity ? ` · ${item.quantity}${item.unit ?? ''}` : ''}
                  </Text>
                  {item.note ? (
                    <Text variant="caption" muted numberOfLines={2}>
                      {item.note}
                    </Text>
                  ) : null}
                </View>
                {item.cost ? (
                  <Text variant="bodyStrong" color={palette.coral}>
                    ₹{Math.round(item.cost)}
                  </Text>
                ) : null}
              </Card>
            </Reveal>
          );
        }}
      />
    </View>
  );
}

const fmt = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
