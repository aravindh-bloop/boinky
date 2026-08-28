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
}

export function SelectChip({ label, selected, onPress, style }: SelectableProps) {
  return (
    <PressableScale onPress={onPress} feedback="select" compact style={style}>
      <View
        style={{
          borderRadius: radius.pill,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          borderWidth: 1.5,
          borderColor: selected ? palette.primary : palette.border,
          backgroundColor: selected ? palette.primarySoft : palette.surface,
        }}
      >
        <Text
          variant="bodyStrong"
          color={selected ? palette.primaryDeep : palette.textMuted}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
