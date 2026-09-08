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
  Divider,
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
  const todo = d.tasks.today.filter((x) => !x.is_done);
  const fields = d.fieldRisk;
  const hi = d.highestRisk;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.lg,
          paddingBottom: space.xxxl,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
      >
        {/* header */}
        <Row between style={{ alignItems: 'flex-start', marginBottom: space.xs }}>
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
              <View style={[hs.chip, { backgroundColor: palette.irisSoft }]}>
                <Icon name="ai" size={15} color={palette.iris} weight="fill" />
                <Text variant="label" color={palette.iris}>
                  {t('Ask AI')}
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

        {/* weather */}
        {w && (
          <Reveal>
            <Card elevation="raised" onPress={() => nav.navigate('Weather')}>
              <Row between style={{ alignItems: 'center' }}>
                <Row gap={space.md} style={{ alignItems: 'center' }}>
                  <View style={[hs.iconWrap, { backgroundColor: palette.skySoft }]}>
                    <Icon name={weatherIcon(w.current.code, w.current.isDay)} size={24} color={palette.sky} weight="fill" />
                  </View>
                  <View>
                    <Text variant="title" raw color={palette.text}>
                      {Math.round(w.current.tempC ?? 0)}°
                    </Text>
                    <Text variant="caption" muted raw>
                      {w.current.condition}
                    </Text>
                  </View>
                </Row>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text variant="caption" faint raw numberOfLines={1}>
                    {w.place ?? t('your field')}
                  </Text>
                  {w.today && (
                    <Text variant="caption" faint raw>
                      H {Math.round(w.today.tempMaxC ?? 0)}°  L {Math.round(w.today.tempMinC ?? 0)}°
                    </Text>
                  )}
                </View>
              </Row>
              {w.sprayWindow ? (
                <>
                  <Divider style={{ marginTop: space.xs }} />
                  <Row gap={6} style={{ marginTop: space.xs }}>
                    <Icon name="spray" size={13} color={palette.primary} weight="fill" />
                    <Text variant="caption" color={palette.primaryDeep} raw style={{ flex: 1 }}>
                      {t('Good to spray')} {fmtHr(w.sprayWindow.start)}–{fmtHr(w.sprayWindow.end)}
                    </Text>
                  </Row>
                </>
              ) : w.topAdvisory ? (
                <>
                  <Divider style={{ marginTop: space.xs }} />
                  <Row gap={6} style={{ marginTop: space.xs }}>
                    <Icon name="warning" size={13} color={palette.warn} weight="fill" />
                    <Text variant="caption" color={palette.textMuted} raw numberOfLines={1} style={{ flex: 1 }}>
                      {w.topAdvisory.title}
                      {w.advisoryCount > 1 ? `  +${w.advisoryCount - 1}` : ''}
                    </Text>
                  </Row>
                </>
              ) : null}
            </Card>
          </Reveal>
        )}

        {/* crops + risk */}
        {fields.length > 0 && (
          <Reveal index={1}>
            <Card elevation="raised">
              <Row between>
                <Text variant="overline">{t('Your crops')}</Text>
                <PressableScale onPress={() => nav.getParent()?.navigate('Fields' as never)} compact>
                  <Text variant="label" color={palette.primary}>
                    {t('All fields')}
                  </Text>
                </PressableScale>
              </Row>
              <View style={{ gap: 2, marginTop: 2 }}>
                {fields.slice(0, 3).map((f) => {
                  const lvl = f.riskLevel ?? 'low';
                  return (
                    <PressableScale
                      key={f.id}
                      onPress={() => nav.navigate('FieldDetail', { fieldId: f.id })}
                      feedback="tap"
                    >
                      <Row gap={space.sm} style={{ paddingVertical: 7 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sev[lvl].fg }} />
                        <Text variant="body" raw style={{ flex: 1 }} numberOfLines={1}>
                          {f.name || cap(f.crop)}
                        </Text>
                        <Text variant="caption" faint raw>
                          {cap(f.crop)}
                          {f.daysSinceSown != null ? ` · ${t('day')} ${f.daysSinceSown}` : ''}
                        </Text>
                        {(lvl === 'medium' || lvl === 'high') && (
                          <Text variant="caption" color={sev[lvl].fg}>
                            {t(sev[lvl].label)}
                          </Text>
                        )}
                      </Row>
                    </PressableScale>
                  );
                })}
                {fields.length > 3 && (
                  <PressableScale
                    onPress={() => nav.getParent()?.navigate('Fields' as never)}
                    compact
                    style={{ paddingVertical: 4 }}
                  >
                    <Text variant="caption" color={palette.primary}>
                      + {fields.length - 3} {t('more')}
                    </Text>
                  </PressableScale>
                )}
              </View>
              {hi && (hi.riskLevel === 'medium' || hi.riskLevel === 'high') && hi.riskScore != null && (
                <View
                  style={{
                    marginTop: space.sm,
                    backgroundColor: sev[hi.riskLevel].bg,
                    borderRadius: radius.md,
                    padding: space.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                  }}
                >
                  <Icon name="shield" size={15} color={sev[hi.riskLevel].fg} weight="fill" />
                  <Text variant="caption" color={sev[hi.riskLevel].fg} style={{ flex: 1 }} raw>
                    {t('{field} needs watching — {level} disease risk this week', {
                      field: hi.name,
                      level: t(sev[hi.riskLevel].label).toLowerCase(),
                    })}
                  </Text>
                </View>
              )}
            </Card>
          </Reveal>
        )}

        {/* today's tasks */}
        <Reveal index={2}>
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

        {/* alerts / outbreaks */}
        {(d.alerts.count > 0 || outbreaks > 0) && (
          <Reveal index={3}>
            <Card onPress={() => nav.navigate('Alerts')} accent={palette.coral} elevation="raised">
              <Row gap={space.sm}>
                <View style={[hs.iconWrap, { backgroundColor: palette.coralSoft }]}>
                  <Icon name="alerts" size={18} color={palette.coral} weight="fill" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" raw>
                    {outbreaks > 0
                      ? t('{n} outbreak(s) reported near you', { n: outbreaks })
                      : t('{n} advisory from your area', { n: d.alerts.count })}
                  </Text>
                  {outbreaks > 0 && d.nearbyOutbreaks?.nearestKm != null ? (
                    <Text variant="caption" muted raw>
                      {t('Nearest about {km} km away', { km: d.nearbyOutbreaks.nearestKm })}
                    </Text>
                  ) : d.alerts.latest[0] ? (
                    <Text variant="caption" muted numberOfLines={1} raw>
                      {d.alerts.latest[0].title}
                    </Text>
                  ) : null}
                </View>
                <Icon name="right" size={16} color={palette.textFaint} />
              </Row>
            </Card>
          </Reveal>
        )}

        {/* recent scans */}
        {d.recentScans.length > 0 && (
          <Reveal index={4}>
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
        <Reveal index={5}>
          <PressableScale onPress={() => nav.getParent()?.navigate('Scan' as never)} feedback="press">
            <View style={hs.cta}>
              <View style={[hs.iconWrap, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
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
            </View>
          </PressableScale>
        </Reveal>
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

const hs = {
  chip: {
    height: 34,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: palette.primarySoft,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.md,
    backgroundColor: palette.primary,
    borderRadius: radius.xl,
    padding: space.lg,
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtHr = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true }).replace(' ', '');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
