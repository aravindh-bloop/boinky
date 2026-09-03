import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInRight, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../api/client';
import { useT } from '../i18n';
import type { TutorialStep } from '../api/types';
import { useVoice } from './voice';
import { Button, Icon, type IconName, Text, palette, radius, space } from '../ui';

interface Props {
  topic: 'app' | 'pod';
  visible: boolean;
  onDone: () => void;
}

const FALLBACK_ICON: IconName = 'insight';

/**
 * First-run (and replayable) walkthrough. Server-driven content
 * (`GET /api/tutorial`) so it is already in the farmer's language; a voice
 * assistant reads each step aloud (`useVoice` → `/api/tts`). Auto-plays the
 * voice on every step; the farmer sets the pace with Next.
 */
export function TutorialOverlay({ topic, visible, onDone }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const voice = useVoice();

  const [steps, setSteps] = useState<TutorialStep[] | null>(null);
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);
  const autoplayed = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setSteps(null);
    setFailed(false);
    setI(0);
    autoplayed.current = new Set();
    api
      .request<{ steps: TutorialStep[] }>('/api/tutorial', { query: { topic } })
      .then((r) => setSteps(r.steps))
      .catch(() => setFailed(true));
  }, [visible, topic]);

  const step = steps?.[i];

  // Auto-play the voice once per step.
  useEffect(() => {
    if (!visible || !step) return;
    if (autoplayed.current.has(i)) return;
    autoplayed.current.add(i);
    void voice.speak(`${step.title}. ${step.body}`);
  }, [visible, step, i, voice]);

  function finish() {
    voice.stop();
    onDone();
  }

  function next() {
    voice.stop();
    if (steps && i < steps.length - 1) setI(i + 1);
    else finish();
  }

  function back() {
    voice.stop();
    if (i > 0) {
      autoplayed.current.delete(i - 1);
      setI(i - 1);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={finish}>
      <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        <LinearGradient
          colors={[palette.primaryDeep, palette.primary]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
        />

        <View style={{ flex: 1, paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.lg }}>
          {/* header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="overline" color="rgba(255,255,255,0.85)">
              {topic === 'pod' ? t('Sensor setup') : t('Getting started')}
            </Text>
            <Pressable onPress={finish} hitSlop={12}>
              <Text variant="label" color="rgba(255,255,255,0.9)">{t('Skip')}</Text>
            </Pressable>
          </View>

          {/* progress dots */}
          {steps && (
            <View style={{ flexDirection: 'row', gap: 5, marginTop: space.md }}>
              {steps.map((_, n) => (
                <View
                  key={n}
                  style={{
                    height: 4,
                    flex: 1,
                    borderRadius: 2,
                    backgroundColor: n <= i ? '#fff' : 'rgba(255,255,255,0.28)',
                  }}
                />
              ))}
            </View>
          )}

          {/* body */}
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {failed ? (
              <View style={{ alignItems: 'center', gap: space.md }}>
                <Text variant="body" muted center>
                  {t('Could not load the walkthrough. You can explore the app on your own — every screen has a short hint.')}
                </Text>
                <Button title={t('Got it')} variant="soft" onPress={finish} />
              </View>
            ) : !step ? (
              <ActivityIndicator color={palette.primary} size="large" />
            ) : (
              <Animated.View
                key={step.id}
                entering={FadeInRight.duration(260)}
                exiting={FadeOut.duration(120)}
                style={{
                  backgroundColor: palette.surface,
                  borderRadius: radius.xxl,
                  padding: space.xl,
                  gap: space.md,
                  borderWidth: 1,
                  borderColor: palette.hairline,
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: radius.pill,
                    backgroundColor: palette.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={(step.icon as IconName) || FALLBACK_ICON} size={30} color={palette.primaryDeep} weight="duotone" />
                </View>

                <Text variant="title">{step.title}</Text>
                <Text variant="body" style={{ lineHeight: 24 }}>
                  {step.body}
                </Text>

                <Pressable
                  onPress={() => (voice.playing ? voice.stop() : voice.speak(`${step.title}. ${step.body}`))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    alignSelf: 'flex-start',
                    paddingVertical: space.xs,
                    paddingHorizontal: space.md,
                    borderRadius: radius.pill,
                    backgroundColor: palette.surfaceSunken,
                  }}
                >
                  {voice.loading ? (
                    <ActivityIndicator size="small" color={palette.primaryDeep} />
                  ) : (
                    <Icon name={voice.playing ? 'stop' : 'mic'} size={15} color={palette.primaryDeep} weight="fill" />
                  )}
                  <Text variant="label" color={palette.primaryDeep}>
                    {voice.loading ? t('Loading voice…') : voice.playing ? t('Stop') : t('Listen')}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* nav */}
          {step && (
            <Animated.View entering={FadeIn} style={{ flexDirection: 'row', gap: space.sm }}>
              {i > 0 && (
                <Pressable onPress={back} style={{ paddingVertical: space.md, paddingHorizontal: space.lg }}>
                  <Text variant="label" color={palette.textMuted}>{t('Back')}</Text>
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              <View style={{ flex: 1.3 }}>
                <Button
                  title={steps && i === steps.length - 1 ? t('Start using AgriPod') : t('Next')}
                  onPress={next}
                />
              </View>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}
