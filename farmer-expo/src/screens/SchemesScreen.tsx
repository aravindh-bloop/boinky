import React, { useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApi } from '../api/useApi';
import type { Scheme } from '../api/types';
import {
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

export default function SchemesScreen() {
  const insets = useSafeAreaInsets();
  const [forMe, setForMe] = useState<'me' | 'all'>('me');
  const { data, loading, error, refreshing, reload } = useApi<{ schemes: Scheme[] }>('/api/schemes', {
    forMe: forMe === 'me',
  });

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
            <Text variant="hero" color={palette.primaryDeep}>
              Schemes & subsidies
            </Text>
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
              {item.apply_link ? (
                <PressableScale onPress={() => Linking.openURL(item.apply_link!)} style={{ alignSelf: 'flex-start' }}>
                  <Row gap={4}>
                    <Text variant="bodyStrong" color={palette.primary}>
                      Open official page
                    </Text>
                    <Icon name="arrowRight" size={15} color={palette.primary} weight="bold" />
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
