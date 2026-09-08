import { alertT } from '../i18n/alert';
import React, { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import type { CalendarTask } from '../api/types';
import {
  Icon,
  EmptyState,
  LoaderScreen,
  ErrorState,
  Text,
  ScreenHeader,
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

const TINT: Record<string, string> = {
  irrigation: palette.sky,
  spraying: palette.iris,
  fertilizing: palette.gold,
  scouting: palette.leaf,
  harvest: palette.gold,
  other: palette.primary,
};

export default function CalendarScreen() {
  const nav = useNavigation<any>();
  const { fieldId, crop } = useRoute<R>().params;
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

  const allTasks = data?.tasks ?? [];
  const doneN = allTasks.filter((t) => t.is_done).length;

  if (loading) return <LoaderScreen label="Loading calendar" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        refreshing={refreshing}
        onRefresh={reload}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: 0,
          paddingBottom: space.giant,
          gap: 6,
        }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <ScreenHeader
            tone="task"
            title="Crop calendar"
            subtitle={crop ? `Planned work for your ${crop.toLowerCase()}` : 'Planned work for this field'}
            onBack={() => nav.goBack()}
            style={{ marginHorizontal: -space.lg, marginBottom: space.sm }}
            stats={
              allTasks.length
                ? [
                    { label: 'Tasks', value: allTasks.length, icon: 'calendar' },
                    { label: 'Done', value: doneN, icon: 'taskDone' },
                  ]
                : undefined
            }
          />
        }
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
                {(() => {
                  const tint = TINT[item.task_type ?? 'other'] ?? palette.primary;
                  return (
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: radius.md,
                        backgroundColor: item.is_done ? palette.primarySoft : `${tint}1F`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name={item.is_done ? 'check' : (ICON[item.task_type ?? 'other'] ?? 'calendar')}
                        size={17}
                        color={item.is_done ? palette.primary : tint}
                        weight="fill"
                      />
                    </View>
                  );
                })()}
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
