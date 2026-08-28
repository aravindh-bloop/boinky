import React from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { palette, space } from './tokens';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  padded?: boolean;
  edges?: Edge[];
  bg?: string;
  contentStyle?: ViewStyle;
  footer?: React.ReactNode;
  scrollProps?: ScrollViewProps;
}

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing,
  padded = true,
  edges = ['top'],
  bg = palette.canvas,
  contentStyle,
  footer,
  scrollProps,
}: Props) {
  const pad = padded ? { padding: space.lg, gap: space.md } : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ paddingBottom: space.giant }, pad, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={palette.primary}
                colors={[palette.primary]}
              />
            ) : undefined
          }
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingTop: space.sm,
            paddingBottom: space.md,
            backgroundColor: bg,
            borderTopWidth: 1,
            borderTopColor: palette.hairline,
          }}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
