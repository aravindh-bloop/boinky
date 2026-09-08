import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
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
      ? {
          place: lw.place.label,
          current: lw.current,
          today: lw.daily[0] ?? null,
          topAdvisory: lw.advisories[0] ?? null,
          advisoryCount: lw.advisories.length,
          sprayWindow: lw.sprayWindow,
        }
      : null);

  const alerts = d.alerts.count + (d.nearbyOutbreaks?.count ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.lg,
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

        {/* the brief leads */}
        <AiBrief
          brief={briefApi.brief}
          loading={briefApi.loading}
          working={briefApi.working}
          onRefresh={briefApi.refresh}
          onAction={openInsight}
        />

        {/* status — weather + the three counts, one card */}
        <Reveal>
          <Card elevation="raised" padded={false}>
            {w && (
              <PressableScale onPress={() => nav.navigate('Weather')} feedback="tap">
                <View style={{ padding: space.lg, gap: space.xs }}>
                  <Row between>
                    <Row gap={space.md} style={{ alignItems: 'center' }}>
                      <Icon name={weatherIcon(w.current.code, w.current.isDay)} size={32} color={palette.primary} weight="fill" />
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
                      <Row gap={4}>
                        <Icon name="hotspot" size={10} color={palette.textFaint} weight="fill" />
                        <Text variant="caption" faint raw numberOfLines={1}>
                          {w.place ?? t('your field')}
                        </Text>
                      </Row>
                      {w.today && (
                        <Text variant="caption" faint raw>
                          H {Math.round(w.today.tempMaxC ?? 0)}°  L {Math.round(w.today.tempMinC ?? 0)}°
                        </Text>
                      )}
                    </View>
                  </Row>
                  {w.topAdvisory && (
                    <Row gap={6}>
                      <Icon name="warning" size={12} color={palette.honey} weight="fill" />
                      <Text variant="caption" color={palette.textMuted} style={{ flex: 1 }} numberOfLines={1} raw>
                        {w.topAdvisory.title}
                        {w.advisoryCount > 1 ? `  +${w.advisoryCount - 1}` : ''}
                      </Text>
                    </Row>
                  )}
                </View>
              </PressableScale>
            )}
            {w && <Divider />}
            <Row style={{ paddingVertical: space.md }}>
              <Glance value={d.tasks.today.length} label={t('today')} onPress={() => nav.navigate('Tasks')} />
              <Divider style={{ width: 1, height: 30 }} />
              <Glance
                value={d.tasks.overdueCount}
                label={t('overdue')}
                tint={d.tasks.overdueCount > 0 ? palette.honey : undefined}
                onPress={() => nav.navigate('Tasks')}
              />
              <Divider style={{ width: 1, height: 30 }} />
              <Glance
                value={alerts}
                label={t('alerts')}
                tint={alerts > 0 ? palette.danger : undefined}
                onPress={() => nav.navigate('Alerts')}
              />
            </Row>
          </Card>
        </Reveal>

        {/* recent scans */}
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {d.recentScans.map((s) => (
                  <PressableScale key={s.id} onPress={() => nav.navigate('ScanResult', { scanId: s.id })} compact>
                    <View style={{ width: 104, gap: 5 }}>
                      <Image
                        source={{ uri: s.image_url }}
                        style={{ width: 104, height: 104, borderRadius: radius.lg }}
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

        {/* shortcuts */}
        <Reveal index={2}>
          <Row gap={space.sm}>
            <QuietLink icon="fields" label={t('Fields')} onPress={() => nav.getParent()?.navigate('Fields' as never)} />
            <QuietLink icon="calendar" label={t('Calendar')} onPress={() => nav.navigate('Tasks')} />
            <QuietLink icon="activity" label={t('Activity')} onPress={() => nav.navigate('Activity')} />
            <QuietLink icon="money" label={t('Money')} onPress={() => nav.getParent()?.navigate('Stock' as never)} />
          </Row>
        </Reveal>
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
      <View style={{ alignItems: 'center', gap: 3 }}>
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
        <Icon name={icon} size={17} color={palette.primary} weight="regular" />
        <Text variant="caption" muted>
          {label}
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
