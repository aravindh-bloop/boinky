import React, { useState } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { DailyBrief, InsightCard, InsightUrgency } from '../api/types';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { PressableScale } from './Pressable';
import { Skeleton } from './Skeleton';
import { Row } from './misc';
import { palette, radius, shadow, space } from './tokens';

interface Props {
  brief: DailyBrief | null;
  loading: boolean;
  /** The model is running — show the working state. */
  working: boolean;
  onRefresh: () => void;
  onAction: (card: InsightCard) => void;
}

/** Colour + label per urgency. Keeps the palette honest instead of ad-hoc greens. */
const URGENCY: Record<InsightUrgency, { fg: string; bg: string; label: string }> = {
  critical: { fg: palette.danger, bg: palette.dangerSoft, label: 'Urgent' },
  action: { fg: palette.clay, bg: palette.claySoft, label: 'Do this' },
  watch: { fg: palette.warn, bg: palette.warnSoft, label: 'Watch' },
  info: { fg: palette.info, bg: palette.surfaceSunken, label: 'Note' },
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
 * The AI daily brief block on Home.
 *
 * Purely presentational — the screen owns fetching and navigation. Renders
 * nothing at all when there is no real brief to show, because an empty farm
 * must produce an empty state rather than generated filler.
 */
export function AiBrief({ brief, loading, working, onRefresh, onAction }: Props) {
  if (loading) return <BriefShell working><Skeletons /></BriefShell>;

  // Nothing to say, and nothing worth apologising for — stay off the screen.
  if (!brief || brief.status === 'unavailable') return null;

  if (brief.status === 'generating') {
    return (
      <BriefShell working>
        <Text variant="body" color="rgba(255,255,255,0.9)">
          Reading your fields, weather and tasks…
        </Text>
        <Skeletons />
      </BriefShell>
    );
  }

  const cards = brief.cards ?? [];
  if (cards.length === 0) return null;

  return (
    <BriefShell working={working} onRefresh={onRefresh} generatedAt={brief.generatedAt}>
      {brief.headline ? (
        <Animated.View entering={FadeIn.duration(260)}>
          <Text variant="title" color="#fff" style={{ marginBottom: space.xs }}>
            {brief.headline}
          </Text>
        </Animated.View>
      ) : null}

      <View style={{ gap: space.sm }}>
        {cards.map((c, i) => (
          <Animated.View key={`${c.title}-${i}`} entering={FadeInDown.duration(220).delay(i * 60)}>
            <InsightRow card={c} onAction={onAction} />
          </Animated.View>
        ))}
      </View>
    </BriefShell>
  );
}

/** The tinted container + "AgriPod AI" header. */
function BriefShell({
  children,
  working,
  onRefresh,
  generatedAt,
}: {
  children: React.ReactNode;
  working?: boolean;
  onRefresh?: () => void;
  generatedAt?: string;
}) {
  return (
    <LinearGradient
      colors={['#2C5C30', '#3B7A3F']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: radius.xl,
        padding: space.lg,
        gap: space.md,
        ...shadow.e2,
      }}
    >
      <Row between>
        <Row gap={space.sm}>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="ai" size={17} color="#fff" weight="fill" />
          </View>
          <View>
            <Text variant="label" color="#fff">
              TODAY'S BRIEF
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.7)">
              {working ? 'Thinking…' : generatedAt ? `Updated ${timeAgo(generatedAt)}` : 'From your farm data'}
            </Text>
          </View>
        </Row>

        {onRefresh ? (
          <PressableScale
            onPress={onRefresh}
            compact
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={working ? 'clock' : 'ai'} size={16} color="#fff" />
            </View>
          </PressableScale>
        ) : null}
      </Row>

      {children}
    </LinearGradient>
  );
}

/** One insight, with its evidence tucked behind "Why this?". */
function InsightRow({ card, onAction }: { card: InsightCard; onAction: (c: InsightCard) => void }) {
  const [showBasis, setShowBasis] = useState(false);
  const u = URGENCY[card.urgency];

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: radius.lg,
        padding: space.md,
        gap: space.xs,
        borderLeftWidth: 4,
        borderLeftColor: u.fg,
      }}
    >
      <Row gap={space.sm}>
        <Icon name={CATEGORY_ICON[card.category]} size={18} color={u.fg} weight="fill" />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {card.title}
        </Text>
        <View
          style={{
            backgroundColor: u.bg,
            paddingHorizontal: space.sm,
            paddingVertical: 2,
            borderRadius: radius.pill,
          }}
        >
          <Text variant="caption" color={u.fg}>
            {u.label}
          </Text>
        </View>
      </Row>

      <Text variant="body" muted>
        {card.body}
      </Text>

      {card.fieldName ? (
        <Row gap={space.xs}>
          <Icon name="fields" size={13} color={palette.textFaint} />
          <Text variant="caption" color={palette.textFaint}>
            {card.fieldName}
          </Text>
        </Row>
      ) : null}

      <Row between style={{ marginTop: space.xs }}>
        {card.basis ? (
          <PressableScale onPress={() => setShowBasis((v) => !v)} compact>
            <Row gap={space.xs}>
              <Text variant="caption" color={palette.textFaint}>
                Why this?
              </Text>
              <Icon name={showBasis ? 'up' : 'right'} size={11} color={palette.textFaint} />
            </Row>
          </PressableScale>
        ) : (
          <View />
        )}

        {card.action !== 'none' ? (
          <PressableScale
            onPress={() => onAction(card)}
            compact
          >
            <Row gap={space.xs}>
              <Text variant="label" color={palette.primary}>
                {card.actionLabel ?? 'Open'}
              </Text>
              <Icon name="right" size={12} color={palette.primary} />
            </Row>
          </PressableScale>
        ) : null}
      </Row>

      {showBasis && card.basis ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          style={{
            backgroundColor: palette.surfaceSunken,
            borderRadius: radius.sm,
            padding: space.sm,
          }}
        >
          <Text variant="caption" color={palette.textMuted}>
            {card.basis}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Skeletons() {
  return (
    <View style={{ gap: space.sm }}>
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{ backgroundColor: palette.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm }}
        >
          <Skeleton width="70%" height={16} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="85%" height={12} />
        </View>
      ))}
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
