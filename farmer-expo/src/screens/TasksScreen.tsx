import React from 'react';
import { SectionList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api } from '../api/client';
import type { AggTask, TasksResponse } from '../api/types';
import {
  Icon,
  LoaderScreen,
  ErrorState,
  EmptyState,
  Row,
  ScreenHeader,
  Text,
  PressableScale,
  haptic,
  kindMeta,
  palette,
  radius,
  space,
} from '../ui';

export default function TasksScreen() {
  const nav = useNavigation<any>();
  const { data, loading, error, reload, refreshing } = useApi<TasksResponse>('/api/tasks');

  if (loading) return <LoaderScreen label="Loading tasks" />;
  if (error || !data) return <ErrorState message={error ?? 'No tasks'} onRetry={reload} />;

  const sections = [
    { title: 'Overdue', tint: palette.danger, data: data.overdue },
    { title: 'Today', tint: palette.primary, data: data.today },
    { title: 'This week', tint: palette.textMuted, data: data.upcoming },
  ].filter((s) => s.data.length > 0);

  async function toggle(t: AggTask) {
    haptic.tap();
    await api.request(`/api/calendar/tasks/${t.id}`, { method: 'PATCH', body: { isDone: !t.is_done } });
    reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        refreshing={refreshing}
        onRefresh={reload}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: 0,
          paddingBottom: space.giant,
          gap: 6,
        }}
        ListHeaderComponent={
          <ScreenHeader
            tone="task"
            title="Tasks"
            subtitle="What each field needs, and when."
            onBack={() => nav.goBack()}
            style={{ marginHorizontal: -space.lg, marginBottom: space.sm }}
            stats={[
              { label: 'Overdue', value: data.overdue.length, icon: 'warning' },
              { label: 'Today', value: data.today.length, icon: 'tasks' },
              { label: 'This week', value: data.upcoming.length, icon: 'calendar' },
            ]}
          />
        }
        ListEmptyComponent={
          <EmptyState icon="taskDone" title="All caught up" body="No tasks due. Enjoy the calm." />
        }
        renderSectionHeader={({ section }) => (
          <Text variant="label" color={section.tint} style={{ marginTop: space.lg, marginBottom: space.xs }}>
            {section.title.toUpperCase()} · {section.data.length}
          </Text>
        )}
        renderItem={({ item }) => {
          const km = kindMeta(item.task_type);
          return (
          <PressableScale onPress={() => toggle(item)} feedback={false} style={{ opacity: item.is_done ? 0.5 : 1 }}>
            <View
              style={{
                flexDirection: 'row',
                gap: space.md,
                backgroundColor: palette.surface,
                borderRadius: radius.lg,
                padding: space.md,
                borderWidth: 1,
                borderColor: palette.hairline,
                borderLeftWidth: 3,
                borderLeftColor: item.is_done ? palette.border : km.tint,
              }}
            >
              <PressableScale onPress={() => toggle(item)} compact hitSlop={8}>
                <Icon
                  name={item.is_done ? 'check' : 'circle'}
                  size={24}
                  color={item.is_done ? palette.primary : km.tint}
                  weight={item.is_done ? 'fill' : 'regular'}
                />
              </PressableScale>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={item.is_done ? { textDecorationLine: 'line-through' } : undefined}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text variant="caption" muted numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <Row gap={space.xs} style={{ marginTop: 2 }}>
                  <Icon name="fields" size={12} color={palette.textFaint} />
                  <Text variant="caption" faint>
                    {item.field_name} · {fmtDate(item.task_date)}
                  </Text>
                </Row>
              </View>
              {!item.is_done && (
                <PressableScale
                  onPress={() =>
                    nav.navigate('LogActivity', {
                      fieldId: item.field_id,
                      taskId: item.id,
                      presetKind: item.task_type,
                    })
                  }
                  compact
                >
                  <View style={{ backgroundColor: km.soft, borderRadius: radius.pill, padding: 8 }}>
                    <Icon name={km.icon} size={16} color={km.tint} weight="fill" />
                  </View>
                </PressableScale>
              )}
            </View>
          </PressableScale>
          );
        }}
      />
    </View>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff < 0) return `${-diff}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
