import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { palette, radius, space } from './tokens';
import { Text } from './Text';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

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
      entering={ZoomIn.springify().damping(14).stiffness(150)}
      style={{ alignItems: 'center', padding: space.xxl, gap: space.sm }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.pill,
          backgroundColor: palette.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={32} color={palette.primary} weight="duotone" />
      </View>
      <Text variant="heading" center>
        {title}
      </Text>
      {body ? (
        <Text variant="body" muted center>
          {body}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: space.sm }}>
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
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.surface,
        borderRadius: radius.lg,
        padding: space.md,
        gap: 2,
        borderWidth: 1,
        borderColor: palette.hairline,
      }}
    >
      <Text variant="title" color={accent} style={{ fontSize: 22 }}>
        {value}
      </Text>
      <Text variant="caption" faint>
        {label}
      </Text>
    </View>
  );
}
