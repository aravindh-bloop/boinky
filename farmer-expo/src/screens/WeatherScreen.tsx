import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import type { Weather } from '../api/types';
import {
  Card,
  Icon,
  LoaderScreen,
  ErrorState,
  Reveal,
  Row,
  Sparkline,
  Text,
  PressableScale,
  gradients,
  palette,
  radius,
  space,
  weatherIcon,
} from '../ui';
import type { HomeStackParams } from '../navigation';

type R = RouteProp<HomeStackParams, 'Weather'>;

const ADV_TINT = { info: palette.info, watch: palette.warn, warning: palette.danger };
const ADV_ICON = { info: 'cloudSun', watch: 'warning', warning: 'warning' } as const;

export default function WeatherScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const fieldId = useRoute<R>().params?.fieldId;
  const { data, loading, error, refreshing, reload } = useApi<Weather>('/api/weather', { fieldId });

  if (loading) return <LoaderScreen label="Checking the sky" />;
  if (error || !data) return <ErrorState message={error ?? 'No weather'} onRetry={reload} />;

  const c = data.current;
  const spray = data.sprayWindow;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor="#fff" />}
      >
        <LinearGradient
          colors={c.isDay ? gradients.canopy : gradients.dusk}
          style={{
            paddingTop: insets.top + space.sm,
            paddingHorizontal: space.lg,
            paddingBottom: space.xxxl,
            borderBottomLeftRadius: radius.xxl,
            borderBottomRightRadius: radius.xxl,
          }}
        >
          <Row between>
            <PressableScale onPress={() => nav.goBack()} compact>
              <Icon name="left" size={26} color="#fff" />
            </PressableScale>
            <Text variant="bodyStrong" color="#fff">
              {data.place.label ?? 'Your field'}
            </Text>
            <View style={{ width: 26 }} />
          </Row>

          <View style={{ alignItems: 'center', marginTop: space.lg }}>
            <Icon name={weatherIcon(c.code, c.isDay)} size={84} color="#fff" weight="fill" />
            <Text variant="hero" color="#fff" style={{ fontSize: 64, lineHeight: 70 }}>
              {Math.round(c.tempC ?? 0)}°
            </Text>
            <Text variant="subhead" color="rgba(255,255,255,0.92)">
              {c.condition} · feels {Math.round(c.feelsLikeC ?? 0)}°
            </Text>
          </View>

          <Row between style={{ marginTop: space.lg }}>
            <Metric icon="humidity" label="Humidity" value={`${Math.round(c.humidityPct ?? 0)}%`} />
            <Metric icon="wind" label="Wind" value={`${Math.round(c.windKph ?? 0)} km/h`} />
            <Metric icon="umbrella" label="Rain now" value={`${(c.precipMm ?? 0).toFixed(1)} mm`} />
            <Metric icon="cloud" label="Cloud" value={`${Math.round(c.cloudPct ?? 0)}%`} />
          </Row>
        </LinearGradient>

        <View style={{ padding: space.lg, gap: space.md, marginTop: -space.lg }}>
          {/* spray window */}
          <Reveal>
            <Card accent={spray ? palette.primary : palette.warn} elevation="raised">
              <Row gap={space.sm}>
                <Icon name="spray" size={20} color={spray ? palette.primary : palette.warn} weight="fill" />
                <Text variant="subhead">Spray window</Text>
              </Row>
              {spray ? (
                <Text variant="body">
                  Good conditions for spraying <Text variant="bodyStrong">{fmtRange(spray.start, spray.end)}</Text> —
                  about {spray.hours}h of calm, dry weather.
                </Text>
              ) : (
                <Text variant="body" muted>
                  No good spraying window in the next 24 hours (rain or wind). Check again later.
                </Text>
              )}
            </Card>
          </Reveal>

          {/* hourly */}
          <Reveal index={1}>
            <Card elevation="flat">
              <Text variant="subhead">Next 24 hours</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
                {data.hourly.map((h) => (
                  <View key={h.time} style={{ alignItems: 'center', gap: 4, width: 46 }}>
                    <Text variant="caption" faint>
                      {new Date(h.time).getHours()}h
                    </Text>
                    <Icon name={weatherIcon(h.code, h.isDay)} size={22} color={palette.textMuted} weight="fill" />
                    <Text variant="bodyStrong">{Math.round(h.tempC ?? 0)}°</Text>
                    {(h.precipProbPct ?? 0) > 15 && (
                      <Text variant="caption" color={palette.info}>
                        {Math.round(h.precipProbPct ?? 0)}%
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
              <Sparkline
                data={data.hourly.map((h) => h.tempC ?? 0)}
                color={palette.honey}
                width={300}
                height={44}
                fill={false}
              />
            </Card>
          </Reveal>

          {/* advisories */}
          {data.advisories.length > 0 && (
            <Reveal index={2}>
              <View style={{ gap: space.sm }}>
                <Text variant="subhead">Farm advice</Text>
                {data.advisories.map((a) => (
                  <Card key={a.key} accent={ADV_TINT[a.severity]} elevation="flat">
                    <Row gap={space.sm}>
                      <Icon name={ADV_ICON[a.severity]} size={18} color={ADV_TINT[a.severity]} weight="fill" />
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {a.title}
                      </Text>
                    </Row>
                    <Text variant="body" muted>
                      {a.detail}
                    </Text>
                  </Card>
                ))}
              </View>
            </Reveal>
          )}

          {/* 7 day */}
          <Reveal index={3}>
            <Card elevation="flat">
              <Text variant="subhead">7-day outlook</Text>
              {data.daily.map((day, i) => (
                <Row key={day.date} between style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: palette.hairline }}>
                  <Text variant="body" style={{ width: 88 }}>
                    {i === 0 ? 'Today' : new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                  </Text>
                  <Icon name={weatherIcon(day.code)} size={20} color={palette.textMuted} weight="fill" />
                  <Row gap={4} style={{ width: 60, justifyContent: 'flex-end' }}>
                    <Icon name="umbrella" size={13} color={palette.info} />
                    <Text variant="caption" color={palette.info}>
                      {Math.round(day.precipProbPct ?? 0)}%
                    </Text>
                  </Row>
                  <Text variant="bodyStrong" style={{ width: 70, textAlign: 'right' }}>
                    {Math.round(day.tempMaxC ?? 0)}° / {Math.round(day.tempMinC ?? 0)}°
                  </Text>
                </Row>
              ))}
            </Card>
          </Reveal>
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Icon name={icon} size={18} color="rgba(255,255,255,0.85)" />
      <Text variant="bodyStrong" color="#fff">
        {value}
      </Text>
      <Text variant="caption" color="rgba(255,255,255,0.7)">
        {label}
      </Text>
    </View>
  );
}

function fmtRange(a: string, b: string) {
  const f = (s: string) => new Date(s).toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true });
  return `${f(a)}–${f(b)}`;
}
