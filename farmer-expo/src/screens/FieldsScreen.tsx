import React from 'react';
import { RefreshControl, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { useT } from '../i18n';
import type { Field } from '../api/types';
import {
  Chip,
  Icon,
  EmptyState,
  ErrorState,
  PressableScale,
  ProgressBar,
  Reveal,
  Row,
  ScreenHeader,
  SkeletonList,
  Text,
  cropMeta,
  growthStage,
  palette,
  radius,
  shadow,
  space,
} from '../ui';
import type { FieldsStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<FieldsStackParams, 'FieldsList'>;

export default function FieldsScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const { data, loading, error, refreshing, reload } = useApi<{ fields: Field[] }>('/api/fields');
  const fields = data?.fields ?? [];

  const acres = fields.reduce((s, f) => s + (f.area_acres ?? 0), 0);
  const unmapped = fields.filter((f) => f.lat == null).length;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor="#fff" />
        }
      >
        <ScreenHeader
          tone="crop"
          title={t('My fields')}
          subtitle={
            fields.length
              ? t('Every plot you scan, plan and track')
              : t('Register a plot to get started')
          }
          right={
            fields.length > 0 ? (
              <PressableScale onPress={() => nav.navigate('FieldForm')} compact>
                <Row gap={5} style={styles.addPill}>
                  <Icon name="plus" size={15} color="#fff" weight="bold" />
                  <Text variant="label" color="#fff">
                    {t('Add')}
                  </Text>
                </Row>
              </PressableScale>
            ) : undefined
          }
          stats={
            fields.length
              ? [
                  { label: t('Plots'), value: fields.length, icon: 'fields' },
                  { label: t('Acres'), value: acres ? round1(acres) : '—', icon: 'chart' },
                  { label: t('To map'), value: unmapped, icon: 'hotspot' },
                ]
              : undefined
          }
        />

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
          {loading ? (
            <SkeletonList count={3} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : fields.length === 0 ? (
            <EmptyState
              icon="fields"
              title={t('Add your first field')}
              body={t(
                'Register a plot to scan crops, get weather-risk alerts and a crop calendar.',
              )}
              action={{ label: t('Add a field'), onPress: () => nav.navigate('FieldForm') }}
            />
          ) : (
            fields.map((f, i) => (
              <Reveal key={f.id} index={Math.min(i, 6)}>
                <FieldCard
                  field={f}
                  onPress={() => nav.navigate('FieldDetail', { fieldId: f.id })}
                  t={t}
                />
              </Reveal>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function FieldCard({
  field,
  onPress,
  t,
}: {
  field: Field;
  onPress: () => void;
  t: ReturnType<typeof useT>;
}) {
  const meta = cropMeta(field.crop);
  const stage = growthStage(field.days_since_sown, field.crop);
  const place = [field.village, field.district].filter(Boolean).join(', ');

  return (
    <PressableScale onPress={onPress} style={[styles.card, shadow.e0]}>
      <View style={{ width: 5, backgroundColor: meta.tint }} />
      <View style={{ flex: 1, padding: space.lg, gap: space.sm }}>
        <Row between>
          <Row gap={space.sm} style={{ flex: 1 }}>
            <View style={[styles.tile, { backgroundColor: meta.soft }]}>
              <Icon name={meta.icon} size={19} color={meta.tint} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="heading" raw numberOfLines={1}>
                {field.name || meta.label}
              </Text>
              <Text variant="caption" muted raw numberOfLines={1}>
                {[field.variety, field.area_acres ? `${field.area_acres} ${t('acre')}` : null]
                  .filter(Boolean)
                  .join(' · ') || t('area not set')}
              </Text>
            </View>
          </Row>
          <Chip label={meta.label} bg={meta.soft} color={meta.tint} size="sm" />
        </Row>

        {stage ? (
          <View style={{ gap: 5 }}>
            <Row between>
              <Text variant="caption" raw style={{ color: meta.tint, fontWeight: '700' }}>
                {t(stage.label)}
              </Text>
              <Text variant="caption" faint raw>
                {field.days_since_sown} {t('days in')}
              </Text>
            </Row>
            <ProgressBar pct={stage.pct} color={meta.tint} />
          </View>
        ) : (
          <Row gap={5}>
            <Icon name="calendar" size={12} color={palette.textFaint} />
            <Text variant="caption" faint>
              {t('Sowing date not set')}
            </Text>
          </Row>
        )}

        {field.lat == null ? (
          <Row gap={5} style={{ ...styles.locNudge, marginTop: 2 }}>
            <Icon name="hotspot" size={13} color={palette.warn} weight="fill" />
            <Text variant="caption" color={palette.warn}>
              {t('Add location for risk & weather')}
            </Text>
          </Row>
        ) : place ? (
          <Row gap={5}>
            <Icon name="hotspot" size={12} color={palette.textFaint} weight="fill" />
            <Text variant="caption" faint raw>
              {place}
            </Text>
          </Row>
        ) : null}
      </View>
    </PressableScale>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

const styles = {
  addPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
  },
  card: {
    flexDirection: 'row' as const,
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    overflow: 'hidden' as const,
  },
  tile: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  locNudge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: palette.warnSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
};
