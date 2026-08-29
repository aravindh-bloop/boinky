import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { useDailyBrief } from '../api/useDailyBrief';
import { api } from '../api/client';
import { useT } from '../i18n';
import type { HomeData, InsightCard, Weather } from '../api/types';
import {
  AiBrief,
  Card,
  Icon,
  Reveal,
  Row,
  SkeletonList,
  Text,
  ErrorState,
  PodCard,
  PressableScale,
  RiskGauge,
  gradients,
  haptic,
  palette,
  radius,
  severity as sev,
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
  // `/api/home` carries weather whenever the server-side forecast cache is warm.
  // Only reach for the live endpoint when it isn't — this used to be an extra
  // request on every single visit to the dashboard.
  const weatherApi = useApi<Weather>(data && !data.weather ? '/api/weather' : null);
  // generated in the background and polled — never blocks the dashboard either
  const briefApi = useDailyBrief();

  /** Route an insight card to the screen it is about. */
  const openInsight = React.useCallback(
    (c: InsightCard) => {
      const field = c.fieldName
        ? data?.fieldRisk.find((f) => f.name === c.fieldName)
        : undefined;
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
        // Stock and Schemes are sibling tabs, so they go through the tab navigator.
        case 'open_stock':
          nav.getParent()?.navigate('Stock');
          break;
        case 'open_schemes':
          nav.getParent()?.navigate('Schemes');
          break;
        case 'none':
        default:
          break;
      }
    },
    [data, nav],
  );

  if (loading)
    return (
      <View style={{ flex: 1, backgroundColor: palette.canvas, paddingTop: insets.top + 80, paddingHorizontal: space.lg }}>
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
  const hi = d.highestRisk;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
      >
        {/* ── Weather hero ── */}
        <LinearGradient
          colors={w?.current.isDay === false ? gradients.dusk : gradients.canopy}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + space.md,
            paddingHorizontal: space.lg,
            paddingBottom: space.xxxl,
            borderBottomLeftRadius: radius.xxl,
            borderBottomRightRadius: radius.xxl,
          }}
        >
          <Row between>
            <View>
              <Text variant="body" color="rgba(255,255,255,0.85)">
                {greeting()}
              </Text>
              <Text variant="title" color="#fff" raw>
                {d.user.name?.split(' ')[0] ?? t('farmer')}
              </Text>
            </View>
            <PressableScale onPress={() => nav.navigate('Profile')} compact>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text variant="subhead" color="#fff">
                  {(d.user.name?.[0] ?? 'F').toUpperCase()}
                </Text>
              </View>
            </PressableScale>
          </Row>

          {w ? (
            <PressableScale onPress={() => nav.navigate('Weather')} feedback="tap">
              <Row between style={{ marginTop: space.lg }}>
                <Row gap={space.md}>
                  <Icon name={weatherIcon(w.current.code, w.current.isDay)} size={52} color="#fff" weight="fill" />
                  <View>
                    <Text variant="hero" color="#fff" style={{ fontSize: 40, lineHeight: 44 }}>
                      {Math.round(w.current.tempC ?? 0)}°
                    </Text>
                    <Text variant="bodyStrong" color="rgba(255,255,255,0.9)">
                      {w.current.condition}
                    </Text>
                  </View>
                </Row>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="caption" color="rgba(255,255,255,0.85)">
                    {w.place ?? 'your field'}
                  </Text>
                  {w.today && (
                    <Text variant="caption" color="rgba(255,255,255,0.85)">
                      ↑{Math.round(w.today.tempMaxC ?? 0)}° ↓{Math.round(w.today.tempMinC ?? 0)}°
                    </Text>
                  )}
                  <Text variant="caption" color="rgba(255,255,255,0.7)">
                    feels {Math.round(w.current.feelsLikeC ?? 0)}°
                  </Text>
                </View>
              </Row>
              {w.topAdvisory && (
                <View
                  style={{
                    marginTop: space.md,
                    backgroundColor: 'rgba(255,255,255,0.16)',
                    borderRadius: radius.md,
                    padding: space.sm,
                    flexDirection: 'row',
                    gap: space.sm,
                    alignItems: 'center',
                  }}
                >
                  <Icon name="warning" size={16} color="#fff" weight="fill" />
                  <Text variant="caption" color="#fff" style={{ flex: 1 }}>
                    {w.topAdvisory.title}
                    {w.advisoryCount > 1 ? `  +${w.advisoryCount - 1} more` : ''}
                  </Text>
                  <Icon name="right" size={14} color="rgba(255,255,255,0.8)" />
                </View>
              )}
            </PressableScale>
          ) : (
            <Text variant="body" color="rgba(255,255,255,0.85)" style={{ marginTop: space.lg }}>
              Add a location to a field to see local weather.
            </Text>
          )}
        </LinearGradient>

        <View style={{ padding: space.lg, gap: space.md, marginTop: -space.lg }}>
          {/* ── AI daily brief — leads the dashboard when there is something to say ── */}
          <AiBrief
            brief={briefApi.brief}
            loading={briefApi.loading}
            working={briefApi.working}
            onRefresh={briefApi.refresh}
            onAction={openInsight}
          />

          {/* ── quick stat row ── */}
          <Reveal>
            <Row gap={space.sm}>
              <StatPill
                icon="tasks"
                value={d.tasks.today.length}
                label="today"
                tint={palette.primary}
                onPress={() => nav.navigate('Tasks')}
              />
              <StatPill
                icon="clock"
                value={d.tasks.overdueCount}
                label="overdue"
                tint={d.tasks.overdueCount > 0 ? palette.warn : palette.textFaint}
                onPress={() => nav.navigate('Tasks')}
              />
              <StatPill
                icon="alerts"
                value={d.alerts.count}
                label="alerts"
                tint={d.alerts.count > 0 ? palette.danger : palette.textFaint}
                onPress={() => nav.navigate('Alerts')}
              />
            </Row>
          </Reveal>

          {/* ── highest risk field ── */}
          {hi && hi.riskScore != null ? (
            <Reveal index={1}>
              <Card
                onPress={() => nav.navigate('FieldDetail', { fieldId: hi.id })}
                accent={sev[hi.riskLevel ?? 'low'].fg}
              >
                <Row between>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label" color={sev[hi.riskLevel ?? 'low'].fg}>
                      HIGHEST RISK FIELD
                    </Text>
                    <Text variant="heading">{hi.name}</Text>
                    <Text variant="caption" muted>
                      {hi.crop}
                      {hi.daysSinceSown != null ? ` · day ${hi.daysSinceSown}` : ''}
                    </Text>
                  </View>
                  <RiskGauge score={hi.riskScore} level={hi.riskLevel ?? 'low'} size={104} label="" />
                </Row>
              </Card>
            </Reveal>
          ) : (
            <Reveal index={1}>
              <Card elevation="flat">
                <Row gap={space.sm}>
                  <Icon name="shield" size={22} color={palette.primary} weight="fill" />
                  <Text variant="bodyStrong">All fields look calm right now</Text>
                </Row>
              </Card>
            </Reveal>
          )}

          {/* ── AgriPod sensor ── */}
          {d.fieldRisk.length > 0 && (
            <Reveal index={2}>
              <PodCard
                fieldId={(d.highestRisk ?? d.fieldRisk[0]).id}
                hideIfNoDevice
              />
            </Reveal>
          )}

          {/* ── nearby outbreaks ── */}
          {d.nearbyOutbreaks && d.nearbyOutbreaks.count > 0 && (
            <Reveal index={2}>
              <Card onPress={() => nav.navigate('Alerts')} accent={palette.warn} elevation="flat">
                <Row gap={space.sm}>
                  <Icon name="hotspot" size={20} color={palette.warn} weight="fill" />
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {d.nearbyOutbreaks.count} outbreak{d.nearbyOutbreaks.count > 1 ? 's' : ''} near you
                    {d.nearbyOutbreaks.nearestKm != null ? ` · ${d.nearbyOutbreaks.nearestKm} km` : ''}
                  </Text>
                  <Icon name="right" size={16} color={palette.textFaint} />
                </Row>
              </Card>
            </Reveal>
          )}

          {/* ── today's tasks ── */}
          <Reveal index={3}>
            <Card elevation="flat">
              <Row between>
                <Text variant="subhead">Today's tasks</Text>
                <PressableScale onPress={() => nav.navigate('Tasks')}>
                  <Text variant="label" color={palette.primary}>
                    All tasks
                  </Text>
                </PressableScale>
              </Row>
              {d.tasks.today.length === 0 ? (
                <Text variant="body" muted>
                  Nothing scheduled for today. {d.tasks.upcomingCount} coming up this week.
                </Text>
              ) : (
                d.tasks.today.slice(0, 4).map((t) => (
                  <TaskRow key={t.id} id={t.id} title={t.title} field={t.field_name} done={t.is_done} onDone={reload} />
                ))
              )}
            </Card>
          </Reveal>

          {/* ── alerts ── */}
          {d.alerts.latest.length > 0 && (
            <Reveal index={4}>
              <Card onPress={() => nav.navigate('Alerts')} elevation="flat">
                <Text variant="subhead">Advisory</Text>
                {d.alerts.latest.map((a) => (
                  <View key={a.id}>
                    <Text variant="bodyStrong">{a.title}</Text>
                    <Text variant="caption" muted numberOfLines={2}>
                      {a.message}
                    </Text>
                  </View>
                ))}
              </Card>
            </Reveal>
          )}

          {/* ── recent scans ── */}
          {d.recentScans.length > 0 && (
            <Reveal index={5}>
              <Card elevation="flat">
                <Row between>
                  <Text variant="subhead">Recent scans</Text>
                  <PressableScale onPress={() => nav.navigate('History')}>
                    <Text variant="label" color={palette.primary}>
                      History
                    </Text>
                  </PressableScale>
                </Row>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                  {d.recentScans.map((s) => (
                    <PressableScale key={s.id} onPress={() => nav.navigate('ScanResult', { scanId: s.id })} compact>
                      <View style={{ width: 96, gap: 4 }}>
                        <Image
                          source={{ uri: s.image_url }}
                          style={{ width: 96, height: 96, borderRadius: radius.md }}
                          contentFit="cover"
                        />
                        <Text variant="caption" numberOfLines={1}>
                          {s.diagnosis_label ?? '—'}
                        </Text>
                      </View>
                    </PressableScale>
                  ))}
                </ScrollView>
              </Card>
            </Reveal>
          )}

          {/* ── season money ── */}
          {d.finance && (
            <Reveal index={6}>
              <Card onPress={() => nav.getParent()?.navigate('Stock' as never)} elevation="flat">
                <Text variant="subhead">This season</Text>
                <Row gap={space.md}>
                  <Money label="Spent" value={d.finance.spent} tint={palette.clay} />
                  <Money label="Earned" value={d.finance.revenue} tint={palette.primary} />
                  <Money label="Net" value={d.finance.net} tint={d.finance.net >= 0 ? palette.primaryDeep : palette.danger} />
                </Row>
              </Card>
            </Reveal>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatPill({
  icon,
  value,
  label,
  tint,
  onPress,
}: {
  icon: any;
  value: number;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} style={{ flex: 1 }} compact>
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: radius.lg,
          padding: space.md,
          gap: 2,
          borderWidth: 1,
          borderColor: palette.hairline,
        }}
      >
        <Icon name={icon} size={18} color={tint} weight="fill" />
        <Text variant="title" style={{ fontSize: 22 }} color={tint}>
          {value}
        </Text>
        <Text variant="caption" faint>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

function TaskRow({
  id,
  title,
  field,
  done,
  onDone,
}: {
  id: string;
  title: string;
  field: string | null;
  done: boolean;
  onDone: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const toggle = async () => {
    setBusy(true);
    haptic.tap();
    try {
      await api.request(`/api/calendar/tasks/${id}`, { method: 'PATCH', body: { isDone: !done } });
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <PressableScale onPress={toggle} feedback={false} disabled={busy} style={{ opacity: done ? 0.5 : 1 }}>
      <Row gap={space.sm} style={{ paddingVertical: 4 }}>
        <Icon name={done ? 'check' : 'circle'} size={20} color={done ? palette.primary : palette.borderStrong} weight={done ? 'fill' : 'regular'} />
        <View style={{ flex: 1 }}>
          <Text variant="body" style={done ? { textDecorationLine: 'line-through' } : undefined}>
            {title}
          </Text>
          {field ? (
            <Text variant="caption" faint>
              {field}
            </Text>
          ) : null}
        </View>
      </Row>
    </PressableScale>
  );
}

function Money({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="subhead" color={tint}>
        ₹{compact(value)}
      </Text>
      <Text variant="caption" faint>
        {label}
      </Text>
    </View>
  );
}

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
