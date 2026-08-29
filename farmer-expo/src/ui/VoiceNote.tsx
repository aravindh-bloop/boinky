import { alertT } from '../i18n/alert';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, TextInput, View } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { api, ApiError } from '../api/client';
import { Icon } from './Icon';
import { Text } from './Text';
import { PressableScale } from './Pressable';
import { Row } from './misc';
import { haptic } from './haptics';
import { palette, radius, space, type } from './tokens';

/**
 * Sarvam's REST transcription is documented for clips under 30s, and a farmer
 * describing one problem needs far less. We stop automatically at the cap.
 */
const MAX_SECONDS = 30;

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** Sarvam code detected from the recording, e.g. "ta-IN". */
  onLanguage?: (code: string | null) => void;
  language?: string | null;
}

/**
 * Lets the farmer describe the problem in their own words — typed, or spoken and
 * transcribed by Sarvam. The text is editable afterwards, so a mis-heard word can
 * be fixed before it goes to the diagnosis model.
 */
export function VoiceNote({ value, onChange, onLanguage, language }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const stopping = useRef(false);

  const seconds = Math.floor((state.durationMillis ?? 0) / 1000);
  const recording = state.isRecording;

  // Breathing halo while recording — the only cue that the mic is actually live.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (recording) {
      pulse.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [recording, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));

  async function start() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        alertT(
          'Microphone permission needed',
          'Allow microphone access to describe the problem in your own voice, or type it instead.',
        );
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic.press();
    } catch (e: any) {
      alertT('Could not start recording', e?.message ?? String(e));
    }
  }

  async function stop() {
    if (stopping.current) return;
    stopping.current = true;
    setBusy(true);
    try {
      await recorder.stop();
      // Release the audio session so playback elsewhere is not left muted.
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      const uri = recorder.uri;
      if (!uri) throw new Error('The recording was empty. Try again.');

      const res = await api.transcribe(uri);
      const text = (res.transcript ?? '').trim();
      if (!text) {
        haptic.warning();
        alertT('Nothing heard', 'The recording came back empty. Try again, closer to the mic.');
        return;
      }
      haptic.success();
      // Append rather than replace, so a second recording adds to the first.
      onChange(value.trim() ? `${value.trim()} ${text}` : text);
      onLanguage?.(res.language);
    } catch (e) {
      haptic.error();
      alertT('Could not transcribe', e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
      stopping.current = false;
    }
  }

  // Hard stop at the cap rather than letting a long clip fail server-side.
  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, seconds]);

  return (
    <View style={{ gap: space.sm }}>
      <View>
        <Text variant="subhead">Describe the problem</Text>
        <Text variant="caption" faint>
          Optional — speak in your own language, or type. It helps the diagnosis.
        </Text>
      </View>

      <View
        style={{
          borderWidth: 1.5,
          borderColor: recording ? palette.danger : palette.border,
          borderRadius: radius.md,
          backgroundColor: palette.surface,
          padding: space.md,
          gap: space.sm,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline
          editable={!recording && !busy}
          placeholder="e.g. the lower leaves have been wilting for four days"
          placeholderTextColor={palette.textFaint}
          style={{ minHeight: 66, ...type.body, color: palette.text, textAlignVertical: 'top' }}
        />

        <Row between>
          {busy ? (
            <Row gap={space.sm}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text variant="caption" muted>
                Transcribing…
              </Text>
            </Row>
          ) : recording ? (
            <Animated.View entering={FadeIn.duration(150)}>
              <Row gap={space.sm}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.danger }} />
                <Text variant="caption" color={palette.danger}>
                  Listening · {seconds}s / {MAX_SECONDS}s
                </Text>
              </Row>
            </Animated.View>
          ) : (
            <Row gap={space.xs}>
              <Text variant="caption" faint>
                {value.trim() ? `${value.trim().length} characters` : 'Tap the mic to speak'}
              </Text>
              {language ? (
                <View
                  style={{
                    backgroundColor: palette.primarySoft,
                    paddingHorizontal: space.sm,
                    paddingVertical: 1,
                    borderRadius: radius.pill,
                  }}
                >
                  <Text variant="caption" color={palette.primaryDeep}>
                    {language}
                  </Text>
                </View>
              ) : null}
            </Row>
          )}

          <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
            {recording ? (
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 52,
                    height: 52,
                    borderRadius: radius.pill,
                    backgroundColor: palette.danger,
                  },
                  halo,
                ]}
              />
            ) : null}
            <PressableScale onPress={recording ? stop : start} disabled={busy} compact>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radius.pill,
                  backgroundColor: recording ? palette.danger : palette.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Icon name={recording ? 'stop' : 'mic'} size={21} color="#fff" weight="fill" />
              </View>
            </PressableScale>
          </View>
        </Row>
      </View>
    </View>
  );
}
