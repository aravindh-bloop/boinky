import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { gradients, palette, radius, shadow, space } from './tokens';
import { spring } from './motion';
import { Text } from './Text';
import { useT } from '../i18n';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './Pressable';
import { haptic } from './haptics';

const TAB_ICON: Record<string, IconName> = {
  Home: 'home',
  Fields: 'fields',
  Scan: 'scan',
  Schemes: 'schemes',
  Stock: 'stock',
};

function TabButton({
  name,
  focused,
  onPress,
}: {
  name: string;
  focused: boolean;
  onPress: () => void;
}) {
  const t = useT();
  const f = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    f.value = withSpring(focused ? 1 : 0, spring.gentle);
  }, [focused, f]);

  const pill = useAnimatedStyle(() => ({
    transform: [{ translateY: -f.value * 3 }],
    backgroundColor: interpolateColor(f.value, [0, 1], ['rgba(0,0,0,0)', palette.primarySoft]),
  }));

  return (
    <PressableScale
      feedback={false}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', gap: 3 }}
    >
      <Animated.View
        style={[
          { paddingHorizontal: 16, paddingVertical: 5, borderRadius: radius.pill },
          pill,
        ]}
      >
        <Icon
          name={TAB_ICON[name] ?? 'circle'}
          size={23}
          weight={focused ? 'fill' : 'regular'}
          color={focused ? palette.primaryDeep : palette.textFaint}
        />
      </Animated.View>
      <Text
        variant="caption"
        color={focused ? palette.primaryDeep : palette.textFaint}
        style={{ fontFamily: focused ? 'NunitoSans_700Bold' : 'NunitoSans_600SemiBold', fontSize: 11 }}
      >
        {t(name)}
      </Text>
    </PressableScale>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const scanRoute = state.routes.find((r) => r.name === 'Scan');
  const others = state.routes.filter((r) => r.name !== 'Scan');

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        paddingBottom: Math.max(insets.bottom, space.sm),
        paddingTop: space.sm,
        // shadow points up, toward the content it sits under
        shadowColor: '#3D2E1E',
        shadowOpacity: 0.07,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -6 },
        elevation: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {others.slice(0, 2).map((route) => {
          const i = state.routes.indexOf(route);
          return (
            <TabButton
              key={route.key}
              name={route.name}
              focused={state.index === i}
              onPress={() => nav(route)}
            />
          );
        })}

        {/* centre scan FAB */}
        <View style={{ width: 76, alignItems: 'center' }}>
          <PressableScale
            feedback="press"
            onPress={() => scanRoute && nav(scanRoute)}
            style={[
              {
                width: 60,
                height: 60,
                borderRadius: radius.pill,
                marginTop: -26,
                borderWidth: 4,
                borderColor: palette.surface,
              },
              shadow.e2,
            ]}
          >
            <LinearGradient
              colors={gradients.canopy}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="scan" size={26} color="#fff" weight="fill" />
            </LinearGradient>
          </PressableScale>
          <Text variant="caption" color={palette.textFaint} style={{ fontSize: 11, marginTop: 2 }}>
            {t('Scan')}
          </Text>
        </View>

        {others.slice(2).map((route) => {
          const i = state.routes.indexOf(route);
          return (
            <TabButton
              key={route.key}
              name={route.name}
              focused={state.index === i}
              onPress={() => nav(route)}
            />
          );
        })}
      </View>
    </View>
  );

  function nav(route: (typeof state.routes)[number]) {
    haptic.select();
    const focused = state.routes[state.index]?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  }
}
