import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Field,
  OrganicBackground,
  Row,
  SegmentedControl,
  SelectChip,
  Text,
  palette,
  space,
} from '../ui';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

const LANGS = [
  ['en', 'English'],
  ['hi', 'हिंदी'],
  ['mr', 'मराठी'],
  ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'],
  ['kn', 'ಕನ್ನಡ'],
];

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const insets = useSafeAreaInsets();
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
      Alert.alert('Could not continue', e instanceof ApiError ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="green" height={340} />
      <ScrollWrap topInset={insets.top}>
        <Animated.View
          entering={FadeIn.duration(500)}
          style={{ alignItems: 'center', marginBottom: space.xl }}
        >
          <Text style={{ fontSize: 44 }}>🌱</Text>
          <Text variant="hero" color={palette.primaryDeep}>
            AgriPod
          </Text>
          <Text variant="body" muted>
            Healthy crops, in your pocket
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(160)}>
          <Card elevation="raised" style={{ gap: space.lg }}>
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
                <Animated.View
                  key="signup"
                  entering={FadeIn.duration(220)}
                  style={{ gap: space.md }}
                >
                  <Field label="Your name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Patil" />
                  <Field
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="10-digit mobile"
                  />
                  <Field label="District / taluka" value={region} onChangeText={setRegion} placeholder="e.g. Pune" />
                  <View style={{ gap: space.xs }}>
                    <Text variant="label" muted>
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
          </Card>
        </Animated.View>
      </ScrollWrap>
    </View>
  );
}

function ScrollWrap({ children, topInset }: { children: React.ReactNode; topInset: number }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: topInset + space.giant,
          paddingHorizontal: space.lg,
          paddingBottom: space.giant,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
