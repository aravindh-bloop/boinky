import React, { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { DailyBrief, InsightCard, InsightUrgency } from '../api/types';
import { useT, type TFunc } from '../i18n';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { PressableScale } from './Pressable';
import { Skeleton } from './Skeleton';
import { Row } from './misc';
import { gradients, palette, radius, shadow, space } from './tokens';

const ON = 'rgba(255,255,255,0.92)';
const ON_DIM = 'rgba(255,255,255,0.72)';

interface Props {
  brief: DailyBrief | null;
  loading: boolean;
  /** The model is running — show the working state. */
  working: boolean;
  onRefresh: () => void;
  onAction: (card: InsightCard) => void;
}

const URGENCY: Record<InsightUrgency, { fg: string; bg: string; label: string; rank: number }> = {
  critical: { fg: palette.danger, bg: palette.dangerSoft, label: 'Urgent', rank: 3 },
  action: { fg: palette.primary, bg: palette.primarySoft, label: 'Do this', rank: 2 },
  watch: { fg: palette.honey, bg: palette.warnSoft, label: 'Watch', rank: 1 },
  info: { fg: palette.info, bg: palette.surfaceSunken, label: 'Note', rank: 0 },
};

const CATEGORY_ICON: Record<InsightCard['category'], IconName> = {
  disease: 'disease',
  weather: 'weather',
  task: 'tasks',
  risk: 'shield',
  outbreak: 'hotspot',
  stock: 'stock',
  finance: 'money',
  general: 'insight',
};

/**
 * The AI daily brief on the dashboard.
 *
 * Collapsed by default — a soft-green card showing the single headline and how
 * many things need checking. Tap to open the full set of insight cards. Auto-
 * opens when there is something urgent. Renders nothing when there is no real
 * brief (an empty farm gets an empty screen, never generated filler).
 */
export function AiBrief({ brief, loading, working, onRefresh, onAction }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <Shell>
        <Header t={t} working />
        <Skeleton width="80%" height={16} />
      </Shell>
    );
  }
  if (!brief || brief.status === 'unavailable') return null;

  if (brief.status === 'generating') {
    return (
      <Shell>
        <Header t={t} working />
        <Text variant="bodyStrong" color={ON}>
          {t('Reading your fields, weather and tasks…')}
        </Text>
      </Shell>
    );
  }

  const cards = [...(brief.cards ?? [])].sort(
    (a, b) => URGENCY[b.urgency].rank - URGENCY[a.urgency].rank,
  );
  if (cards.length === 0) return null;

  return (
    <Shell>
      {/* collapsed head — always the tap target */}
      <PressableScale onPress={() => setOpen((v) => !v)} feedback="tap">
        <Header t={t} working={working} generatedAt={brief.generatedAt} />
        {brief.headline ? (
          <Text variant="subhead" color={ON} style={{ marginTop: space.xs }} raw>
            {brief.headline}
          </Text>
        ) : null}
        <Row between style={{ marginTop: space.sm }}>
          <Text variant="label" color={ON_DIM}>
            {t('{n} to check today', { n: cards.length })}
          </Text>
          <Row gap={4}>
            <Text variant="label" color={ON}>
              {open ? t('Close') : t('Open')}
            </Text>
            <Icon name={open ? 'up' : 'right'} size={13} color={ON} weight="bold" />
          </Row>
        </Row>
      </PressableScale>

      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: space.sm, marginTop: space.md }}>
          {cards.map((c, i) => (
            <Animated.View key={`${c.title}-${i}`} entering={FadeInDown.duration(200).delay(i * 50)}>
              <InsightRow card={c} onAction={onAction} t={t} />
            </Animated.View>
          ))}
          <PressableScale onPress={onRefresh} compact style={{ alignSelf: 'center', paddingTop: 2 }}>
            <Row gap={4}>
              <Icon name={working ? 'clock' : 'ai'} size={12} color={ON_DIM} />
              <Text variant="caption" color={ON_DIM}>
                {working ? t('Updating…') : t('Refresh')}
              </Text>
            </Row>
          </PressableScale>
        </Animated.View>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={gradients.dawn}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.xl, padding: space.lg, ...shadow.e1 }}
    >
      {children}
    </LinearGradient>
  );
}

function Header({
  t,
  working,
  generatedAt,
}: {
  t: TFunc;
  working?: boolean;
  generatedAt?: string;
}) {
  return (
    <Row between>
      <Row gap={space.sm}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(255,255,255,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="ai" size={13} color="#fff" weight="fill" />
        </View>
        <Text variant="overline" color={ON}>
          {working ? t('Thinking…') : t("Today's brief")}
        </Text>
      </Row>
      {generatedAt ? (
        <Text variant="caption" color={ON_DIM}>
          {timeAgo(generatedAt)}
        </Text>
      ) : null}
    </Row>
  );
}

function InsightRow({
  card,
  onAction,
  t,
}: {
  card: InsightCard;
  onAction: (c: InsightCard) => void;
  t: TFunc;
}) {
  const [showBasis, setShowBasis] = useState(false);
  const u = URGENCY[card.urgency];

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: radius.lg,
        padding: space.md,
        gap: space.xs,
        borderLeftWidth: 3,
        borderLeftColor: u.fg,
      }}
    >
      <Row gap={space.sm}>
        <Icon name={CATEGORY_ICON[card.category]} size={16} color={u.fg} weight="fill" />
        <Text variant="bodyStrong" style={{ flex: 1 }} raw>
          {card.title}
        </Text>
        <View style={{ backgroundColor: u.bg, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill }}>
          <Text variant="caption" color={u.fg}>
            {t(u.label)}
          </Text>
        </View>
      </Row>

      <Text variant="body" muted raw>
        {card.body}
      </Text>

      {card.fieldName ? (
        <Row gap={4}>
          <Icon name="fields" size={12} color={palette.textFaint} />
          <Text variant="caption" color={palette.textFaint} raw>
            {card.fieldName}
          </Text>
        </Row>
      ) : null}

      <Row between style={{ marginTop: 2 }}>
        {card.basis ? (
          <PressableScale onPress={() => setShowBasis((v) => !v)} compact>
            <Row gap={4}>
              <Text variant="caption" color={palette.textFaint}>
                {t('Why this?')}
              </Text>
              <Icon name={showBasis ? 'up' : 'right'} size={10} color={palette.textFaint} />
            </Row>
          </PressableScale>
        ) : (
          <View />
        )}
        {card.action !== 'none' ? (
          <PressableScale onPress={() => onAction(card)} compact>
            <Row gap={4}>
              <Text variant="label" color={palette.primary} raw>
                {card.actionLabel ?? t('Open')}
              </Text>
              <Icon name="right" size={11} color={palette.primary} />
            </Row>
          </PressableScale>
        ) : null}
      </Row>

      {showBasis && card.basis ? (
        <Animated.View
          entering={FadeIn.duration(140)}
          style={{ backgroundColor: palette.surfaceSunken, borderRadius: radius.sm, padding: space.sm }}
        >
          <Text variant="caption" color={palette.textMuted} raw>
            {card.basis}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return 'today';
}
