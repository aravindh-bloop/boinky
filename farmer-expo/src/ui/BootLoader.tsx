import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { palette } from './tokens';

/**
 * The launch screen, deliberately built from RN primitives only.
 *
 * The Skia `Loader` used to fill this role, which meant spinning up a Skia
 * surface before the app had painted anything. This renders immediately and
 * keeps Skia off the startup path — the real screens still use `Loader`.
 */
export function BootLoader() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.canvas,
      }}
    >
      <ActivityIndicator size="large" color={palette.primary} />
    </View>
  );
}
