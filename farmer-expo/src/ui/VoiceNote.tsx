import React, { useEffect } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useVoiceRecorder } from '../onboarding/voice';
import { Icon } from './Icon';
import { Text } from './Text';
import { PressableScale } from './Pressable';
import { Row } from './misc';
import { palette, radius, space, type } from './tokens';

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
  const rec = useVoiceRecorder();

  // Breathing halo while recording — the only cue that the mic is actually live.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (rec.recording) {
      pulse.value = withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [rec.recording, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.35,
    transform: [{ scale: 1 + pulse.value * 0.25 }],
  }));

  async function handleStop() {
    const res = await rec.stop();
    if (!res) return;
    // Append rather than replace, so a second recording adds to the first.
    onChange(value.trim() ? `${value.trim()} ${res.text}` : res.text);
    onLanguage?.(res.language);
  }

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
          borderColor: rec.recording ? palette.danger : palette.border,
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
          editable={!rec.recording && !rec.busy}
          placeholder="e.g. the lower leaves have been wilting for four days"
          placeholderTextColor={palette.textFaint}
          style={{ minHeight: 66, ...type.body, color: palette.text, textAlignVertical: 'top' }}
        />

        <Row between>
          {rec.busy ? (
            <Row gap={space.sm}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text variant="caption" muted>
                Transcribing…
              </Text>
            </Row>
          ) : rec.recording ? (
            <Animated.View entering={FadeIn.duration(150)}>
              <Row gap={space.sm}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.danger }} />
                <Text variant="caption" color={palette.danger}>
                  Listening · {rec.seconds}s / {rec.maxSeconds}s
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
            {rec.recording ? (
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
            <PressableScale onPress={rec.recording ? handleStop : rec.start} disabled={rec.busy} compact>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: radius.pill,
                  backgroundColor: rec.recording ? palette.danger : palette.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: rec.busy ? 0.5 : 1,
                }}
              >
                <Icon name={rec.recording ? 'stop' : 'mic'} size={21} color="#fff" weight="fill" />
              </View>
            </PressableScale>
          </View>
        </Row>
      </View>
    </View>
  );
}
