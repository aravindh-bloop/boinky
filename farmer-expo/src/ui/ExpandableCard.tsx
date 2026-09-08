import React, { useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { PressableScale } from './Pressable';
import { palette, radius, shadow, space } from './tokens';

interface Props {
  title: string;
  /** One line shown under the title while collapsed. */
  subtitle?: string;
  icon?: IconName;
  /** Accent for the icon tile / left rail. */
  accent?: string;
  accentSoft?: string;
  /** A small node at the right of the collapsed header — a chip, a status dot. */
  trailing?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  style?: ViewStyle;
}

/**
 * A list row that shows only its title until tapped, then reveals the detail.
 * Keeps long feeds (schemes, alerts) short and scannable, and fills the row
 * with a splash of the accent colour.
 */
export function ExpandableCard({
  title,
  subtitle,
  icon,
  accent = palette.primary,
  accentSoft = palette.primarySoft,
  trailing,
  children,
  defaultOpen = false,
  style,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View
      style={[
        {
          backgroundColor: palette.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: open ? accentSoft : palette.hairline,
          overflow: 'hidden',
        },
        shadow.e0,
        style,
      ]}
    >
      <PressableScale onPress={() => setOpen((v) => !v)} feedback="tap">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
          {icon ? (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                backgroundColor: accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={17} color={accent} weight="fill" />
            </View>
          ) : (
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
          )}
          <View style={{ flex: 1 }}>
            <Text variant="subhead" raw numberOfLines={open ? undefined : 2}>
              {title}
            </Text>
            {subtitle && !open ? (
              <Text variant="caption" muted raw numberOfLines={1} style={{ marginTop: 1 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {trailing}
          <Icon name={open ? 'up' : 'right'} size={14} color={accent} weight="bold" />
        </View>
      </PressableScale>

      {open ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          style={{
            paddingHorizontal: space.md,
            paddingBottom: space.md,
            paddingTop: space.sm,
            gap: space.sm,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
          }}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
