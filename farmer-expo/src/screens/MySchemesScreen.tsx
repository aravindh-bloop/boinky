import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { alertT } from '../i18n/alert';
import type { SchemeApplication, SchemeThreadSummary } from '../api/types';
import {
  Card,
  Divider,
  EmptyState,
  Icon,
  LoaderScreen,
  PressableScale,
  Row,
  SegmentedControl,
  Text,
  palette,
  space,
} from '../ui';

const STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: palette.textMuted },
  under_review: { label: 'Under review', color: palette.info },
  approved: { label: 'Approved', color: palette.primary },
  rejected: { label: 'Not approved', color: palette.danger },
  disbursed: { label: 'Received', color: palette.success },
};

export default function MySchemesScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const [tab, setTab] = useState<'apps' | 'questions'>('apps');
  const apps = useApi<{ applications: SchemeApplication[] }>('/api/schemes/applications');
  const threads = useApi<{ threads: SchemeThreadSummary[] }>('/api/schemes/threads');

  if (apps.loading && threads.loading) return <LoaderScreen label="Loading" />;

  async function withdraw(id: string) {
    try {
      await api.request(`/api/schemes/applications/${id}`, { method: 'DELETE' });
      apps.reload();
    } catch (e) {
      alertT('Could not withdraw', e instanceof ApiError ? e.message : '');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
      >
        <Text variant="hero" color={palette.primaryDeep}>
          My schemes
        </Text>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'apps', label: 'Applications' },
            { value: 'questions', label: 'Questions' },
          ]}
        />

        {tab === 'apps' ? (
          (apps.data?.applications ?? []).length === 0 ? (
            <EmptyState icon="scroll" title="No applications yet" body="Apply for a scheme from the Schemes list." />
          ) : (
            apps.data!.applications.map((a) => {
              const st = STATUS[a.status] ?? { label: a.status, color: palette.textMuted };
              return (
                <Card key={a.id} elevation="flat">
                  <Row between>
                    <Text variant="subhead" style={{ flex: 1 }}>
                      {a.scheme_title}
                    </Text>
                  </Row>
                  <Row gap={6}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
                    <Text variant="caption" color={st.color}>
                      {st.label}
                      {a.status === 'disbursed' && a.amount
                        ? ` · ₹${Math.round(a.amount).toLocaleString('en-IN')}`
                        : ''}
                    </Text>
                  </Row>
                  {a.officer_note ? (
                    <Text variant="body" muted style={{ fontStyle: 'italic' }}>
                      "{a.officer_note}"
                    </Text>
                  ) : null}
                  <Row gap={space.md} style={{ marginTop: space.xs }}>
                    <PressableScale
                      onPress={() =>
                        nav.navigate('SchemeThread', { schemeId: a.scheme_id, schemeTitle: a.scheme_title })
                      }
                      compact
                    >
                      <Text variant="caption" color={palette.primary}>
                        Ask about this
                      </Text>
                    </PressableScale>
                    {(a.status === 'submitted' || a.status === 'under_review') && (
                      <PressableScale onPress={() => withdraw(a.id)} compact>
                        <Text variant="caption" color={palette.danger}>
                          Withdraw
                        </Text>
                      </PressableScale>
                    )}
                  </Row>
                </Card>
              );
            })
          )
        ) : (threads.data?.threads ?? []).length === 0 ? (
          <EmptyState
            icon="alerts"
            title="No questions yet"
            body="Ask your extension officer about any scheme from the Schemes list."
          />
        ) : (
          <Card elevation="flat" style={{ padding: 0 }}>
            {threads.data!.threads.map((t, i) => (
              <View key={t.id}>
                {i > 0 && <Divider />}
                <PressableScale
                  onPress={() => nav.navigate('SchemeThread', { threadId: t.id, schemeTitle: t.scheme_title })}
                  style={{ padding: space.md }}
                >
                  <Row between>
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {t.subject}
                    </Text>
                    <Icon
                      name="right"
                      size={16}
                      color={t.status === 'answered' ? palette.success : palette.textFaint}
                    />
                  </Row>
                  {t.last_message ? (
                    <Text variant="caption" muted numberOfLines={1}>
                      {t.last_message}
                    </Text>
                  ) : null}
                </PressableScale>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
