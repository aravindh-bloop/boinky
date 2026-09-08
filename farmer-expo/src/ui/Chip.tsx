import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { palette, radius, space } from './tokens';
import { Text } from './Text';
import { PressableScale } from './Pressable';

interface ChipProps {
  label: string;
  color?: string;
  bg?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export function Chip({ label, color = palette.primaryDeep, bg = palette.primarySoft, icon, size = 'md' }: ChipProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: size === 'sm' ? space.sm : space.md,
        paddingVertical: size === 'sm' ? 3 : 5,
      }}
    >
      {icon}
      <Text variant={size === 'sm' ? 'caption' : 'label'} color={color}>
        {label}
      </Text>
    </View>
  );
}

interface SelectableProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
  /** Colour for the selected state — defaults to the primary green. */
  accent?: string;
  /** Soft background for the selected state — pair with `accent`. */
  accentSoft?: string;
  icon?: React.ReactNode;
}

export function SelectChip({
  label,
  selected,
  onPress,
  style,
  accent = palette.primary,
  accentSoft = palette.primarySoft,
  icon,
}: SelectableProps) {
  return (
    <PressableScale onPress={onPress} feedback="select" compact style={style}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          borderRadius: radius.pill,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm + 1,
          borderWidth: 1,
          borderColor: selected ? accent : palette.border,
          backgroundColor: selected ? accentSoft : palette.surface,
        }}
      >
        {icon}
        <Text variant="label" color={selected ? accent : palette.textMuted}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
