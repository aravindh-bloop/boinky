import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import type { FinanceSummary, InventoryItem } from '../api/types';
import {
  Button,
  Card,
  Chip,
  Icon,
  EmptyState,
  ErrorState,
  Reveal,
  Row,
  ScreenHeader,
  SelectChip,
  SkeletonList,
  Field as Input,
  Text,
  PressableScale,
  haptic,
  palette,
  radius,
  space,
} from '../ui';

const TYPES = ['seed', 'fertilizer', 'pesticide', 'equipment', 'other'];

const TYPE_TINT: Record<string, { bg: string; fg: string }> = {
  seed: { bg: palette.primarySoft, fg: palette.primaryDeep },
  fertilizer: { bg: palette.goldSoft, fg: '#8A6A22' },
  pesticide: { bg: palette.irisSoft, fg: palette.iris },
  equipment: { bg: palette.skySoft, fg: palette.sky },
  other: { bg: palette.surfaceSunken, fg: palette.textMuted },
};

export default function StockScreen() {
  const nav = useNavigation<any>();
  const inv = useApi<{ items: InventoryItem[] }>('/api/inventory');
  const fin = useApi<FinanceSummary>('/api/expenses/summary', { days: 180 });

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('pesticide');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');

  async function add() {
    if (!name.trim()) return;
    try {
      await api.request('/api/inventory', {
        method: 'POST',
        body: { itemName: name.trim(), itemType: type, quantity: qty ? Number(qty) : undefined, unit: unit.trim() || undefined },
      });
      setName('');
      setQty('');
      setUnit('');
      setAdding(false);
      inv.reload();
    } catch (e: any) {
      alertT('Could not add', e?.message ?? '');
    }
  }
  async function adjust(item: InventoryItem, delta: number) {
    haptic.tap();
    await api.request(`/api/inventory/${item.id}`, { method: 'PATCH', body: { quantityDelta: delta } });
    inv.reload();
  }

  const f = fin.data;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FlatList
        data={inv.data?.items ?? []}
        keyExtractor={(x) => x.id}
        refreshing={inv.refreshing}
        onRefresh={() => {
          inv.reload();
          fin.reload();
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 0,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <ScreenHeader
              tone="money"
              title="Stock & money"
              subtitle="Spending, income and what's in the shed — last 6 months."
              style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
              stats={[
                { label: 'Spent', value: `₹${compact(f?.totalSpent ?? 0)}`, icon: 'expense' },
                { label: 'Earned', value: `₹${compact(f?.totalRevenue ?? 0)}`, icon: 'revenue' },
                {
                  label: 'Net',
                  value: `₹${compact(f?.net ?? 0)}`,
                  icon: (f?.net ?? 0) >= 0 ? 'trendUp' : 'trendDown',
                },
              ]}
            />

            <Row gap={space.sm}>
              <View style={{ flex: 1 }}>
                <Button title="Expenses" variant="soft" size="sm" onPress={() => nav.navigate('Expenses')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Harvest" variant="soft" size="sm" onPress={() => nav.navigate('Harvest')} />
              </View>
            </Row>

            <Row between style={{ marginTop: space.sm }}>
              <Text variant="subhead">Inventory</Text>
              {!adding && (
                <PressableScale onPress={() => setAdding(true)}>
                  <Row gap={4}>
                    <Icon name="plus" size={16} color={palette.primary} weight="bold" />
                    <Text variant="label" color={palette.primary}>
                      Add item
                    </Text>
                  </Row>
                </PressableScale>
              )}
            </Row>

            {adding && (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <Card>
                  <Input label="Item name" value={name} onChangeText={setName} placeholder="e.g. Mancozeb 75% WP" />
                  <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
                    {TYPES.map((t) => (
                      <SelectChip key={t} label={t} selected={type === t} onPress={() => setType(t)} />
                    ))}
                  </Row>
                  <Row gap={space.md}>
                    <View style={{ flex: 1 }}>
                      <Input label="Qty" value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label="Unit" value={unit} onChangeText={setUnit} placeholder="kg / L" />
                    </View>
                  </Row>
                  <Button title="Add to inventory" onPress={add} />
                  <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
                </Card>
              </Animated.View>
            )}
          </View>
        }
        ListEmptyComponent={
          inv.loading ? (
            <SkeletonList count={3} />
          ) : inv.error ? (
            <ErrorState message={inv.error} onRetry={inv.reload} />
          ) : (
            <EmptyState icon="stock" title="No stock recorded" body="Track seed, fertiliser and pesticide so you know when to restock." />
          )
        }
        renderItem={({ item, index }) => {
          const tt = TYPE_TINT[item.item_type ?? 'other'] ?? TYPE_TINT.other;
          return (
          <Reveal index={Math.min(index, 8)}>
            <Card elevation="flat" accent={tt.fg}>
              <Row between>
                <Text variant="subhead">{item.item_name}</Text>
                {item.item_type ? <Chip label={item.item_type} size="sm" bg={tt.bg} color={tt.fg} /> : null}
              </Row>
              <Row gap={space.md} style={{ marginTop: space.xs }}>
                <Stepper onPress={() => adjust(item, -1)} name="left" />
                <Text variant="heading">
                  {item.quantity ?? 0}
                  <Text variant="body" muted>
                    {' '}
                    {item.unit ?? ''}
                  </Text>
                </Text>
                <Stepper onPress={() => adjust(item, 1)} name="plus" />
              </Row>
              {item.low_stock && (
                <Row gap={4}>
                  <Icon name="warning" size={13} color={palette.warn} weight="fill" />
                  <Text variant="caption" color={palette.warn}>
                    Low stock
                  </Text>
                </Row>
              )}
              {item.expired ? (
                <Text variant="caption" color={palette.danger}>
                  Expired
                </Text>
              ) : item.expiring_soon ? (
                <Text variant="caption" color={palette.warn}>
                  Expiring soon
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

function Stepper({ onPress, name }: { onPress: () => void; name: any }) {
  return (
    <PressableScale onPress={onPress} compact hitSlop={8}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: palette.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={name} size={16} color={palette.primary} weight="bold" />
      </View>
    </PressableScale>
  );
}

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
};
