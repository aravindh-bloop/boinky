import { alertT } from '../i18n/alert';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Field,
  Row,
  SegmentedControl,
  SelectChip,
  Text,
  palette,
  radius,
  space,
} from '../ui';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

const BG = require('../../assets/auth-bg.jpg');

const LANGS = [
  ['en', 'English'],
  ['hi', 'हिंदी'],
  ['mr', 'मराठी'],
  ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'],
  ['kn', 'ಕನ್ನಡ'],
];

/**
 * Slow cinematic reveal on the background map (~3.5s): it fades in while a
 * gentle scale settles, then a barely-there endless breathing loop. The whole
 * map stays visible (contentFit="contain"), so the motion is kept tiny.
 */
function useCinematicBg() {
  const p = useSharedValue(0); // 0 -> 1 reveal
  const k = useSharedValue(0); // breathing phase

  useEffect(() => {
    p.value = withTiming(1, { duration: 3500, easing: Easing.out(Easing.cubic) });
    k.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [p, k]);

  return useAnimatedStyle(() => ({
    opacity: 0.4 + p.value * 0.6,
    transform: [{ scale: 0.94 + p.value * 0.06 + k.value * 0.02 }],
  }));
}

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const bgStyle = useCinematicBg();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [lang, setLang] = useState('en');

  async function submit() {
    setBusy(true);
    try {
      if (mode === 'login') await login(identifier.trim(), password);
      else
        await signup({
          name: name.trim(),
          password,
          phone: phone.trim() || undefined,
          region: region.trim() || undefined,
          preferredLanguage: lang,
        });
    } catch (e) {
      alertT('Could not continue', e instanceof ApiError ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#12241A' }}>
      {/* animated background — the whole map, centred */}
      <Animated.View
        style={[
          { position: 'absolute', width, height, alignItems: 'center', justifyContent: 'center' },
          bgStyle,
        ]}
      >
        <Image source={BG} style={{ width: '100%', height: '100%' }} contentFit="contain" />
      </Animated.View>
      {/* very light edge scrim — only enough to keep the status bar + card readable */}
      <LinearGradient
        colors={['rgba(10,20,14,0.45)', 'rgba(10,20,14,0)', 'rgba(10,20,14,0)', 'rgba(10,20,14,0.4)']}
        locations={[0, 0.22, 0.72, 1]}
        style={{ position: 'absolute', width, height }}
        pointerEvents="none"
      />

      <ScrollWrap topInset={insets.top} bottomInset={insets.bottom}>
        <Animated.View
          entering={FadeIn.duration(800)}
          style={{ alignItems: 'center', marginBottom: space.xl }}
        >
          <View
            style={{
              width: 66,
              height: 66,
              borderRadius: radius.pill,
              backgroundColor: 'rgba(255,255,255,0.14)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: space.sm,
            }}
          >
            <Text style={{ fontSize: 34 }} raw>
              🌱
            </Text>
          </View>
          <Text
            variant="hero"
            color="#fff"
            raw
            style={{ textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } }}
          >
            AgriPod
          </Text>
          <Text variant="body" color="rgba(255,255,255,0.85)">
            Healthy crops, in your pocket
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(150)}>
          <View
            style={{
              borderRadius: radius.xxl,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.4)',
              shadowColor: '#000',
              shadowOpacity: 0.22,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 16 },
              elevation: 12,
            }}
          >
            <BlurView
              intensity={28}
              tint="light"
              experimentalBlurMethod="dimezisBlurView"
              style={{ padding: space.lg, gap: space.lg, backgroundColor: 'rgba(255,255,255,0.16)' }}
            >
              {/* top sheen */}
              <LinearGradient
                colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }}
                pointerEvents="none"
              />

              <SegmentedControl
                value={mode}
                onChange={(v) => setMode(v as typeof mode)}
                options={[
                  { value: 'login', label: 'Log in' },
                  { value: 'signup', label: 'Sign up' },
                ]}
              />

              <View>
                {mode === 'signup' ? (
                  <Animated.View key="signup" entering={FadeIn.duration(220)} style={{ gap: space.md }}>
                    <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Patil" />
                    <Field
                      label="Phone"
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="10-digit mobile"
                    />
                    <Field label="District / taluka" value={region} onChangeText={setRegion} placeholder="e.g. Chennai" />
                    <View style={{ gap: space.xs }}>
                      <Text variant="label" color={palette.textMuted}>
                        Language
                      </Text>
                      <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                        {LANGS.map(([code, label]) => (
                          <SelectChip
                            key={code}
                            label={label}
                            selected={lang === code}
                            onPress={() => setLang(code)}
                          />
                        ))}
                      </Row>
                    </View>
                  </Animated.View>
                ) : (
                  <Animated.View key="login" entering={FadeIn.duration(220)}>
                    <Field
                      label="Phone or email"
                      value={identifier}
                      onChangeText={setIdentifier}
                      autoCapitalize="none"
                      placeholder="Registered phone or email"
                    />
                  </Animated.View>
                )}
              </View>

              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="At least 6 characters"
              />

              <Button
                title={mode === 'login' ? 'Log in' : 'Create account'}
                onPress={submit}
                loading={busy}
                size="lg"
              />
            </BlurView>
          </View>
        </Animated.View>
      </ScrollWrap>
    </View>
  );
}

function ScrollWrap({
  children,
  topInset,
  bottomInset,
}: {
  children: React.ReactNode;
  topInset: number;
  bottomInset: number;
}) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: topInset + space.huge,
          paddingHorizontal: space.lg,
          paddingBottom: bottomInset + space.huge,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
