import React, { useState } from 'react';
import { FlatList, Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { alertT } from '../i18n/alert';
import type { Scheme, SchemeApplication } from '../api/types';
import {
  Button,
  Chip,
  Dot,
  Icon,
  ErrorState,
  EmptyState,
  Reveal,
  Row,
  ScreenHeader,
  SegmentedControl,
  SkeletonList,
  Text,
  palette,
  radius,
  shadow,
  space,
  PressableScale,
} from '../ui';

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Applied — submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Not approved',
  disbursed: 'Received',
};
const STATUS_COLOR: Record<string, string> = {
  submitted: palette.textMuted,
  under_review: palette.info,
  approved: palette.primary,
  rejected: palette.danger,
  disbursed: palette.success,
};

// Schemes have no category, so give each tile a stable colour from the palette
// (hashed off its id) — the grid reads as a mix, not a wall of one hue.
const ACCENTS: { fg: string; soft: string; icon: 'schemes' | 'money' | 'scroll' | 'shield' | 'leaf' | 'revenue' }[] = [
  { fg: palette.sky, soft: palette.skySoft, icon: 'schemes' },
  { fg: palette.iris, soft: palette.irisSoft, icon: 'scroll' },
  { fg: palette.primary, soft: palette.primarySoft, icon: 'leaf' },
  { fg: palette.gold, soft: palette.goldSoft, icon: 'money' },
  { fg: palette.coral, soft: palette.coralSoft, icon: 'shield' },
  { fg: '#3E8E9C', soft: '#D6EBEE', icon: 'revenue' },
];
const accentFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length]!;
};

