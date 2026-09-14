import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { api, ApiError } from '../api/client';
import { useApi } from '../api/useApi';
import { useT } from '../i18n';
import type { DirectoryContact, EscalationOptions, Rung } from '../api/types';
import {
  Button,
  Card,
  Field,
  Icon,
  LoaderScreen,
  ErrorState,
  PressableScale,
  Row,
  ScreenHeader,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';
import { RUNG_ICON } from './insuranceShared';

type R = RouteProp<InsuranceStackParams, 'Escalate'>;

export default function EscalateScreen() {
  const nav = useNavigation<any>();
  const t = useT();
  const { claimId } = useRoute<R>().params;
  const { data, loading, error, reload } = useApi<EscalationOptions>(
    `/api/insurance/claims/${claimId}/escalation`,
  );
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState<Rung | null>(null);
  const [letterOpen, setLetterOpen] = useState(false);

  if (loading) return <LoaderScreen label="Finding the right officer" />;
  if (error || !data) return <ErrorState message={error ?? 'Not found'} onRetry={reload} />;

  async function shareLetter() {
    try {
      await Share.share({ message: data!.letterEn });
    } catch {
      /* user cancelled */
    }
  }

  async function logEscalation(rung: Rung, channel: string, contact?: DirectoryContact) {
    setSending(rung);
    try {
      await api.request(`/api/insurance/claims/${claimId}/escalate`, {
        method: 'POST',
        body: {
          rung,
          channel,
          reason: reason.trim() || t('Claim not progressing within the PMFBY time limits.'),
          directoryId: contact?.id,
        },
      });
      alertT(t('Logged'), t('Your escalation is recorded. We will remind you to follow up.'));
      nav.goBack();
    } catch (e) {
      alertT(t('Could not log it'), e instanceof ApiError ? e.message : '');
    } finally {
      setSending(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          tone="alert"
          title={t('Escalate this claim')}
          subtitle={
            data.district
              ? t('Contacts for {d} district, in the order to try them.', { d: data.district })
              : t('Add your district to the policy for local contacts.')
          }
          onBack={() => nav.goBack()}
        />

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
          {/* the grievance letter — collapsed to a preview by default */}
          <Card elevation="raised" accent={palette.iris}>
            <Row between>
              <Text variant="overline">{t('Ready-to-send grievance')}</Text>
              <PressableScale onPress={shareLetter} compact>
                <Row gap={4}>
                  <Icon name="arrowRight" size={13} color={palette.iris} />
                  <Text variant="label" color={palette.iris}>
                    {t('Share / copy')}
                  </Text>
                </Row>
              </PressableScale>
            </Row>
            <PressableScale onPress={() => setLetterOpen((v) => !v)} feedback="tap">
              <View
                style={{
                  backgroundColor: palette.surfaceSunken,
                  borderRadius: radius.md,
                  padding: space.sm,
                }}
              >
                <Text
                  variant="caption"
                  raw
                  selectable={letterOpen}
                  numberOfLines={letterOpen ? undefined : 2}
                  style={{ lineHeight: 18 }}
                >
                  {data.letterEn}
                </Text>
                <Row gap={4} style={{ marginTop: space.xs }}>
                  <Text variant="label" color={palette.iris}>
                    {letterOpen ? t('Show less') : t('Read full letter')}
                  </Text>
                  <Icon name={letterOpen ? 'up' : 'right'} size={12} color={palette.iris} weight="bold" />
                </Row>
              </View>
            </PressableScale>
            <Text variant="caption" faint>
              {t('A Tamil version is sent with the escalation. Attach your policy slip and loss photos when you send it.')}
            </Text>
          </Card>

          <Field
            label={t('Your specific ask (optional)')}
            value={reason}
            onChangeText={setReason}
            placeholder={t('e.g. Please get the survey report filed and the claim moved forward')}
            multiline
          />

          {/* rungs */}
          {data.rungs.map((r, i) => (
            <RungCard
              key={r.rung}
              rung={r}
              recommended={data.recommended === r.rung}
              order={i + 1}
              sending={sending === r.rung}
              onCall={(c) => {
                if (c.phone) Linking.openURL(`tel:${c.phone.replace(/[^0-9+]/g, '')}`);
                logEscalation(r.rung, 'call', c);
              }}
              onSms={(c) => {
                if (c.phone) Linking.openURL(`sms:${c.phone.replace(/[^0-9+]/g, '')}`);
                logEscalation(r.rung, 'sms', c);
              }}
              onEmail={(c) => {
                if (c.email)
                  Linking.openURL(
                    `mailto:${c.email}?subject=${encodeURIComponent('PMFBY claim grievance')}&body=${encodeURIComponent(data.letterEn)}`,
                  );
                logEscalation(r.rung, 'email', c);
              }}
              onOpen={(c) => {
                if (c.url) Linking.openURL(c.url);
                logEscalation(r.rung, r.rung === 'krph' ? 'krph' : r.rung === 'cpgrams' ? 'cpgrams' : 'in_person', c);
              }}
              t={t}
            />
          ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function RungCard({
  rung,
  recommended,
  order,
  sending,
  onCall,
  onSms,
  onEmail,
  onOpen,
  t,
}: {
  rung: EscalationOptions['rungs'][number];
  recommended: boolean;
  order: number;
  sending: boolean;
  onCall: (c: DirectoryContact) => void;
  onSms: (c: DirectoryContact) => void;
  onEmail: (c: DirectoryContact) => void;
  onOpen: (c: DirectoryContact) => void;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(recommended);
  const accent = recommended ? palette.coral : palette.sky;

  return (
    <Card elevation="flat" accent={accent}>
      <PressableScale onPress={() => setOpen((v) => !v)} feedback="tap">
        <Row between>
          <Row gap={space.sm} style={{ flex: 1 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: radius.md,
                backgroundColor: recommended ? palette.coralSoft : palette.skySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={RUNG_ICON[rung.rung] ?? 'shield'} size={15} color={accent} weight="fill" />
            </View>
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <Text variant="subhead" raw numberOfLines={1} style={{ flexShrink: 1 }}>
                  {t(rung.label)}
                </Text>
                {recommended && (
                  <View style={{ backgroundColor: palette.coralSoft, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text variant="caption" color={palette.coral}>
                      {t('start here')}
                    </Text>
                  </View>
                )}
              </Row>
              <Text variant="caption" muted>
                {t('Step {n}', { n: order })} · {t(rung.role)}
              </Text>
            </View>
          </Row>
          <Icon name={open ? 'up' : 'right'} size={14} color={accent} weight="bold" />
        </Row>
      </PressableScale>

      {open && (
        <Animated.View entering={FadeIn.duration(150)} style={{ gap: space.sm, marginTop: space.sm }}>
          {rung.contacts.length === 0 ? (
            <Text variant="caption" faint>
              {t('No saved contact for this step yet — use KRPH 14447 or CPGRAMS below.')}
            </Text>
          ) : (
            rung.contacts.map((c) => (
              <View
                key={c.id}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: palette.hairline,
                  paddingTop: space.sm,
                  gap: 4,
                }}
              >
                <Row gap={6}>
                  <Text variant="bodyStrong" raw style={{ flex: 1 }}>
                    {c.name ?? c.designation}
                  </Text>
                  {c.verified ? (
                    <Icon name="check" size={13} color={palette.success} weight="fill" />
                  ) : (
                    <Text variant="caption" faint>
                      {t('unverified')}
                    </Text>
                  )}
                </Row>
                {c.name && c.designation !== c.name ? (
                  <Text variant="caption" muted raw>
                    {c.designation}
                  </Text>
                ) : null}
                {c.office ? (
                  <Text variant="caption" faint raw>
                    {c.office}
                  </Text>
                ) : null}
                {c.note ? (
                  <Text variant="caption" muted raw>
                    {c.note}
                  </Text>
                ) : null}
                <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: 4 }}>
                  {c.phone ? (
                    <MiniBtn icon="alerts" label={t('Call')} onPress={() => onCall(c)} busy={sending} />
                  ) : null}
                  {c.phone ? (
                    <MiniBtn icon="mic" label={t('SMS')} onPress={() => onSms(c)} busy={sending} />
                  ) : null}
                  {c.email ? (
                    <MiniBtn icon="scroll" label={t('Email')} onPress={() => onEmail(c)} busy={sending} />
                  ) : null}
                  {c.url ? (
                    <MiniBtn icon="arrowRight" label={t('Open')} onPress={() => onOpen(c)} busy={sending} />
                  ) : null}
                </Row>
              </View>
            ))
          )}
        </Animated.View>
      )}
    </Card>
  );
}

function MiniBtn({
  icon,
  label,
  onPress,
  busy,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  busy: boolean;
}) {
  return (
    <PressableScale onPress={onPress} compact disabled={busy}>
      <Row
        gap={5}
        style={{
          backgroundColor: palette.primarySoft,
          borderRadius: radius.pill,
          paddingHorizontal: space.md,
          paddingVertical: 6,
        }}
      >
        <Icon name={icon} size={12} color={palette.primaryDeep} weight="fill" />
        <Text variant="label" color={palette.primaryDeep}>
          {label}
        </Text>
      </Row>
    </PressableScale>
  );
}
