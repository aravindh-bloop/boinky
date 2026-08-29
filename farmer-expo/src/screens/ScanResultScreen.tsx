import { alertT } from '../i18n/alert';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useT } from '../i18n';
import type { SafetyReport, Scan } from '../api/types';
import {
  Button,
  Card,
  Chip,
  Divider,
  LoaderScreen,
  ErrorState,
  Reveal,
  Icon,
  Row,
  Text,
  palette,
  radius,
  severity as sevTokens,
  space,
} from '../ui';
import type { ScanStackParams } from '../navigation';

type R = RouteProp<ScanStackParams, 'ScanResult'>;

const STATUS: Record<string, { label: string; color: string }> = {
  auto_confirmed: { label: 'AI diagnosis', color: palette.primary },
  needs_validation: { label: 'Sent to an expert for review', color: palette.warn },
  validated: { label: 'Confirmed by an officer', color: palette.primary },
  corrected: { label: 'Corrected by an officer', color: palette.info },
  rejected: { label: 'Not a valid crop photo', color: palette.danger },
  pending: { label: 'Processing', color: palette.textMuted },
};

const VERDICT: Record<string, string> = {
  safe: palette.success,
  caution: palette.warn,
  unsafe: palette.danger,
  unknown: palette.textMuted,
};

export default function ScanResultScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { scanId } = useRoute<R>().params;
  const { data, loading, error, reload } = useApi<{ scan: Scan }>(`/api/scans/${scanId}`);
  const [safety, setSafety] = useState<SafetyReport | null>(null);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [advisoryBusy, setAdvisoryBusy] = useState(false);

  const scan = data?.scan;
  // The advisory is written in the background after the scan lands. Poll until it
  // shows up (or we give up). Rejected / non-plant scans never get one.
  const awaitingAdvisory =
    !!scan && scan.status !== 'rejected' && !scan.advisory_text;
  const pollCount = useRef(0);
  useEffect(() => {
    if (!awaitingAdvisory) {
      pollCount.current = 0;
      return;
    }
    if (pollCount.current >= 12) return; // ~36s, then show retry
    const t = setTimeout(() => {
      pollCount.current += 1;
      reload();
    }, 3000);
    return () => clearTimeout(t);
  }, [awaitingAdvisory, data, reload]);

  if (loading) return <LoaderScreen label="Loading diagnosis" />;
  if (error || !scan) return <ErrorState message={error ?? 'Scan not found'} onRetry={reload} />;
  const st = STATUS[scan.status] ?? { label: scan.status, color: palette.textMuted };
  const conf = scan.confidence != null ? Math.round(scan.confidence * 100) : null;
  const sev = scan.severity as 'low' | 'medium' | 'high' | null;

  async function checkSafety() {
    setSafetyBusy(true);
    try {
      setSafety(await api.request<SafetyReport>(`/api/scans/${scanId}/safety`));
    } catch (e) {
      alertT('Safety check failed', e instanceof ApiError ? e.message : '');
    } finally {
      setSafetyBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn}>
          <Image
            source={{ uri: scan.image_url }}
            style={{ width: '100%', height: 300 }}
            contentFit="cover"
            transition={250}
          />
        </Animated.View>

        <View style={{ padding: space.lg, gap: space.md, marginTop: -space.xxl }}>
          <Reveal from="scale">
            <Card elevation="raised">
              <Row between>
                <Text variant="title" style={{ flex: 1 }} raw>
                  {scan.diagnosis_label ?? t('Unknown')}
                </Text>
                {sev && <Chip label={t('{sev} severity', { sev: t(sevTokens[sev].label) })} bg={sevTokens[sev].bg} color={sevTokens[sev].fg} />}
              </Row>
              <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                {conf != null && <Chip label={t('{pct}% confident', { pct: conf })} bg={palette.surfaceSunken} color={palette.textMuted} />}
                {scan.diagnosis_category && (
                  <Chip label={t(scan.diagnosis_category)} bg={palette.surfaceSunken} color={palette.textMuted} />
                )}
              </Row>
              <Row gap={6}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
                <Text variant="caption" color={st.color}>
                  {st.label}
                </Text>
              </Row>
              {scan.validation_note ? (
                <Text variant="body" style={{ fontStyle: 'italic' }} color={palette.info}>
                  “{scan.validation_note}”
                </Text>
              ) : null}
            </Card>
          </Reveal>

          {scan.farmer_note ? (
            <Reveal index={1}>
              <Card elevation="flat">
                <Row gap={space.sm}>
                  <Icon name="mic" size={16} color={palette.textMuted} weight="fill" />
                  <Text variant="subhead">What you told us</Text>
                  {scan.farmer_note_language ? (
                    <Text variant="caption" faint>
                      {scan.farmer_note_language}
                    </Text>
                  ) : null}
                </Row>
                <Text variant="body" muted style={{ fontStyle: 'italic' }}>
                  “{scan.farmer_note}”
                </Text>
                <Text variant="caption" faint>
                  Sent to the diagnosis along with your photo.
                </Text>
              </Card>
            </Reveal>
          ) : null}

          {scan.advisory_text ? (
            <Reveal index={1}>
              <Card accent={palette.leaf}>
                <Text variant="subhead">What to do</Text>
                <Text variant="body" style={{ lineHeight: 24 }}>
                  {scan.advisory_text}
                </Text>
              </Card>
            </Reveal>
          ) : awaitingAdvisory ? (
            <Reveal index={1}>
              <Card accent={palette.leaf}>
                <Text variant="subhead">What to do</Text>
                {pollCount.current >= 12 ? (
                  <View style={{ gap: space.sm }}>
                    <Text variant="body" muted>
                      Advice is taking longer than usual to write.
                    </Text>
                    <Button
                      title="Try again"
                      variant="soft"
                      loading={advisoryBusy}
                      onPress={async () => {
                        setAdvisoryBusy(true);
                        try {
                          await api.request(`/api/scans/${scanId}/advisory/retry`, { method: 'POST' });
                          pollCount.current = 0;
                          reload();
                        } catch (e) {
                          alertT('Still failed', e instanceof ApiError ? e.message : '');
                        } finally {
                          setAdvisoryBusy(false);
                        }
                      }}
                    />
                  </View>
                ) : (
                  <Row gap={space.sm}>
                    <ActivityIndicator color={palette.primary} />
                    <Text variant="body" muted>
                      Writing advice in your language…
                    </Text>
                  </Row>
                )}
              </Card>
            </Reveal>
          ) : null}

          {scan.status !== 'rejected' && (
            <Reveal index={2}>
              <Card elevation="flat">
                <Text variant="subhead">Pesticide safety check</Text>
                <Text variant="caption" faint>
                  Checks recommended sprays against your crop's harvest window
                </Text>
                {!safety ? (
                  <Button title="Run safety check" variant="soft" onPress={checkSafety} loading={safetyBusy} />
                ) : (
                  <View style={{ gap: space.sm }}>
                    <Chip
                      label={`Overall: ${safety.overall.toUpperCase()}`}
                      bg={VERDICT[safety.overall] + '22'}
                      color={VERDICT[safety.overall]}
                    />
                    {safety.daysToHarvest != null && (
                      <Text variant="caption" faint>
                        about {safety.daysToHarvest} days to harvest
                      </Text>
                    )}
                    {safety.items.map((it, i) => (
                      <View key={i}>
                        {i > 0 && <Divider style={{ marginVertical: space.xs }} />}
                        <Text variant="bodyStrong">
                          {it.matched}
                          {it.phiDays != null ? ` — wait ${it.phiDays} days` : ''}
                        </Text>
                        <Text variant="caption" color={VERDICT[it.verdict]}>
                          {it.verdict.toUpperCase()} · {it.note}
                        </Text>
                        {it.source === 'ai_estimate' && (
                          <Text variant="caption" faint>
                            AI estimate — verify on the product label
                          </Text>
                        )}
                      </View>
                    ))}
                    <Text variant="caption" faint style={{ marginTop: space.xs }}>
                      {safety.disclaimer}
                    </Text>
                  </View>
                )}
              </Card>
            </Reveal>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
