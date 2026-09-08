import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { useDailyBrief } from '../api/useDailyBrief';
import { useT } from '../i18n';
import type { HomeData, InsightCard, Weather } from '../api/types';
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
  gradients,
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
      <View style={{ flex: 1, backgroundColor: palette.canvas, paddingTop: insets.top + 96, paddingHorizontal: space.lg }}>
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
  const riskShown = hi && hi.riskScore != null && (hi.riskLevel === 'high' || hi.riskLevel === 'medium');

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
      >
        {/* ── Sunrise hero ── */}
        <LinearGradient
          colors={w?.current.isDay === false ? gradients.dusk : gradients.canopy}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            paddingTop: insets.top + space.md,
            paddingHorizontal: space.lg,
            paddingBottom: space.xxl + space.xl,
            borderBottomLeftRadius: radius.xxl,
            borderBottomRightRadius: radius.xxl,
          }}
        >
          <Row between>
            <View>
              <Text variant="label" color="rgba(255,255,255,0.8)">
                {greeting()}
              </Text>
              <Text variant="title" color="#fff" raw style={{ marginTop: 1 }}>
                {d.user.name?.split(' ')[0] ?? t('there')}
              </Text>
            </View>
            <Row gap={space.sm}>
              <PressableScale onPress={() => nav.navigate('Ask')} compact>
                <View style={hs.chip}>
                  <Icon name="ai" size={15} color="#fff" weight="fill" />
                  <Text variant="label" color="#fff">
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

          {w ? (
            <PressableScale onPress={() => nav.navigate('Weather')} feedback="tap">
              <Row between style={{ marginTop: space.xl, alignItems: 'center' }}>
                <Row gap={space.md} style={{ alignItems: 'center' }}>
                  <Icon name={weatherIcon(w.current.code, w.current.isDay)} size={42} color="#fff" weight="fill" />
                  <View>
                    <Text variant="hero" color="#fff" raw style={{ fontSize: 40, lineHeight: 42, letterSpacing: -1 }}>
                      {Math.round(w.current.tempC ?? 0)}°
                    </Text>
                    <Text variant="label" color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }}>
                      {w.current.condition}
                    </Text>
                  </View>
                </Row>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={hs.place}>
                    <Icon name="hotspot" size={10} color="rgba(255,255,255,0.9)" weight="fill" />
                    <Text variant="caption" color="#fff" raw>
                      {w.place ?? t('your field')}
                    </Text>
                  </View>
                  {w.today && (
                    <Text variant="caption" color="rgba(255,255,255,0.82)" raw>
                      H {Math.round(w.today.tempMaxC ?? 0)}°  L {Math.round(w.today.tempMinC ?? 0)}°
                    </Text>
                  )}
                </View>
              </Row>
              {w.topAdvisory && (
                <View style={hs.advisory}>
                  <Icon name="warning" size={14} color="#fff" weight="fill" />
                  <Text variant="caption" color="#fff" style={{ flex: 1 }} numberOfLines={1}>
                    {w.topAdvisory.title}
                    {w.advisoryCount > 1 ? `  +${w.advisoryCount - 1}` : ''}
                  </Text>
                  <Icon name="right" size={12} color="rgba(255,255,255,0.8)" />
                </View>
              )}
            </PressableScale>
          ) : (
            <Text variant="body" color="rgba(255,255,255,0.9)" style={{ marginTop: space.lg }}>
              {t('Add a location to a field to see local weather.')}
            </Text>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: space.lg, gap: space.lg, marginTop: -space.xl }}>
          {/* ── the brief leads ── */}
          <AiBrief
            brief={briefApi.brief}
            loading={briefApi.loading}
            working={briefApi.working}
            onRefresh={briefApi.refresh}
            onAction={openInsight}
          />

          {/* ── at a glance ── */}
          <Reveal>
            <Card elevation="raised" padded={false}>
              {riskShown && (
                <PressableScale
                  onPress={() => nav.navigate('FieldDetail', { fieldId: hi!.id })}
                  feedback="tap"
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.md,
                      backgroundColor: sev[hi!.riskLevel ?? 'low'].bg,
                      borderTopLeftRadius: radius.xl,
                      borderTopRightRadius: radius.xl,
                    }}
                  >
                    <Icon name="shield" size={16} color={sev[hi!.riskLevel ?? 'low'].fg} weight="fill" />
                    <Text variant="label" color={sev[hi!.riskLevel ?? 'low'].fg} style={{ flex: 1 }}>
                      {t('{level} risk on {field}', {
                        level: sev[hi!.riskLevel ?? 'low'].label,
                        field: hi!.name,
                      })}
                    </Text>
                    <Icon name="right" size={14} color={sev[hi!.riskLevel ?? 'low'].fg} />
                  </View>
                </PressableScale>
              )}
              <Row style={{ paddingVertical: space.md }}>
                <Glance
                  value={d.tasks.today.length}
                  label={t('today')}
                  onPress={() => nav.navigate('Tasks')}
                />
                <Divider style={{ width: 1, height: 34 }} />
                <Glance
                  value={d.tasks.overdueCount}
                  label={t('overdue')}
                  tint={d.tasks.overdueCount > 0 ? palette.warn : undefined}
                  onPress={() => nav.navigate('Tasks')}
                />
                <Divider style={{ width: 1, height: 34 }} />
                <Glance
                  value={d.alerts.count + (d.nearbyOutbreaks?.count ?? 0)}
                  label={t('alerts')}
                  tint={d.alerts.count + (d.nearbyOutbreaks?.count ?? 0) > 0 ? palette.danger : undefined}
                  onPress={() => nav.navigate('Alerts')}
                />
              </Row>
            </Card>
          </Reveal>

          {/* ── recent scans ── */}
          {d.recentScans.length > 0 && (
            <Reveal index={1}>
              <View style={{ gap: space.sm }}>
                <Row between>
                  <Text variant="overline">{t('Recent scans')}</Text>
                  <PressableScale onPress={() => nav.navigate('History')} compact>
                    <Text variant="label" color={palette.primary}>
                      {t('History')}
                    </Text>
                  </PressableScale>
                </Row>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space.sm }}
                >
                  {d.recentScans.map((s) => (
                    <PressableScale
                      key={s.id}
                      onPress={() => nav.navigate('ScanResult', { scanId: s.id })}
                      compact
                    >
                      <View style={{ width: 100, gap: 5 }}>
                        <Image
                          source={{ uri: s.image_url }}
                          style={{ width: 100, height: 100, borderRadius: radius.lg }}
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

          {/* ── quiet links to the rest ── */}
          <Reveal index={2}>
            <Row gap={space.sm}>
              <QuietLink icon="calendar" label={t('Calendar')} onPress={() => nav.navigate('Tasks')} />
              <QuietLink icon="activity" label={t('Activity')} onPress={() => nav.navigate('Activity')} />
              <QuietLink
                icon="money"
                label={t('Money')}
                onPress={() => nav.getParent()?.navigate('Stock' as never)}
              />
            </Row>
          </Reveal>
        </View>
      </ScrollView>
    </View>
  );
}

function Glance({
  value,
  label,
  tint,
  onPress,
}: {
  value: number;
  label: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} compact style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text variant="title" raw color={tint ?? palette.text}>
          {String(value)}
        </Text>
        <Text variant="overline">{label}</Text>
      </View>
    </PressableScale>
  );
}

function QuietLink({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} compact style={{ flex: 1 }}>
      <View
        style={{
          alignItems: 'center',
          gap: 6,
          paddingVertical: space.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: palette.hairline,
          backgroundColor: palette.surface,
        }}
      >
        <Icon name={icon} size={18} color={palette.primary} weight="regular" />
        <Text variant="caption" muted>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const hs = {
  chip: {
    height: 38,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  place: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  advisory: {
    marginTop: space.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    flexDirection: 'row' as const,
    gap: space.sm,
    alignItems: 'center' as const,
  },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
