import React from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import type { Field } from '../api/types';
import {
  Button,
  Card,
  Chip,
  Icon,
  EmptyState,
  ErrorState,
  OrganicBackground,
  Reveal,
  Row,
  SkeletonList,
  Text,
  palette,
  severity as sev,
  space,
} from '../ui';
import type { FieldsStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<FieldsStackParams, 'FieldsList'>;

export default function FieldsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refreshing, reload } = useApi<{ fields: Field[] }>('/api/fields');
  const fields = data?.fields ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="green" height={190 + insets.top} />
      <Animated.ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingHorizontal: space.lg,
          paddingBottom: 120,
          gap: space.md,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={palette.primary} />}
      >
        <View style={{ marginBottom: space.sm }}>
          <Text variant="hero" color={palette.primaryDeep}>
            My fields
          </Text>
          <Text variant="body" muted>
            {fields.length} plot{fields.length === 1 ? '' : 's'}
          </Text>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : fields.length === 0 ? (
          <EmptyState
            icon="fields"
            title="Add your first field"
            body="Register a plot to scan crops, get weather-risk alerts and a crop calendar."
            action={{ label: 'Add a field', onPress: () => nav.navigate('FieldForm') }}
          />
        ) : (
          fields.map((f, i) => (
            <Reveal key={f.id} index={i}>
              <FieldCard field={f} onPress={() => nav.navigate('FieldDetail', { fieldId: f.id })} />
            </Reveal>
          ))
        )}
      </Animated.ScrollView>

      {fields.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(250)}
          style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.md }}
        >
          <Button title="Add a field" icon={<Icon name="plus" size={18} color="#fff" weight="bold" />} onPress={() => nav.navigate('FieldForm')} size="lg" />
        </Animated.View>
      )}
    </View>
  );
}

function FieldCard({ field, onPress }: { field: Field; onPress: () => void }) {
  return (
    <Card onPress={onPress} elevation="raised">
      <Row between>
        <Text variant="heading">{field.name || cap(field.crop)}</Text>
        <Chip label={field.crop} bg={palette.leafSoft} color={palette.primaryDeep} />
      </Row>
      <Text variant="body" muted>
        {field.variety ? `${field.variety} · ` : ''}
        {field.days_since_sown != null ? `${field.days_since_sown} days since sowing` : 'sowing date not set'}
        {field.area_acres ? ` · ${field.area_acres} acre` : ''}
      </Text>
      {field.lat == null && (
        <Row gap={6} style={{ marginTop: 2 }}>
          <Icon name="warning" size={13} color={palette.warn} weight="fill" />
          <Text variant="caption" color={palette.warn}>
            No location — add one for risk & weather
          </Text>
        </Row>
      )}
    </Card>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
