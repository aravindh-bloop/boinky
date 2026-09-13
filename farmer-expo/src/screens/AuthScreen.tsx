import { alertT } from '../i18n/alert';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
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
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Field,
  Icon,
  Row,
  SegmentedControl,
  SelectChip,
  Text,
  palette,
  radius,
  space,
  useBreathe,
  useKenBurnsLoop,
} from '../ui';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

// Same photo the boot loader hands off from — one continuous scene.
const BG = require('../../assets/auth-bg.webp');

const LANGS = [
  ['en', 'English'],
  ['hi', 'हिंदी'],
  ['mr', 'मराठी'],
  ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'],
  ['kn', 'ಕನ್ನಡ'],
];

/** A thin gradient line that draws itself in across the top of the card on mount. */
function TopSweep() {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(500, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: s.value }], opacity: s.value }));
  return (
    <Animated.View style={[{ height: 3, transformOrigin: 'left' } as const, style]}>
      <LinearGradient
        colors={[palette.leaf, palette.primary, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const insets = useSafeAreaInsets();
  const kenBurns = useKenBurnsLoop();
  const glow = useBreathe();

  // The photo + wordmark animate alone for a beat before the card appears —
  // a proper intro on first launch, not an instant cut to a form.
  const [showCard, setShowCard] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowCard(true), 3400);
    return () => clearTimeout(t);
  }, []);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  // Pre-filled with the demo account — judges just tap "Log in".
  const [identifier, setIdentifier] = useState('ramesh.kumar@agrian.app');
  const [password, setPassword] = useState('Agrian@2026');
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
      {/* ── living backdrop photo — same transform the boot loader ended on, no jump ── */}
      <Animated.View style={[StyleSheet.absoluteFill, kenBurns]}>
        <Image source={BG} style={{ flex: 1 }} contentFit="cover" />
      </Animated.View>

      {/* a light touch of scrim — just enough for the wordmark and card to read, the photo stays bright */}
      <LinearGradient
        colors={['rgba(8,20,13,0.32)', 'rgba(8,20,13,0.06)', 'rgba(8,20,13,0)']}
        locations={[0, 0.6, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '26%' }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(6,14,10,0)', 'rgba(6,14,10,0.22)', 'rgba(5,12,9,0.45)']}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%' }}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'space-between',
            paddingTop: insets.top + space.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── header — no entrance fade, it's already on screen from the boot loader ── */}
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm }}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: 'rgba(130,200,120,0.4)',
                  },
                  glow,
                ]}
              />
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.32)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="leaf" size={28} color="#fff" weight="fill" />
              </View>
            </View>
            <Text
              variant="hero"
              color="#fff"
              raw
              style={{ textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 16, textShadowOffset: { width: 0, height: 3 } }}
            >
              Agrian
            </Text>
            <Text variant="label" color="rgba(255,255,255,0.8)" style={{ marginTop: 2 }}>
              Healthy crops, in your pocket
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: space.xxl }} />

          {/* ── liquid-glass form — held back until the intro has played ── */}
          {showCard && (
          <Animated.View
            entering={FadeInDown.springify().damping(16).stiffness(140)}
            style={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
          >
            <View
              style={{
                borderRadius: radius.xxl,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.38)',
                shadowColor: '#000',
                shadowOpacity: 0.35,
                shadowRadius: 32,
                shadowOffset: { width: 0, height: 18 },
                elevation: 16,
              }}
            >
              <TopSweep />
              <BlurView
                intensity={46}
                tint="light"
                style={{ padding: space.lg, gap: space.lg, backgroundColor: 'rgba(255,255,255,0.3)' }}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
