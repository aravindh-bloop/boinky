import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { api, ApiError } from '../api/client';
import { alertT } from '../i18n/alert';
import { useT } from '../i18n';
import { useVoice } from '../onboarding/voice';
import type { AssistantMessage } from '../api/types';
import { Icon, PressableScale, Row, Text, palette, radius, space } from '../ui';

const SUGGESTIONS = [
  'What is the biggest risk to my crops this week?',
  'When should I irrigate next?',
  'Is it safe to spray now before harvest?',
  'What government schemes can I apply for?',
];

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const t = useT();
  const voice = useVoice();

  const [threadId, setThreadId] = useState<string | undefined>();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroller = useRef<ScrollView>(null);

  async function send(text: string) {
    const body = text.trim();
    if (!body || thinking) return;
    setDraft('');
    const optimistic: AssistantMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      body,
      helpful: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setThinking(true);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    try {
      const res = await api.request<{ threadId: string; message: AssistantMessage }>(
        '/api/assistant/messages',
        { method: 'POST', body: { threadId, text: body }, timeoutMs: 60_000 },
      );
      setThreadId(res.threadId);
      setMessages((m) => [...m, res.message]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(body);
      alertT('AgriPod could not answer', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setThinking(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    }
  }

  async function rate(msg: AssistantMessage, helpful: boolean) {
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, helpful } : x)));
    try {
      await api.request(`/api/assistant/messages/${msg.id}/rating`, {
        method: 'POST',
        body: { helpful },
      });
    } catch {
      /* the optimistic state is fine to keep */
    }
  }

  const empty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.canvas }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <View
        style={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: space.lg,
          paddingBottom: space.sm,
          borderBottomWidth: 1,
          borderBottomColor: palette.hairline,
        }}
      >
        <Row gap={space.sm}>
          <PressableScale onPress={() => nav.goBack()} compact>
            <Icon name="left" size={22} color={palette.text} />
          </PressableScale>
          <Icon name="ai" size={18} color={palette.primaryDeep} weight="fill" />
          <Text variant="subhead" style={{ flex: 1 }}>
            {t('Ask AgriPod')}
          </Text>
        </Row>
      </View>

      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {empty ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: space.md }}>
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.pill,
                  backgroundColor: palette.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="ai" size={28} color={palette.primaryDeep} weight="duotone" />
              </View>
              <Text variant="title" center>{t('Ask AgriPod')}</Text>
              <Text variant="body" muted center>
                {t('It knows your fields, crops and recent scans. Ask anything about your farm.')}
              </Text>
            </View>
            <View style={{ gap: space.xs }}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => send(s)}
                  style={{
                    borderWidth: 1,
                    borderColor: palette.border,
                    borderRadius: radius.lg,
                    paddingVertical: space.sm,
                    paddingHorizontal: space.md,
                  }}
                >
                  <Text variant="body" color={palette.primaryDeep}>{t(s)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => (
            <Animated.View
              key={m.id}
              entering={FadeIn.duration(200)}
              style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}
            >
              <View
                style={{
                  backgroundColor: m.role === 'user' ? palette.primary : palette.surfaceAlt,
                  borderRadius: radius.lg,
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                }}
              >
                <Text variant="body" color={m.role === 'user' ? palette.onPrimary : palette.text}>
                  {m.body}
                </Text>
              </View>
              {m.role === 'assistant' && !m.id.startsWith('local-') && (
                <Row gap={space.md} style={{ marginTop: 4, paddingLeft: 2 }}>
                  <Pressable onPress={() => voice.speak(m.body)} hitSlop={8}>
                    <Row gap={4}>
                      <Icon name={voice.playing ? 'stop' : 'mic'} size={13} color={palette.textMuted} weight="fill" />
                      <Text variant="caption" muted>{voice.playing ? t('Stop') : t('Listen')}</Text>
                    </Row>
                  </Pressable>
                  <Pressable onPress={() => rate(m, true)} hitSlop={8}>
                    <Icon name="check" size={14} color={m.helpful === true ? palette.primary : palette.textFaint} weight={m.helpful === true ? 'fill' : 'regular'} />
                  </Pressable>
                  <Pressable onPress={() => rate(m, false)} hitSlop={8}>
                    <Icon name="warningCircle" size={14} color={m.helpful === false ? palette.warn : palette.textFaint} weight={m.helpful === false ? 'fill' : 'regular'} />
                  </Pressable>
                </Row>
              )}
            </Animated.View>
          ))
        )}

        {thinking && (
          <Row gap={space.sm} style={{ alignSelf: 'flex-start', paddingVertical: space.sm }}>
            <ActivityIndicator color={palette.primary} />
            <Text variant="body" muted>{t('AgriPod is thinking…')}</Text>
          </Row>
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          padding: space.md,
          paddingBottom: insets.bottom + space.sm,
          borderTopWidth: 1,
          borderTopColor: palette.hairline,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('Ask about your farm…')}
          placeholderTextColor={palette.textFaint}
          multiline
          style={{
            flex: 1,
            maxHeight: 100,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: radius.lg,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            fontSize: 15,
            color: palette.text,
          }}
        />
        <PressableScale
          onPress={() => send(draft)}
          disabled={thinking || !draft.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: draft.trim() ? palette.primary : palette.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="arrowRight" size={18} color={draft.trim() ? palette.onPrimary : palette.textFaint} weight="bold" />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}
