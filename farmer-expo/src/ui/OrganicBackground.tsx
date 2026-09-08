import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from './tokens';

interface Props {
  tint?: 'green' | 'harvest' | 'calm' | 'sunrise';
  height?: number;
  style?: ViewStyle;
}

/**
 * A whisper of colour behind a screen header — a soft green tint at the very top
 * that dissolves into the canvas within the first inch. Deliberately minimal:
 * the app is clean white/canvas, not a wall of gradient.
 */
function OrganicBackgroundBase({ height = 200, style }: Props) {
  return (
    <View style={[StyleSheet.absoluteFill, { height }, style]} pointerEvents="none">
      <LinearGradient
        colors={[palette.primarySoft, palette.canvas]}
        locations={[0, 0.85]}
        style={{ flex: 1, opacity: 0.55 }}
      />
    </View>
  );
}

export const OrganicBackground = React.memo(OrganicBackgroundBase);
