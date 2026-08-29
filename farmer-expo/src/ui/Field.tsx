import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { palette, radius, space, type, tamilFontFor } from './tokens';
import { timing } from './motion';
import { Text } from './Text';
import { useI18n } from '../i18n';

interface Props extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  right?: React.ReactNode;
}

export function Field({ label, hint, error, right, style, onFocus, onBlur, placeholder, ...rest }: Props) {
  const { lang, t } = useI18n();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const inputFont =
    lang === 'ta' ? (tamilFontFor[type.body.fontFamily as string] ?? type.body.fontFamily) : type.body.fontFamily;

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [error ? palette.danger : palette.border, error ? palette.danger : palette.primary],
    ),
  }));

  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Text variant="label" color={palette.textMuted}>
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderRadius: radius.md,
            backgroundColor: palette.surface,
            paddingHorizontal: space.md,
          },
          borderStyle,
        ]}
      >
        <TextInput
          placeholder={placeholder ? t(placeholder) : undefined}
          placeholderTextColor={palette.textFaint}
          style={[
            {
              flex: 1,
              paddingVertical: space.md,
              ...type.body,
              fontFamily: inputFont,
              color: palette.text,
            },
            style,
          ]}
          onFocus={(e) => {
            setFocused(true);
            focus.value = withTiming(1, timing.fast);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            focus.value = withTiming(0, timing.fast);
            onBlur?.(e);
          }}
          {...rest}
        />
        {right}
      </Animated.View>
      {error ? (
        <Text variant="caption" color={palette.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" faint>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
