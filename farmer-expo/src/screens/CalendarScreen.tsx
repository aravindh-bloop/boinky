import { alertT } from '../i18n/alert';
import React, { useMemo } from 'react';
import { Alert, SectionList, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import type { CalendarTask } from '../api/types';
import {
  Card,
  Icon,
  EmptyState,
  LoaderScreen,
  ErrorState,
  Row,
  Text,
  Button,
  palette,
  radius,
  space,
  PressableScale,
  haptic,
} from '../ui';
import type { FieldsStackParams } from '../navigation';

type R = RouteProp<FieldsStackParams, 'Calendar'>;

const ICON: Record<string, any> = {
  irrigation: 'irrigate',
  spraying: 'spray',
  fertilizing: 'fertilize',
  scouting: 'scout',
  harvest: 'harvest',
  other: 'calendar',
};

export default function CalendarScreen() {
  const { fieldId } = useRoute<R>().params;
  const { data, loading, error, reload, refreshing } = useApi<{ tasks: CalendarTask[] }>(
    `/api/calendar/${fieldId}`,
  );

  const sections = useMemo(() => {
    const byDate: Record<string, CalendarTask[]> = {};
    for (const t of data?.tasks ?? []) (byDate[t.task_date] ||= []).push(t);
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tasks]) => ({ title: date, data: tasks }));
  }, [data]);

  async function toggle(t: CalendarTask) {
    haptic.tap();
    try {
      await api.request(`/api/calendar/tasks/${t.id}`, { method: 'PATCH', body: { isDone: !t.is_done } });
      reload();
    } catch {
      alertT('Could not update the task');
    }
  }
  async function regenerate() {
    try {
      await api.request(`/api/calendar/${fieldId}/generate`, { method: 'POST' });
      reload();
    } catch (e: any) {
      alertT('Could not generate', e?.message ?? '');
    }
  }

  if (loading) return <LoaderScreen label="Loading calendar" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        refreshing={refreshing}
        onRefresh={reload}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.giant, gap: 6 }}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="No calendar yet"
            body="The calendar is built from your crop and sowing date."
            action={{ label: 'Generate calendar', onPress: regenerate }}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text variant="label" color={palette.primaryDeep} style={{ marginTop: space.lg, marginBottom: space.xs }}>
            {formatDate(section.title)}
          </Text>
        )}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInRight.duration(220).delay(Math.min(index, 6) * 30)}>
            <PressableScale onPress={() => toggle(item)} feedback={false}>
              <View
                style={{
                  flexDirection: 'row',
                  gap: space.md,
                  backgroundColor: palette.surface,
                  borderRadius: radius.lg,
                  padding: space.md,
                  opacity: item.is_done ? 0.5 : 1,
                  borderWidth: 1,
                  borderColor: palette.hairline,
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: radius.md,
                    backgroundColor: item.is_done ? palette.primarySoft : palette.surfaceSunken,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={item.is_done ? 'check' : (ICON[item.task_type ?? 'other'] ?? 'calendar')}
                    size={17}
                    color={item.is_done ? palette.primary : palette.primaryDeep}
                    weight="fill"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" style={item.is_done ? { textDecorationLine: 'line-through' } : undefined}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text variant="caption" muted>
                      {item.description}
                    </Text>
                  ) : null}
                  {item.source !== 'system' && (
                    <Text variant="caption" color={palette.primary}>
                      {item.source === 'user' ? 'added by you' : 'from a scan'}
                    </Text>
                  )}
                </View>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
