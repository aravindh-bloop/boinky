import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { alertT } from '../i18n/alert';
import { api, ApiError } from '../api/client';
import { haptic } from '../ui/haptics';
import { useLang } from '../i18n';

/**
 * Speak arbitrary text aloud in the farmer's language, via the backend TTS
 * endpoint (Sarvam bulbul:v3, cached server-side). Handles the rare multi-chunk
 * response by playing the clips back to back.
 */
export function useVoice() {
  const lang = useLang();
  const player = useRef<AudioPlayer | null>(null);
  const queue = useRef<string[]>([]);
  const sub = useRef<{ remove: () => void } | null>(null);
  const token = useRef(0); // invalidates an in-flight request when we move on

  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const teardown = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
    try {
      player.current?.remove();
    } catch {
      /* already gone */
    }
    player.current = null;
    queue.current = [];
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    token.current += 1;
    setLoading(false);
    teardown();
  }, [teardown]);

  useEffect(() => stop, [stop]);

  const playNext = useCallback(() => {
    const uri = queue.current.shift();
    if (!uri) {
      teardown();
      return;
    }
    if (!player.current) {
      player.current = createAudioPlayer({ uri });
      sub.current = player.current.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) playNext();
      });
    } else {
      player.current.replace({ uri });
    }
    player.current.play();
    setPlaying(true);
  }, [teardown]);

  const speak = useCallback(
    async (text: string) => {
      const clean = text?.trim();
      if (!clean) return;
      stop();
      const mine = ++token.current;
      setLoading(true);
      try {
        await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
        const res = await api.request<{ audio: string[] }>('/api/tts', {
          method: 'POST',
          body: { text: clean, lang },
          timeoutMs: 45_000,
        });
        if (mine !== token.current) return; // superseded
        const uris: string[] = [];
        for (let i = 0; i < res.audio.length; i++) {
          const uri = `${FileSystem.cacheDirectory}tts-${mine}-${i}.wav`;
          await FileSystem.writeAsStringAsync(uri, res.audio[i]!, { encoding: 'base64' });
          uris.push(uri);
        }
        if (mine !== token.current) return;
        queue.current = uris;
        setLoading(false);
        playNext();
      } catch (e) {
        if (mine === token.current) setLoading(false);
        if (e instanceof ApiError) {
          // Voice is an enhancement — a failure here must not block the tutorial.
        }
      }
    },
    [lang, playNext, stop],
  );

  return { speak, stop, loading, playing };
}

/**
 * Sarvam's REST transcription is documented for clips under 30s, and a
 * farmer describing one problem/question needs far less. Stop automatically
 * at the cap rather than letting a long clip fail server-side.
 */
const MAX_RECORD_SECONDS = 30;

/**
 * Record a short clip and transcribe it (Sarvam STT). Shared by every
 * "speak instead of typing" input in the app — the recording lifecycle
 * (permission, audio mode, max-duration cutoff) is the same everywhere;
 * only what the caller does with the resulting text differs.
 */
export function useVoiceRecorder(maxSeconds = MAX_RECORD_SECONDS) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const stopping = useRef(false);

  const seconds = Math.floor((state.durationMillis ?? 0) / 1000);
  const recording = state.isRecording;

  async function start() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        alertT(
          'Microphone permission needed',
          'Allow microphone access to speak instead of typing.',
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

  /** Returns the transcript, or null if nothing usable was heard/it failed. */
  async function stop(): Promise<{ text: string; language: string | null } | null> {
    if (stopping.current) return null;
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
        return null;
      }
      haptic.success();
      return { text, language: res.language };
    } catch (e) {
      haptic.error();
      alertT('Could not transcribe', e instanceof ApiError ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
      stopping.current = false;
    }
  }

  // Hard stop at the cap rather than letting a long clip fail server-side.
  useEffect(() => {
    if (recording && seconds >= maxSeconds) void stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, seconds, maxSeconds]);

  return { recording, busy, seconds, maxSeconds, start, stop };
}
