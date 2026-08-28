import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import type { Expense, Field, FinanceSummary } from '../api/types';
import {
  Button,
  Card,
  Chip,
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
  radius,
  space,
} from '../ui';

const CATS = ['seed', 'fertilizer', 'pesticide', 'labour', 'machinery', 'irrigation', 'transport', 'other'];

export default function ExpensesScreen() {
  const list = useApi<{ expenses: Expense[] }>('/api/expenses', { limit: 100 });
  const sum = useApi<FinanceSummary>('/api/expenses/summary', { days: 365 });
  const fields = useApi<{ fields: Field[] }>('/api/fields');

  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState('seed');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [fieldId, setFieldId] = useState<string | undefined>();

  async function add() {
    if (!amount) return;
    try {
      await api.request('/api/expenses', {
        method: 'POST',
        body: { category: cat, amount: Number(amount), description: desc.trim() || undefined, fieldId },
      });
      setAmount('');
      setDesc('');
      setAdding(false);
      list.reload();
      sum.reload();
    } catch (e: any) {
      Alert.alert('Could not add', e?.message ?? '');
    }
  }
  async function remove(id: string) {
    await api.request(`/api/expenses/${id}`, { method: 'DELETE' });
    list.reload();
    sum.reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FlatList
        data={list.data?.expenses ?? []}
        keyExtractor={(x) => x.id}
        refreshing={list.refreshing}
        onRefresh={() => {
          list.reload();
          sum.reload();
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.giant, gap: space.sm }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <Card elevation="raised">
              <Text variant="label" muted>
                SPENT THIS YEAR
              </Text>
              <Text variant="hero" color={palette.clay}>
                ₹{(sum.data?.totalSpent ?? 0).toLocaleString('en-IN')}
              </Text>
              <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
                {(sum.data?.byCategory ?? []).slice(0, 5).map((c) => (
                  <Chip key={c.category} label={`${c.category} ₹${Math.round(c.amount)}`} size="sm" bg={palette.claySoft} color={palette.soil} />
                ))}
              </Row>
            </Card>

            {adding ? (
              <Animated.View entering={FadeIn}>
                <Card>
                  <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
                    {CATS.map((c) => (
                      <SelectChip key={c} label={c} selected={cat === c} onPress={() => setCat(c)} />
                    ))}
                  </Row>
                  <Input label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="1500" />
                  <Input label="Note (optional)" value={desc} onChangeText={setDesc} placeholder="e.g. 3 labourers, weeding" />
                  {(fields.data?.fields.length ?? 0) > 0 && (
                    <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                      <SelectChip label="No field" selected={!fieldId} onPress={() => setFieldId(undefined)} />
                      {fields.data!.fields.map((fl) => (
                        <SelectChip key={fl.id} label={fl.name || fl.crop} selected={fieldId === fl.id} onPress={() => setFieldId(fl.id)} />
                      ))}
                    </Row>
                  )}
                  <Button title="Save expense" onPress={add} />
                  <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
                </Card>
              </Animated.View>
            ) : (
              <Button title="Add expense" variant="soft" onPress={() => setAdding(true)} />
            )}
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <SkeletonList count={4} />
          ) : list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState icon="expense" title="No expenses yet" body="Record input costs to see your true cost of cultivation." />
          )
        }
        renderItem={({ item, index }) => (
          <Reveal index={Math.min(index, 8)}>
            <Card elevation="flat" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{item.description || cap(item.category)}</Text>
                <Text variant="caption" faint>
                  {item.category} · {item.field_name ?? 'no field'} · {fmt(item.spent_on)}
                </Text>
              </View>
              <Text variant="subhead" color={palette.clay}>
                ₹{Math.round(item.amount)}
              </Text>
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
