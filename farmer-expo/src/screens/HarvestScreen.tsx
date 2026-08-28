import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import type { Field, Harvest } from '../api/types';
import {
  Button,
  Card,
  Icon,
  EmptyState,
  ErrorState,
  Reveal,
  Row,
  SelectChip,
  SkeletonList,
  Field as Input,
  Text,
  PressableScale,
  palette,
  space,
} from '../ui';

export default function HarvestScreen() {
  const list = useApi<{ harvests: Harvest[] }>('/api/harvests', { limit: 100 });
  const fields = useApi<{ fields: Field[] }>('/api/fields');

  const [adding, setAdding] = useState(false);
  const [fieldId, setFieldId] = useState<string | undefined>();
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('quintal');
  const [price, setPrice] = useState('');
  const [buyer, setBuyer] = useState('');

  async function add() {
    if (!qty) return;
    try {
      await api.request('/api/harvests', {
        method: 'POST',
        body: {
          fieldId,
          quantity: Number(qty),
          unit,
          unitPrice: price ? Number(price) : undefined,
          buyer: buyer.trim() || undefined,
        },
      });
      setQty('');
      setPrice('');
      setBuyer('');
      setAdding(false);
      list.reload();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? '');
    }
  }
  async function remove(id: string) {
    await api.request(`/api/harvests/${id}`, { method: 'DELETE' });
    list.reload();
  }

  const totalRevenue = (list.data?.harvests ?? []).reduce((s, h) => s + (h.revenue ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FlatList
        data={list.data?.harvests ?? []}
        keyExtractor={(x) => x.id}
        refreshing={list.refreshing}
        onRefresh={list.reload}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.giant, gap: space.sm }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <Card elevation="raised">
              <Text variant="label" muted>
                TOTAL REVENUE RECORDED
              </Text>
              <Text variant="hero" color={palette.primary}>
                ₹{totalRevenue.toLocaleString('en-IN')}
              </Text>
            </Card>
            {adding ? (
              <Animated.View entering={FadeIn}>
                <Card>
                  {(fields.data?.fields.length ?? 0) > 0 && (
                    <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                      <SelectChip label="No field" selected={!fieldId} onPress={() => setFieldId(undefined)} />
                      {fields.data!.fields.map((fl) => (
                        <SelectChip key={fl.id} label={fl.name || fl.crop} selected={fieldId === fl.id} onPress={() => setFieldId(fl.id)} />
                      ))}
                    </Row>
                  )}
                  <Row gap={space.md}>
                    <View style={{ flex: 1 }}>
                      <Input label="Quantity" value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="12" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row gap={space.xs} style={{ flexWrap: 'wrap', marginTop: 20 }}>
                        {['quintal', 'kg', 'ton', 'bag'].map((u) => (
                          <SelectChip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />
                        ))}
                      </Row>
                    </View>
                  </Row>
                  <Input label="Price per unit (₹)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="7200" />
                  <Input label="Buyer (optional)" value={buyer} onChangeText={setBuyer} placeholder="Local mandi" />
                  <Button title="Save harvest" onPress={add} />
                  <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
                </Card>
              </Animated.View>
            ) : (
              <Button title="Record a harvest" variant="soft" onPress={() => setAdding(true)} />
            )}
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <SkeletonList count={3} />
          ) : list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState icon="harvest" title="No harvests recorded" body="Log what you harvest and sell to see your season's earnings." />
          )
        }
        renderItem={({ item, index }) => (
          <Reveal index={Math.min(index, 8)}>
            <Card elevation="flat" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Icon name="harvest" size={26} color={palette.primary} weight="duotone" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">
                  {item.quantity} {item.unit} {item.crop ?? ''}
                </Text>
                <Text variant="caption" faint>
                  {item.field_name ?? 'no field'} · {fmt(item.harvested_on)}
                  {item.buyer ? ` · ${item.buyer}` : ''}
                </Text>
              </View>
              {item.revenue != null && (
                <Text variant="subhead" color={palette.primary}>
                  ₹{Math.round(item.revenue)}
                </Text>
              )}
              <PressableScale onPress={() => remove(item.id)} compact hitSlop={8}>
                <Icon name="trash" size={16} color={palette.textFaint} />
              </PressableScale>
            </Card>
          </Reveal>
        )}
      />
    </View>
  );
}

const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
