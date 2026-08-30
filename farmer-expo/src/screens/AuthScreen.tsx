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
  AuthBackdrop,
  Button,
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

/** ~3.5s fade + settle on the map, then a barely-there endless breathe. */
function useReveal() {
  const p = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 3500, easing: Easing.out(Easing.cubic) });
    b.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [p, b]);
  return useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.92 + p.value * 0.08 + b.value * 0.015 }],
  }));
}

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reveal = useReveal();

  const mapH = Math.min(height * 0.28, 240);
  const headerH = 150;
  const glowCenterY = insets.top + headerH + mapH / 2;

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
    <View style={{ flex: 1, backgroundColor: '#0B1A11' }}>
      <AuthBackdrop glowCenterY={glowCenterY} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + space.xxl,
            paddingHorizontal: space.lg,
            paddingBottom: insets.bottom + space.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── header ── */}
          <Animated.View entering={FadeIn.duration(700)} style={{ alignItems: 'center', height: headerH, justifyContent: 'center' }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: radius.pill,
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.22)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: space.sm,
              }}
            >
              <Text style={{ fontSize: 30 }} raw>
                🌱
              </Text>
            </View>
            <Text
              variant="hero"
              color="#fff"
              raw
              style={{ textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } }}
            >
              AgriPod
            </Text>
            <Text variant="label" color="rgba(255,255,255,0.72)">
              Healthy crops, in your pocket
            </Text>
          </Animated.View>

          {/* ── the map, framed so nothing overlaps it ── */}
          <Animated.View style={[{ height: mapH, marginTop: space.xs, marginBottom: space.xl }, reveal]}>
            <Image source={BG} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </Animated.View>

          {/* ── liquid-glass form ── */}
          <Animated.View entering={FadeInDown.delay(220).springify().damping(18).stiffness(150)}>
            <View
              style={{
                borderRadius: radius.xxl,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.4)',
                shadowColor: '#000',
                shadowOpacity: 0.28,
                shadowRadius: 28,
                shadowOffset: { width: 0, height: 16 },
                elevation: 14,
              }}
            >
              <BlurView
                intensity={30}
                tint="light"
                experimentalBlurMethod="dimezisBlurView"
                style={{ padding: space.lg, gap: space.lg, backgroundColor: 'rgba(255,255,255,0.16)' }}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
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

          <View style={{ flex: 1 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
