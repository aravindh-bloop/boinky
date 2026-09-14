import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
  FloatingBubbles,
  Icon,
  Reveal,
  Row,
  SkeletonList,
  Text,
  ErrorState,
  PressableScale,
  gradients,
  haptic,
  palette,
  radius,
  severity as sev,
  shadow,
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

  // The greeting, "X min ago" labels and the weather card are all computed
  // at render time — nothing re-renders this screen on its own while it
  // sits open, so they'd otherwise freeze the moment it mounts. Tick once a
  // minute to keep the clock-driven bits honest, and quietly revalidate the
  // weather/home data every few minutes so the temperature doesn't go stale
  // during a long session.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const clock = setInterval(() => tick((n) => n + 1), 60_000);
    const refresh = setInterval(() => {
      reload();
      weatherApi.reload();
    }, 5 * 60_000);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <View style={{ flex: 1, backgroundColor: palette.canvas, paddingTop: insets.top + 100, paddingHorizontal: space.lg }}>
        <SkeletonList count={4} />
      </View>
    );
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  const d = data;
  const lw = weatherApi.data;
  const w =
    d.weather ??
    (lw
      ? {
          place: lw.place.label,
          current: lw.current,
          today: lw.daily[0] ?? null,
          topAdvisory: lw.advisories[0] ?? null,
          advisoryCount: lw.advisories.length,
          sprayWindow: lw.sprayWindow,
        }
      : null);

  const outbreaks = d.nearbyOutbreaks?.count ?? 0;
  const alertsN = d.alerts.count + outbreaks;
  const todo = d.tasks.today.filter((x) => !x.is_done);
  const fields = d.fieldRisk;
  const hi = d.highestRisk;
  const hiLvl = hi?.riskLevel ?? 'low';
  const attention = (hi && (hiLvl === 'medium' || hiLvl === 'high')) || alertsN > 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FloatingBubbles />
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor="#fff" />}
      >
        {/* ── hero ── */}
        <LinearGradient
          colors={gradients.home}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            paddingTop: insets.top + space.md,
            paddingHorizontal: space.lg,
            paddingBottom: space.xxxl + 26,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          <Row between style={{ alignItems: 'flex-start' }}>
            <View>
              <Text variant="label" color="rgba(255,255,255,0.8)">
                {greeting()}
              </Text>
              <Text variant="hero" raw color="#fff" style={{ marginTop: 2 }}>
                {d.user.name?.split(' ')[0] ?? t('there')}
              </Text>
            </View>
            <Row gap={space.sm}>
              <PressableScale onPress={() => nav.navigate('Ask')} compact>
                <View style={hs.glassChip}>
                  <Icon name="ai" size={15} color="#fff" weight="fill" />
                  <Text variant="label" color="#fff">
                    {t('Ask AI')}
                  </Text>
                </View>
              </PressableScale>
              <PressableScale onPress={() => nav.navigate('Profile')} compact>
                <View style={hs.glassAvatar}>
                  <Text variant="subhead" color="#fff" raw>
                    {(d.user.name?.[0] ?? 'F').toUpperCase()}
                  </Text>
                </View>
              </PressableScale>
            </Row>
          </Row>

          {/* weather */}
          {w && (
            <PressableScale onPress={() => nav.navigate('Weather')} feedback="tap">
              <Row between style={{ marginTop: space.xl, alignItems: 'center' }}>
                <Row gap={space.md} style={{ alignItems: 'center' }}>
                  <Icon name={weatherIcon(w.current.code, w.current.isDay)} size={44} color="#fff" weight="fill" />
                  <View>
                    <Text variant="hero" raw color="#fff" style={{ fontSize: 40, lineHeight: 44 }}>
                      {Math.round(w.current.tempC ?? 0)}°
                    </Text>
                    <Text variant="label" color="rgba(255,255,255,0.9)" raw>
                      {w.current.condition}
                    </Text>
                  </View>
                </Row>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <View style={hs.placePill}>
                    <Icon name="hotspot" size={10} color="rgba(255,255,255,0.9)" weight="fill" />
                    <Text variant="caption" color="#fff" raw numberOfLines={1}>
                      {w.place ?? t('your field')}
                    </Text>
                  </View>
                  {w.today && (
                    <Text variant="caption" color="rgba(255,255,255,0.8)" raw>
                      H {Math.round(w.today.tempMaxC ?? 0)}°  L {Math.round(w.today.tempMinC ?? 0)}°
                    </Text>
                  )}
                  {w.sprayWindow ? (
                    <Text variant="caption" color="rgba(255,255,255,0.9)" raw>
                      {t('Spray')} {fmtHr(w.sprayWindow.start)}–{fmtHr(w.sprayWindow.end)}
                    </Text>
                  ) : null}
                </View>
              </Row>
            </PressableScale>
          )}
        </LinearGradient>

        {/* ── floating stat chips ── */}
        <Row gap={space.sm} style={{ paddingHorizontal: space.lg, marginTop: -26 }}>
          <StatChip
            label={t('Fields')}
            value={d.fieldCount}
            icon="fields"
            onPress={() => nav.getParent()?.navigate('Fields' as never)}
          />
          <StatChip
            label={t('To do')}
            value={todo.length}
            icon="tasks"
            tint={todo.length > 0 ? palette.primary : undefined}
            onPress={() => nav.navigate('Tasks')}
          />
          <StatChip
            label={t('Risk')}
            value={t(sev[hiLvl].label)}
            icon="shield"
            tint={sev[hiLvl].fg}
            onPress={() => hi && nav.navigate('FieldDetail', { fieldId: hi.id })}
          />
        </Row>

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
          {/* the brief */}
          <AiBrief
            brief={briefApi.brief}
            loading={briefApi.loading}
            working={briefApi.working}
            onRefresh={briefApi.refresh}
            onAction={openInsight}
          />

          {/* needs attention — merged, only when there is something */}
          {attention && (
            <Reveal>
              <Card elevation="raised">
                <Text variant="overline">{t('Needs attention')}</Text>
                {hi && (hiLvl === 'medium' || hiLvl === 'high') && (
                  <PressableScale onPress={() => nav.navigate('FieldDetail', { fieldId: hi.id })} feedback="tap">
                    <Row gap={space.sm} style={{ paddingVertical: 6 }}>
                      <Icon name="shield" size={18} color={sev[hiLvl].fg} weight="fill" />
                      <Text variant="body" style={{ flex: 1 }} raw numberOfLines={2}>
                        {t('{field} — {level} disease risk this week', {
                          field: hi.name,
                          level: t(sev[hiLvl].label).toLowerCase(),
                        })}
                      </Text>
                      <Icon name="right" size={15} color={palette.textFaint} />
                    </Row>
                  </PressableScale>
                )}
                {alertsN > 0 && (
                  <PressableScale onPress={() => nav.navigate('Alerts')} feedback="tap">
                    <Row gap={space.sm} style={{ paddingVertical: 6 }}>
                      <Icon name="alerts" size={18} color={palette.coral} weight="fill" />
                      <Text variant="body" style={{ flex: 1 }} raw numberOfLines={2}>
                        {outbreaks > 0
                          ? t('{n} outbreak(s) reported near you', { n: outbreaks })
                          : t('{n} advisory from your area', { n: d.alerts.count })}
                      </Text>
                      <Icon name="right" size={15} color={palette.textFaint} />
                    </Row>
                  </PressableScale>
                )}
              </Card>
            </Reveal>
          )}

          {/* today's tasks */}
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
                  {todo.slice(0, 4).map((task) => (
                    <TaskRow key={task.id} task={task} onDone={reload} />
                  ))}
                  {todo.length > 4 && (
                    <PressableScale onPress={() => nav.navigate('Tasks')} compact style={{ paddingVertical: 4 }}>
                      <Text variant="caption" color={palette.primary}>
                        + {todo.length - 4} {t('more')}
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

          {/* scan CTA */}
          <Reveal index={3}>
            <PressableScale onPress={() => nav.getParent()?.navigate('Scan' as never)} feedback="press">
              <LinearGradient
                colors={gradients.homeCta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={hs.cta}
              >
                <View style={hs.ctaIcon}>
                  <Icon name="scan" size={20} color="#fff" weight="fill" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" color="#fff">
                    {t('See a problem on your crop?')}
                  </Text>
                  <Text variant="caption" color="rgba(255,255,255,0.85)">
                    {t('Scan it for a diagnosis in seconds')}
                  </Text>
                </View>
                <Icon name="right" size={18} color="#fff" />
              </LinearGradient>
            </PressableScale>
          </Reveal>
        </View>
      </ScrollView>
    </View>
  );
}

function StatChip({
  label,
  value,
  icon,
  tint,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Icon>['name'];
  tint?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} compact style={{ flex: 1 }}>
      <View style={[hs.stat, shadow.e1]}>
        <Icon name={icon} size={15} color={tint ?? palette.textFaint} weight="fill" />
        <Text variant="title" raw color={tint ?? palette.text} style={{ marginTop: 4 }}>
          {String(value)}
        </Text>
        <Text variant="overline" style={{ marginTop: 1 }}>
          {label}
        </Text>
      </View>
    </PressableScale>
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

const hs = {
  glassChip: {
    height: 34,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  glassAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  placePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  stat: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center' as const,
  },
  cta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    borderRadius: radius.xl,
    padding: space.lg,
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};

const fmtHr = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }).replace(' ', '');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
