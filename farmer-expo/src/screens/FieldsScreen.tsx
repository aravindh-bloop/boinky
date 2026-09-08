import React from 'react';
import { RefreshControl, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { useT } from '../i18n';
import type { Field } from '../api/types';
import {
  Card,
  Chip,
  Icon,
  EmptyState,
  ErrorState,
  OrganicBackground,
  PressableScale,
  Reveal,
  Row,
  SkeletonList,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import type { FieldsStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<FieldsStackParams, 'FieldsList'>;

export default function FieldsScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refreshing, reload } = useApi<{ fields: Field[] }>('/api/fields');
  const fields = data?.fields ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="sunrise" height={170 + insets.top} />
      <Animated.ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
      >
        <Row between style={{ marginBottom: space.xs, alignItems: 'flex-start' }}>
          <View>
            <Text variant="hero">
              {t('My fields')}
            </Text>
            <Text variant="body" muted>
              {t('{n} plots', { n: fields.length })}
            </Text>
          </View>
          {fields.length > 0 && (
            <PressableScale onPress={() => nav.navigate('FieldForm')} compact>
              <View style={styles.addPill}>
                <Icon name="plus" size={15} color={palette.primaryDeep} weight="bold" />
                <Text variant="label" color={palette.primaryDeep}>
                  {t('Add')}
                </Text>
              </View>
            </PressableScale>
          )}
        </Row>

        {loading ? (
          <SkeletonList count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : fields.length === 0 ? (
          <EmptyState
            icon="fields"
            title={t('Add your first field')}
            body={t('Register a plot to scan crops, get weather-risk alerts and a crop calendar.')}
            action={{ label: t('Add a field'), onPress: () => nav.navigate('FieldForm') }}
          />
        ) : (
          fields.map((f, i) => (
            <Reveal key={f.id} index={i}>
              <FieldCard field={f} onPress={() => nav.navigate('FieldDetail', { fieldId: f.id })} />
            </Reveal>
          ))
        )}
      </Animated.ScrollView>
    </View>
  );
}

function FieldCard({ field, onPress }: { field: Field; onPress: () => void }) {
  return (
    <Card onPress={onPress} elevation="raised">
      <Row between>
        <Text variant="heading" raw>
          {field.name || cap(field.crop)}
        </Text>
        <Chip label={field.crop} bg={palette.leafSoft} color={palette.primaryDeep} />
      </Row>
      <Text variant="caption" muted>
        {field.variety ? `${field.variety} · ` : ''}
        {field.days_since_sown != null
          ? `${field.days_since_sown} ${'days since sowing'}`
          : 'sowing date not set'}
        {field.area_acres ? ` · ${field.area_acres} acre` : ''}
      </Text>
      {(field.village || field.district) && (
        <Row gap={5}>
          <Icon name="hotspot" size={12} color={palette.textFaint} weight="fill" />
          <Text variant="caption" faint raw>
            {[field.village, field.district].filter(Boolean).join(', ')}
          </Text>
        </Row>
      )}
      {field.lat == null && (
        <Row gap={6} style={{ marginTop: 2 }}>
          <Icon name="warning" size={13} color={palette.warn} weight="fill" />
          <Text variant="caption" color={palette.warn}>
            {'No location — add one for risk & weather'}
          </Text>
        </Row>
      )}
    </Card>
  );
}

const styles = {
  addPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