export default function SchemesScreen() {
  const nav = useNavigation<any>();
  const [forMe, setForMe] = useState<'me' | 'all'>('me');
  const [applying, setApplying] = useState<string | null>(null);
  const [open, setOpen] = useState<Scheme | null>(null);
  const { data, loading, error, refreshing, reload } = useApi<{ schemes: Scheme[] }>('/api/schemes', {
    forMe: forMe === 'me',
  });
  const applied = useApi<{ applications: SchemeApplication[] }>('/api/schemes/applications');
  const byScheme = new Map((applied.data?.applications ?? []).map((a) => [a.scheme_id, a]));

  async function apply(scheme: Scheme) {
    setApplying(scheme.id);
    try {
      await api.request(`/api/schemes/${scheme.id}/apply`, { method: 'POST', body: {} });
      alertT('Application sent', 'Your extension officer will review it. Track it under "My schemes".');
      applied.reload();
    } catch (e) {
      alertT('Could not apply', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setApplying(null);
    }
  }

  const schemes = data?.schemes ?? [];
  const appliedN = applied.data?.applications?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <FlatList
        data={schemes}
        keyExtractor={(x) => x.id}
        numColumns={2}
        columnWrapperStyle={{ gap: space.md, justifyContent: 'flex-start' }}
        refreshing={refreshing}
        onRefresh={reload}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 0,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
          gap: space.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <ScreenHeader
              tone="scheme"
              title="Schemes & subsidies"
              subtitle="Government support you may be eligible for."
              style={{ marginHorizontal: -space.lg, marginBottom: space.md }}
              right={
                <PressableScale onPress={() => nav.navigate('MySchemes')} compact>
                  <Row gap={5} style={styles.headerPill}>
                    <Icon name="scroll" size={14} color="#fff" weight="fill" />
                    <Text variant="label" color="#fff">
                      My schemes
                    </Text>
                  </Row>
                </PressableScale>
              }
              stats={[
                { label: forMe === 'me' ? 'For you' : 'All', value: schemes.length, icon: 'schemes' },
                { label: 'Applied', value: appliedN, icon: 'taskDone' },
              ]}
            />
            <SegmentedControl
              value={forMe}
              onChange={setForMe}
              options={[
                { value: 'me', label: 'For me' },
                { value: 'all', label: 'All schemes' },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={5} />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : (
            <EmptyState icon="schemes" title="Nothing here" body="No matching schemes right now." />
          )
        }
        renderItem={({ item, index }) => {
          const app = byScheme.get(item.id);
          const statusColor = app ? STATUS_COLOR[app.status] ?? palette.textMuted : null;
          const ac = accentFor(item.id);
          return (
            <Reveal index={Math.min(index, 8)} style={{ flex: 1, maxWidth: '48.5%' }}>
              <PressableScale onPress={() => setOpen(item)} style={[styles.tile, shadow.e0]}>
                <View style={[styles.tileIcon, { backgroundColor: ac.soft }]}>
                  <Icon name={ac.icon} size={18} color={ac.fg} weight="fill" />
                </View>
                <Text variant="subhead" raw numberOfLines={3} style={{ flex: 1 }}>
                  {item.title}
                </Text>
                {statusColor ? (
                  <Row gap={5}>
                    <Dot color={statusColor} />
                    <Text variant="caption" color={statusColor} numberOfLines={1} style={{ flex: 1 }}>
                      {STATUS_LABEL[app!.status] ?? app!.status}
                    </Text>
                  </Row>
                ) : item.benefit_amount ? (
                  <Text variant="caption" raw numberOfLines={1} style={{ color: ac.fg, fontWeight: '700' }}>
                    {item.benefit_amount}
                  </Text>
                ) : (
                  <Text variant="caption" faint>
                    Tap for details
                  </Text>
                )}
              </PressableScale>
            </Reveal>
          );
        }}
      />

      <SchemeSheet
        scheme={open}
        app={open ? byScheme.get(open.id) : undefined}
        applying={!!open && applying === open.id}
        onClose={() => setOpen(null)}
        onApply={apply}
        onAsk={(s) => {
          setOpen(null);
          nav.navigate('SchemeThread', { schemeId: s.id, schemeTitle: s.title });
        }}
      />
    </View>
  );
}

function SchemeSheet({
  scheme,
  app,
  applying,
  onClose,
  onApply,
  onAsk,
}: {
  scheme: Scheme | null;
  app: SchemeApplication | undefined;
  applying: boolean;
  onClose: () => void;
  onApply: (s: Scheme) => void;
  onAsk: (s: Scheme) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!scheme) return null;
  const ac = accentFor(scheme.id);
  const statusColor = app ? STATUS_COLOR[app.status] ?? palette.textMuted : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }}>
          <Row gap={space.sm}>
            <View style={[styles.tileIcon, { backgroundColor: ac.soft, width: 40, height: 40 }]}>
              <Icon name={ac.icon} size={20} color={ac.fg} weight="fill" />
            </View>
            <Text variant="title" raw style={{ flex: 1 }}>
              {scheme.title}
            </Text>
            <PressableScale onPress={onClose} compact hitSlop={8}>
              <Icon name="close" size={22} color={palette.textMuted} />
            </PressableScale>
          </Row>

          {scheme.match_reasons?.length ? (
            <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
              {scheme.match_reasons.map((r) => (
                <Chip key={r} label={r} size="sm" bg={palette.leafSoft} color={palette.primaryDeep} />
              ))}
            </Row>
          ) : null}

          {scheme.benefit_amount ? (
            <Row gap={space.xs}>
              <Icon name="money" size={16} color={ac.fg} weight="fill" />
              <Text variant="bodyStrong" color={ac.fg}>
                {scheme.benefit_amount}
              </Text>
            </Row>
          ) : null}

          {scheme.description ? (
            <Text variant="body" muted>
              {scheme.description}
            </Text>
          ) : null}

          {app ? (
            <Row gap={6}>
              <Dot color={statusColor!} />
              <Text variant="caption" color={statusColor!}>
                {STATUS_LABEL[app.status] ?? app.status}
                {app.status === 'disbursed' && app.amount
                  ? ` · ₹${Math.round(app.amount).toLocaleString('en-IN')}`
                  : ''}
              </Text>
            </Row>
          ) : (
            <Button
              title="Apply for this"
              variant="soft"
              loading={applying}
              onPress={() => onApply(scheme)}
            />
          )}

          <PressableScale onPress={() => onAsk(scheme)} style={{ alignSelf: 'flex-start' }}>
            <Row gap={5} style={{ paddingVertical: 6 }}>
              <Icon name="alerts" size={14} color={palette.textMuted} />
              <Text variant="caption" muted>
                Ask a question about this
              </Text>
            </Row>
          </PressableScale>

          {scheme.apply_link ? (
            <PressableScale onPress={() => Linking.openURL(scheme.apply_link!)} style={{ alignSelf: 'flex-start' }}>
              <Row gap={4}>
                <Text variant="caption" color={palette.textMuted}>
                  Official page
                </Text>
                <Icon name="arrowRight" size={13} color={palette.textMuted} />
              </Row>
            </PressableScale>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = {
  headerPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: space.md,
    gap: space.sm,
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  backdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    marginTop: 'auto' as const,
    maxHeight: '82%' as const,
    backgroundColor: palette.canvas,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  grabber: {
    alignSelf: 'center' as const,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
    marginBottom: space.md,
  },
};
