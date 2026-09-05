import { alertT } from '../i18n/alert';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { useT } from '../i18n';
import type { ClaimDetail, ClaimEvent } from '../api/types';
import {
  Card,
  Chip,
  Divider,
  Icon,
  LoaderScreen,
  ErrorState,
  Row,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';
import { CLAIM_STATUS } from './InsuranceScreen';

type R = RouteProp<InsuranceStackParams, 'ClaimDetail'>;

const STEPS: { key: string; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under review' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
];
const STEP_INDEX: Record<string, number> = {
  submitted: 0,
  under_review: 1,
  surveyor_assigned: 1,
  approved: 2,
  rejected: 2,
  paid: 3,
};

const rupee = (n: number | null) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

export default function InsuranceClaimDetailScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { claimId } = useRoute<R>().params;
  const { data, loading, error, reload } = useApi<ClaimDetail>(`/api/insurance/claims/${claimId}`);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    const id = setInterval(reload, 12000);
    return () => clearInterval(id);
  }, [reload]);

  if (loading) return <LoaderScreen label="Loading claim" />;
  if (error || !data) return <ErrorState message={error ?? 'Claim not found'} onRetry={reload} />;

  const { claim, media, events } = data;
  const st = CLAIM_STATUS[claim.status] ?? { label: claim.status, color: palette.textMuted };
  const rejected = claim.status === 'rejected';
  const stepAt = STEP_INDEX[claim.status] ?? 0;

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await api.request(`/api/insurance/claims/${claimId}/messages`, { method: 'POST', body: { body } });
      setDraft('');
      reload();
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    } catch (e) {
      alertT('Could not send', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingTop: insets.top + space.md }}
      >
        <Row between>
          <Text variant="hero" color={palette.primaryDeep} style={{ flex: 1 }}>
            {claim.crop} · {t('claim')}
          </Text>
          <Chip label={t(st.label)} bg={st.color + '22'} color={st.color} />
        </Row>
        <Text variant="caption" muted>
          {claim.field_name ?? claim.season}
          {claim.incident_date ? ` · ${t('damage on')} ${claim.incident_date}` : ''}
        </Text>

        {/* status stepper */}
        {!rejected && (
          <Card elevation="flat">
            <Row style={{ justifyContent: 'space-between' }}>
              {STEPS.map((s, i) => {
                const done = i <= stepAt;
                return (
                  <View key={s.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: done ? palette.primary : palette.surfaceSunken,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {done ? (
                        <Icon name="check" size={13} color="#fff" weight="bold" />
                      ) : (
                        <Text variant="caption" faint raw>{i + 1}</Text>
                      )}
                    </View>
                    <Text variant="caption" center color={done ? palette.primaryDeep : palette.textFaint} style={{ fontSize: 10 }}>
                      {t(s.label)}
                    </Text>
                  </View>
                );
              })}
            </Row>
          </Card>
        )}

        {(claim.approved_amount != null || claim.assessed_loss_pct != null) && (
          <Card accent={claim.status === 'paid' ? palette.success : palette.primary}>
            <Row gap={space.lg}>
              {claim.assessed_loss_pct != null && (
                <View>
                  <Text variant="overline" color={palette.textFaint}>{t('Assessed loss')}</Text>
                  <Text variant="title">{claim.assessed_loss_pct}%</Text>
                </View>
              )}
              {claim.approved_amount != null && (
                <View>
                  <Text variant="overline" color={palette.textFaint}>
                    {claim.status === 'paid' ? t('Paid out') : t('Approved payout')}
                  </Text>
                  <Text variant="title" color={palette.success}>{rupee(claim.approved_amount)}</Text>
                </View>
              )}
            </Row>
            {claim.officer_note ? (
              <Text variant="body" muted style={{ fontStyle: 'italic', marginTop: space.xs }}>
                "{claim.officer_note}"
              </Text>
            ) : null}
          </Card>
        )}

        {claim.description ? (
          <Card elevation="flat">
            <Text variant="overline" color={palette.textFaint}>{t('What you reported')}</Text>
            <Text variant="body">{claim.description}</Text>
            {claim.scan_diagnosis ? (
              <Text variant="caption" faint>{t('Linked scan')}: {claim.scan_diagnosis}</Text>
            ) : null}
          </Card>
        ) : null}

        {/* evidence */}
        {media.length > 0 && (
          <View>
            <Text variant="overline" color={palette.textFaint} style={{ marginBottom: space.xs }}>
              {t('Evidence')} ({media.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {media.map((m) => (
                <View key={m.id} style={{ width: 132 }}>
                  <Image
                    source={{ uri: m.url }}
                    style={{ width: 132, height: 132, borderRadius: radius.lg, backgroundColor: palette.surfaceAlt }}
                    contentFit="cover"
                  />
                  {m.caption ? (
                    <Text variant="caption" faint numberOfLines={2} style={{ marginTop: 2 }}>{m.caption}</Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* timeline + conversation */}
        <Text variant="overline" color={palette.textFaint} style={{ marginTop: space.xs }}>
          {t('Progress')}
        </Text>
        {events.map((e) => (
          <TimelineRow key={e.id} e={e} t={t} />
        ))}
      </ScrollView>

      {/* message input */}
      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          padding: space.md,
          paddingBottom: insets.bottom + space.sm,
          borderTopWidth: 1,
          borderTopColor: palette.hairline,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('Message the officer…')}
          placeholderTextColor={palette.textFaint}
          multiline
          style={{
            flex: 1,
            maxHeight: 100,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: radius.lg,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            fontSize: 15,
            color: palette.text,
          }}
        />
        <Pressable
          onPress={send}
          disabled={sending || !draft.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: draft.trim() ? palette.primary : palette.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="arrowRight" size={18} color={draft.trim() ? '#fff' : palette.textFaint} weight="bold" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function TimelineRow({ e, t }: { e: ClaimEvent; t: (s: string) => string }) {
  if (e.kind === 'message') {
    const mine = e.actor_role === 'farmer';
    return (
      <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
        <View
          style={{
            backgroundColor: mine ? palette.primary : palette.surfaceAlt,
            borderRadius: radius.lg,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
          }}
        >
          <Text variant="body" color={mine ? '#fff' : palette.text}>{e.body}</Text>
        </View>
        <Text variant="caption" faint style={{ marginTop: 2, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
          {mine ? t('You') : t('Officer')}
        </Text>
      </View>
    );
  }
  return (
    <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.primary, marginTop: 6 }} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">
          {e.to_status ? t(CLAIM_STATUS[e.to_status]?.label ?? e.to_status) : t('Update')}
        </Text>
        {e.body ? <Text variant="body" muted>{e.body}</Text> : null}
      </View>
    </Row>
  );
}
