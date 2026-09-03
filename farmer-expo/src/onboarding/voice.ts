import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { api, ApiError } from '../api/client';
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
