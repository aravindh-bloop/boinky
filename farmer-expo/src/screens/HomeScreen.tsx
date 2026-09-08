import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { useDailyBrief } from '../api/useDailyBrief';
import { api } from '../api/client';
import { useT } from '../i18n';
import type { AggTask, HomeData, InsightCard, Weather } from '../api/types';
import {
  AiBrief,
  Card,
  Icon,
  Reveal,
  Row,
  SkeletonList,
  Text,
  ErrorState,
  PressableScale,
  haptic,
  palette,
  radius,
  space,
  weatherIcon,
} from '../ui';
import type { HomeStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<HomeStackParams, 'HomeMain'>;

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refreshing, reload } = useApi<HomeData>('/api/home');
  const weatherApi = useApi<Weather>(data && !data.weather ? '/api/weather' : null);
  const briefApi = useDailyBrief();

  const openInsight = React.useCallback(
    (c: InsightCard) => {
      const field = c.fieldName ? data?.fieldRisk.find((f) => f.name === c.fieldName) : undefined;
      switch (c.action) {
        case 'open_field':
          if (field) nav.navigate('FieldDetail', { fieldId: field.id });
          else nav.navigate('Tasks');
          break;
        case 'open_tasks':
          nav.navigate('Tasks');
          break;
        case 'open_weather':
          nav.navigate('Weather', field ? { fieldId: field.id } : undefined);
          break;
        case 'open_scan':
          nav.navigate('History');
          break;
        case 'open_alerts':
          nav.navigate('Alerts');
          break;
        case 'open_stock':
          nav.getParent()?.navigate('Stock' as never);
          break;
        case 'open_schemes':
          nav.getParent()?.navigate('Schemes' as never);
          break;
        default:
          break;
      }
    },
    [data, nav],
  );

  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: palette.canvas, paddingTop: insets.top + 72, paddingHorizontal: space.lg }}>
        <SkeletonList count={4} />
      </View>
    );
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  const d = data;
  const lw = weatherApi.data;
  const w =
    d.weather ??
    (lw
      ? { place: lw.place.label, current: lw.current, today: lw.daily[0] ?? null }
      : null);

  const alerts = d.alerts.count + (d.nearbyOutbreaks?.count ?? 0);
  const todo = d.tasks.today.filter((x) => !x.is_done);

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.lg,
          paddingBottom: space.xxl,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
      >
        {/* header */}
        <Row between style={{ alignItems: 'flex-start' }}>
          <View>
            <Text variant="label" faint>
              {greeting()}
            </Text>
            <Text variant="hero" raw color={palette.text} style={{ marginTop: 2 }}>
              {d.user.name?.split(' ')[0] ?? t('there')}
            </Text>
          </View>
          <Row gap={space.sm}>
            <PressableScale onPress={() => nav.navigate('Ask')} compact>
              <View style={hs.chip}>
                <Icon name="ai" size={15} color={palette.primaryDeep} weight="fill" />
                <Text variant="label" color={palette.primaryDeep}>
                  {t('Ask')}
                </Text>
              </View>
            </PressableScale>
            <PressableScale onPress={() => nav.navigate('Profile')} compact>
              <View style={hs.avatar}>
                <Text variant="subhead" color="#fff" raw>
                  {(d.user.name?.[0] ?? 'F').toUpperCase()}
                </Text>
              </View>
            </PressableScale>
          </Row>
        </Row>

        {/* the brief */}
        <AiBrief
          brief={briefApi.brief}
          loading={briefApi.loading}
          working={briefApi.working}
          onRefresh={briefApi.refresh}
          onAction={openInsight}
        />

        {/* weather + status, one slim row */}
        {w && (
          <Reveal>
            <Card elevation="raised" onPress={() => nav.navigate('Weather')}>
              <Row between>
                <Row gap={space.sm} style={{ alignItems: 'center', flex: 1 }}>
                  <Icon name={weatherIcon(w.current.code, w.current.isDay)} size={28} color={palette.primary} weight="fill" />
                  <View>
                    <Text variant="bodyStrong" raw color={palette.text}>
                      {Math.round(w.current.tempC ?? 0)}°  ·  {w.current.condition}
                    </Text>
                    <Text variant="caption" faint raw numberOfLines={1}>
                      {w.place ?? t('your field')}
                      {w.today ? `  ·  H ${Math.round(w.today.tempMaxC ?? 0)}° L ${Math.round(w.today.tempMinC ?? 0)}°` : ''}
                    </Text>
                  </View>
                </Row>
                <Row gap={space.xs}>
                  {d.tasks.overdueCount > 0 && (
                    <StatusPill
                      value={d.tasks.overdueCount}
                      tint={palette.honey}
                      onPress={() => nav.navigate('Tasks')}
                    />
                  )}
                  {alerts > 0 && (
                    <StatusPill value={alerts} tint={palette.danger} onPress={() => nav.navigate('Alerts')} />
                  )}
                </Row>
              </Row>
            </Card>
          </Reveal>
        )}

        {/* today's tasks — compact */}
        <Reveal index={1}>
          <Card elevation="raised">
            <Row between>
              <Text variant="overline">{t('To do today')}</Text>
              <PressableScale onPress={() => nav.navigate('Tasks')} compact>
                <Text variant="label" color={palette.primary}>
                  {t('All tasks')}
                </Text>
              </PressableScale>
            </Row>
            {todo.length === 0 ? (
              <Text variant="caption" muted>
                {d.tasks.upcomingCount > 0
                  ? t('Nothing due today. {n} coming up this week.', { n: d.tasks.upcomingCount })
                  : t('Nothing due today.')}
              </Text>
            ) : (
              <View style={{ gap: 2, marginTop: 2 }}>
                {todo.slice(0, 3).map((task) => (
                  <TaskRow key={task.id} task={task} onDone={reload} />
                ))}
                {todo.length > 3 && (
                  <PressableScale onPress={() => nav.navigate('Tasks')} compact style={{ paddingVertical: 4 }}>
                    <Text variant="caption" color={palette.primary}>
                      + {todo.length - 3} {t('more')}
                    </Text>
                  </PressableScale>
                )}
              </View>
            )}
          </Card>
        </Reveal>

        {/* recent scans */}
        {d.recentScans.length > 0 && (
          <Reveal index={2}>
            <View style={{ gap: space.sm }}>
              <Row between>
                <Text variant="overline">{t('Recent scans')}</Text>
                <PressableScale onPress={() => nav.navigate('History')} compact>
                  <Text variant="label" color={palette.primary}>
                    {t('History')}
                  </Text>
                </PressableScale>
              </Row>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {d.recentScans.map((s) => (
                  <PressableScale key={s.id} onPress={() => nav.navigate('ScanResult', { scanId: s.id })} compact>
                    <View style={{ width: 96, gap: 4 }}>
                      <Image
                        source={{ uri: s.image_url }}
                        style={{ width: 96, height: 96, borderRadius: radius.lg }}
                        contentFit="cover"
                      />
                      <Text variant="caption" numberOfLines={1} raw>
                        {s.diagnosis_label ?? '—'}
                      </Text>
                    </View>
                  </PressableScale>
                ))}
              </ScrollView>
            </View>
          </Reveal>
        )}
      </ScrollView>
    </View>
  );
}

function TaskRow({ task, onDone }: { task: AggTask; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const toggle = async () => {
    setBusy(true);
    haptic.tap();
    try {
      await api.request(`/api/calendar/tasks/${task.id}`, { method: 'PATCH', body: { isDone: true } });
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <PressableScale onPress={toggle} feedback={false} disabled={busy}>
      <Row gap={space.sm} style={{ paddingVertical: 6 }}>
        <Icon name="circle" size={18} color={palette.borderStrong} />
        <Text variant="body" style={{ flex: 1 }} numberOfLines={1} raw>
          {task.title}
        </Text>
        {task.field_name ? (
          <Text variant="caption" faint raw numberOfLines={1}>
            {task.field_name}
          </Text>
        ) : null}
      </Row>
    </PressableScale>
  );
}

function StatusPill({ value, tint, onPress }: { value: number; tint: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} compact>
      <View
        style={{
          minWidth: 26,
          height: 26,
          borderRadius: radius.pill,
          paddingHorizontal: 8,
          backgroundColor: tint + '22',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="label" color={tint} raw>
          {String(value)}
        </Text>
      </View>
    </PressableScale>
  );
}

const hs = {
  chip: {
    height: 36,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: palette.primarySoft,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
