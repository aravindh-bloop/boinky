import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { PressableScale } from './Pressable';
import { radius, space, tone as TONE, type ToneKey } from './tokens';

export interface HeaderStat {
  label: string;
  value: string | number;
  icon?: IconName;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Feature-area colour. Defaults to the green crop tone. */
  tone?: ToneKey;
  onBack?: () => void;
  onClose?: () => void;
  /** A node shown at the top-right (a pill, an action). */
  right?: React.ReactNode;
  /** Translucent stat pills under the title. */
  stats?: HeaderStat[];
  /** Extra content rendered inside the gradient, below the title. */
  children?: React.ReactNode;
  style?: ViewStyle;
}

const ON = '#FFFFFF';
const ON_DIM = 'rgba(255,255,255,0.82)';
const ON_FAINT = 'rgba(255,255,255,0.62)';

/**
 * The standard screen opener: a rounded gradient band in the feature area's
 * colour, carrying the title, an optional line of context, and optional
 * translucent stat pills. Replaces bare `<Text variant="hero">` headers so
 * every screen starts with colour, not black-on-canvas.
 */
export function ScreenHeader({
  title,
  subtitle,
  tone = 'crop',
  onBack,
  onClose,
  right,
  stats,
  children,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const hasStats = !!stats?.length;

  return (
    <LinearGradient
      colors={TONE[tone].grad}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={[
        {
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: hasStats || children ? space.xl : space.lg + 2,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        },
        style,
      ]}
    >
      {(onBack || onClose || right) && (
        <Row between style={{ marginBottom: space.sm, minHeight: 28 }}>
          {onBack ? (
            <PressableScale onPress={onBack} compact hitSlop={8}>
              <Icon name="left" size={24} color={ON} />
            </PressableScale>
          ) : (
            <View style={{ width: 24 }} />
          )}
          {right ?? (onClose ? (
            <PressableScale onPress={onClose} compact hitSlop={8}>
              <Icon name="close" size={22} color={ON} />
            </PressableScale>
          ) : (
            <View style={{ width: 24 }} />
          ))}
        </Row>
      )}

      <Animated.View entering={FadeInDown.duration(260)}>
        <Text variant="hero" raw color={ON}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" raw color={ON_DIM} style={{ marginTop: 3 }}>
            {subtitle}
          </Text>
        ) : null}
      </Animated.View>

      {hasStats && (
        <Row gap={space.sm} style={{ marginTop: space.lg }}>
          {stats!.map((s) => (
            <View key={s.label} style={pill}>
              {s.icon ? <Icon name={s.icon} size={13} color={ON_DIM} weight="fill" /> : null}
              <Text variant="title" raw color={ON} style={{ fontSize: 19, lineHeight: 23, marginTop: 2 }}>
                {String(s.value)}
              </Text>
              <Text variant="overline" raw color={ON_FAINT} style={{ marginTop: 1 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </Row>
      )}

      {children ? <View style={{ marginTop: space.lg }}>{children}</View> : null}
    </LinearGradient>
  );
}

const pill: ViewStyle = {
  flex: 1,
  backgroundColor: 'rgba(255,255,255,0.14)',
  borderRadius: radius.md,
  paddingVertical: space.sm + 1,
  paddingHorizontal: space.sm,
  alignItems: 'flex-start',
};

// local Row to avoid a circular import through ./misc
function Row({
  children,
  gap = space.sm,
  between,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  between?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap, justifyContent: between ? 'space-between' : 'flex-start' },
        style,
      ]}
    >
      {children}
    </View>
  );
}
