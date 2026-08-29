import { alertT } from '../i18n/alert';
import React from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import type { Activity, Field, FieldRisk, Scan } from '../api/types';
import {
  Card,
  Chip,
  Divider,
  Icon,
  LoaderScreen,
  ErrorState,
  OrganicBackground,
  PodCard,
  RiskGauge,
  Reveal,
  Row,
  Sparkline,
  Text,
  palette,
  riskLevel,
  space,
  PressableScale,
} from '../ui';
import type { FieldsStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<FieldsStackParams, 'FieldDetail'>;
type R = RouteProp<FieldsStackParams, 'FieldDetail'>;

export default function FieldDetailScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { fieldId } = useRoute<R>().params;

  const field = useApi<{ field: Field }>(`/api/fields/${fieldId}`);
  const risk = useApi<FieldRisk>(`/api/risk/${fieldId}`);
  const scans = useApi<{ scans: Scan[] }>('/api/scans', { fieldId, limit: 4 });
  const acts = useApi<{ activities: Activity[] }>('/api/activities', { fieldId, limit: 4 });

  if (field.loading) return <LoaderScreen label="Loading field" />;
  if (field.error) return <ErrorState message={field.error} onRetry={field.reload} />;
  const f = field.data!.field;

  const remove = () =>
    alertT('Delete this field?', 'Its scans stay in your history, but risk and calendar are removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.request(`/api/fields/${fieldId}`, { method: 'DELETE' });
            nav.goBack();
          } catch (e) {
            alertT('Could not delete', e instanceof ApiError ? e.message : '');
          }
        },
      },
    ]);

  const r = risk.data?.today;
  const level = (r?.risk_level ?? 'low') as 'low' | 'medium' | 'high';
  const outlook = risk.data?.outlook ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint={level === 'low' ? 'green' : 'harvest'} height={250 + insets.top} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 52, paddingHorizontal: space.lg, paddingBottom: space.giant, gap: space.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={field.refreshing || risk.refreshing}
            onRefresh={() => {
              field.reload();
              risk.reload();
              scans.reload();
              acts.reload();
            }}
            tintColor={palette.primary}
          />
        }
      >
        <Reveal>
          <Row between>
            <View style={{ flex: 1 }}>
              <Text variant="hero" color={palette.primaryDeep}>
                {f.name || cap(f.crop)}
              </Text>
              <Text variant="body" muted>
                {f.variety ? `${f.variety} · ` : ''}
                {f.sown_date ? `sown ${f.sown_date}` : 'no sowing date'}
                {f.days_since_sown != null ? ` · day ${f.days_since_sown}` : ''}
              </Text>
            </View>
            <Chip label={f.crop} bg={palette.surface} color={palette.primaryDeep} />
          </Row>
        </Reveal>

        {/* quick actions */}
        <Reveal index={1}>
          <Row gap={space.sm}>
            <Qa icon="weather" label="Weather" onPress={() => nav.navigate('Weather', { fieldId })} />
            <Qa icon="calendar" label="Calendar" onPress={() => nav.navigate('Calendar', { fieldId, crop: f.crop })} />
            <Qa icon="activity" label="Log work" onPress={() => nav.navigate('LogActivity', { fieldId })} />
          </Row>
        </Reveal>

        {/* risk */}
        <Reveal index={2}>
          <Card elevation="raised" style={{ alignItems: 'center', gap: space.md }}>
            {risk.loading ? (
              <Text variant="body" muted>
                Checking weather risk…
              </Text>
            ) : risk.error ? (
              <Text variant="body" color={palette.warn} center>
                {risk.error}
              </Text>
            ) : r ? (
              <>
                <RiskGauge score={r.risk_score ?? 0} level={level} size={200} />
                <Text variant="bodyStrong" center>
                  {r.risk_reason}
                </Text>
                {outlook.length > 1 && (
                  <View style={{ width: '100%', gap: space.xs }}>
                    <Divider />
                    <Text variant="label" muted>
                      RISK — NEXT FEW DAYS
                    </Text>
                    <Sparkline data={outlook.map((d) => d.score)} color={riskLevel[level].fg} width={260} height={54} />
                  </View>
                )}
              </>
            ) : null}
          </Card>
        </Reveal>

        {/* hardware pod */}
        <Reveal index={3}>
          <PodCard
            fieldId={fieldId}
            onConnect={() =>
              alertT(
                'Connect a field pod',
                'Ask your officer or the AgriPod team to pair a sensor pod with this field. Once it is on, live readings show here.',
              )
            }
          />
        </Reveal>

        {/* recent scans */}
        <Reveal index={4}>
          <Card elevation="flat">
            <Row between>
              <Text variant="subhead">Recent scans</Text>
              <Icon name="scan" size={16} color={palette.textFaint} />
            </Row>
            {scans.data?.scans?.length ? (
              scans.data.scans.map((sc, i) => (
                <View key={sc.id}>
                  {i > 0 && <Divider style={{ marginVertical: space.xs }} />}
                  <Row between>
                    <Text variant="body">{sc.diagnosis_label ?? '—'}</Text>
                    <Text variant="caption" faint>
                      {sc.status.replace(/_/g, ' ')}
                    </Text>
                  </Row>
                </View>
              ))
            ) : (
              <Text variant="body" muted>
                No scans on this field yet.
              </Text>
            )}
          </Card>
        </Reveal>

        {/* activity */}
        <Reveal index={5}>
          <Card elevation="flat">
            <Row between>
              <Text variant="subhead">Activity</Text>
              <PressableScale onPress={() => nav.navigate('LogActivity', { fieldId })}>
                <Text variant="label" color={palette.primary}>
                  Log
                </Text>
              </PressableScale>
            </Row>
            {acts.data?.activities?.length ? (
              acts.data.activities.map((a, i) => (
                <View key={a.id}>
                  {i > 0 && <Divider style={{ marginVertical: space.xs }} />}
                  <Row between>
                    <Text variant="body">{a.title}</Text>
                    <Text variant="caption" faint>
                      {fmt(a.activity_date)}
                    </Text>
                  </Row>
                </View>
              ))
            ) : (
              <Text variant="body" muted>
                Nothing logged yet.
              </Text>
            )}
          </Card>
        </Reveal>

        <PressableScale onPress={remove} style={{ alignSelf: 'center', padding: space.md }}>
          <Text variant="bodyStrong" color={palette.danger}>
            Delete field
          </Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

function Qa({ icon, label, onPress, disabled }: { icon: any; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={{ flex: 1 }} compact>
      <View
        style={{
          backgroundColor: palette.surface,
          borderRadius: 16,
          paddingVertical: space.md,
          alignItems: 'center',
          gap: 4,
          borderWidth: 1,
          borderColor: palette.hairline,
        }}
      >
        <Icon name={icon} size={20} color={palette.primaryDeep} weight="fill" />
        <Text variant="caption" muted>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
