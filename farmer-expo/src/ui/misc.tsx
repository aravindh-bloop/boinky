import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { palette, radius, space } from './tokens';
import { Text } from './Text';
import { Button } from './Button';
import { PressableScale } from './Pressable';
import { Icon, type IconName } from './Icon';

/** A consistent section title: small tracked overline + optional right-side action. */
export function SectionHeader({
  title,
  action,
  style,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        style,
      ]}
    >
      <Text variant="overline">{title}</Text>
      {action ? (
        <PressableScale onPress={action.onPress} compact>
          <Row gap={3}>
            <Text variant="label" color={palette.primary}>
              {action.label}
            </Text>
            <Icon name="right" size={13} color={palette.primary} weight="bold" />
          </Row>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'leaf',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(15).stiffness(140)}
      style={{ alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.huge, gap: space.md }}
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: radius.pill,
          backgroundColor: palette.primarySoft,
          borderWidth: 1,
          borderColor: palette.leafSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={30} color={palette.primary} weight="duotone" />
      </View>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <Text variant="heading" center>
          {title}
        </Text>
        {body ? (
          <Text variant="body" muted center style={{ maxWidth: 300 }}>
            {body}
          </Text>
        ) : null}
      </View>
      {action ? (
        <View style={{ marginTop: space.xs }}>
          <Button title={action.label} onPress={action.onPress} full={false} />
        </View>
      ) : null}
    </Animated.View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: space.xxl, gap: space.md, alignItems: 'center' }}>
      <Icon name="warningCircle" size={34} color={palette.danger} weight="duotone" />
      <Text variant="body" center color={palette.danger}>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" variant="soft" onPress={onRetry} full={false} /> : null}
    </View>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: palette.hairline }, style]} />;
}

export function Dot({ color = palette.leaf, size = 8 }: { color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Row({
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
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap,
          justifyContent: between ? 'space-between' : 'flex-start',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function KeyStat({
  label,
  value,
  accent = palette.primary,
  icon,
}: {
  label: string;
  value: string | number;
  accent?: string;
  icon?: IconName;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface,
        borderRadius: radius.lg,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        gap: space.xs,
        borderWidth: 1,
        borderColor: palette.hairline,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={accent} weight="fill" /> : null}
      <Text variant="hero" color={accent} raw style={{ fontSize: 26, lineHeight: 30 }}>
        {String(value)}
      </Text>
      <Text variant="overline" style={{ letterSpacing: 0.6 }}>
        {label}
      </Text>
    </View>
  );
}
