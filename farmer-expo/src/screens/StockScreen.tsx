import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  OrganicBackground,
  Reveal,
  Row,
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

export default function StockScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
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
      Alert.alert('Could not add', e?.message ?? '');
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
      <OrganicBackground tint="harvest" height={170 + insets.top} />
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
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <Text variant="hero" color={palette.primaryDeep}>
              Stock & money
            </Text>

            {/* season money */}
            <Reveal>
              <Card elevation="raised">
                <Text variant="label" muted>
                  LAST 6 MONTHS
                </Text>
                <Row between>
                  <MoneyBlock label="Spent" value={f?.totalSpent ?? 0} tint={palette.clay} icon="expense" />
                  <MoneyBlock label="Earned" value={f?.totalRevenue ?? 0} tint={palette.primary} icon="revenue" />
                  <MoneyBlock
                    label="Net"
                    value={f?.net ?? 0}
                    tint={(f?.net ?? 0) >= 0 ? palette.primaryDeep : palette.danger}
                    icon={(f?.net ?? 0) >= 0 ? 'trendUp' : 'trendDown'}
                  />
                </Row>
              </Card>
            </Reveal>

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
        renderItem={({ item, index }) => (
          <Reveal index={Math.min(index, 8)}>
            <Card elevation="flat">
              <Row between>
                <Text variant="subhead">{item.item_name}</Text>
                {item.item_type ? <Chip label={item.item_type} size="sm" bg={palette.surfaceSunken} color={palette.textMuted} /> : null}
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
        )}
      />
    </View>
  );
}

function MoneyBlock({ label, value, tint, icon }: { label: string; value: number; tint: string; icon: any }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Icon name={icon} size={16} color={tint} weight="fill" />
      <Text variant="subhead" color={tint}>
        ₹{compact(value)}
      </Text>
      <Text variant="caption" faint>
        {label}
      </Text>
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
