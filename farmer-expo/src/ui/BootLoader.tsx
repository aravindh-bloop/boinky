import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from './Icon';
import { Text } from './Text';
import { radius, space } from './tokens';
import { useBreathe, useKenBurnsSettle } from './kenBurns';

const BG = require('../../assets/auth-bg.webp');

/**
 * The launch screen — the same living field photo as the login screen behind
 * it, so the app opens into one continuous scene instead of cutting from a
 * generic loader into a different picture. The photo settles from a slight
 * zoom, the leaf badge breathes, then the login/signup card takes over on top
 * of this same backdrop once fonts + cache are ready.
 */
export function BootLoader() {
  const settle = useKenBurnsSettle();
  const glow = useBreathe();

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1A11' }}>
      <Animated.View style={[StyleSheet.absoluteFill, settle]}>
        <Image source={BG} style={{ flex: 1 }} contentFit="cover" />
      </Animated.View>

      <LinearGradient
        colors={['rgba(8,20,13,0.4)', 'rgba(8,20,13,0.05)', 'rgba(8,20,13,0.05)', 'rgba(6,16,11,0.4)']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View
        entering={FadeIn.duration(600)}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: 84,
            height: 84,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space.md,
          }}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: 'rgba(130,200,120,0.4)',
              },
              glow,
            ]}
          />
          <View
            style={{
              width: 66,
              height: 66,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.32)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="leaf" size={30} color="#fff" weight="fill" />
          </View>
        </View>
        <Text
          variant="hero"
          color="#fff"
          raw
          style={{
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowRadius: 16,
            textShadowOffset: { width: 0, height: 3 },
            letterSpacing: 0.5,
          }}
        >
          AgriPod
        </Text>
        <Text variant="label" color="rgba(255,255,255,0.8)" style={{ marginTop: 4, letterSpacing: 1 }}>
          growing, together
        </Text>
      </Animated.View>
    </View>
  );
}
