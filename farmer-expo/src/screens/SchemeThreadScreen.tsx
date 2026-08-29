import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { alertT } from '../i18n/alert';
import type { SchemeThreadDetail } from '../api/types';
import { Icon, LoaderScreen, PressableScale, Row, Text, palette, radius, space } from '../ui';

export default function SchemeThreadScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { threadId: initialId, schemeId, schemeTitle } = useRoute().params as {
    threadId?: string;
    schemeId?: string;
    schemeTitle?: string;
  };

  const [threadId, setThreadId] = useState<string | undefined>(initialId);
  const [subject, setSubject] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const { data, reload } = useApi<SchemeThreadDetail>(threadId ? `/api/schemes/threads/${threadId}` : null);

  useEffect(() => {
    if (!threadId) return;
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
  }, [threadId, reload]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      if (!threadId) {
        const res = await api.request<{ id: string }>('/api/schemes/threads', {
          method: 'POST',
          body: {
            schemeId,
            subject: subject.trim() || `Question about ${schemeTitle ?? 'a scheme'}`,
            body,
          },
        });
        setThreadId(res.id);
      } else {
        await api.request(`/api/schemes/threads/${threadId}/messages`, {
          method: 'POST',
          body: { body },
        });
      }
      setDraft('');
      reload();
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      alertT('Could not send', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (threadId && !data) return <LoaderScreen label="Loading conversation" />;

  const title = data?.thread.subject ?? schemeTitle ?? 'New question';

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
          <Text variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
        </Row>
      </View>

      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {!threadId && (
          <>
            <Text variant="caption" muted>
              Subject
            </Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={`Question about ${schemeTitle ?? 'a scheme'}`}
              placeholderTextColor={palette.textFaint}
              style={{
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: radius.md,
                padding: space.sm,
                fontSize: 15,
                color: palette.text,
              }}
            />
          </>
        )}

        {(data?.messages ?? []).map((m) => (
          <View
            key={m.id}
            style={{ alignSelf: m.sender_role === 'farmer' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
          >
            <View
              style={{
                backgroundColor: m.sender_role === 'farmer' ? palette.primary : palette.surfaceAlt,
                borderRadius: radius.lg,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
              }}
            >
              <Text variant="body" color={m.sender_role === 'farmer' ? palette.onPrimary : palette.text}>
                {m.body}
              </Text>
            </View>
            <Text variant="caption" faint style={{ marginTop: 2, alignSelf: m.sender_role === 'farmer' ? 'flex-end' : 'flex-start' }}>
              {m.sender_role === 'official' ? 'Extension officer' : 'You'}
            </Text>
          </View>
        ))}

        {!threadId && (
          <Text variant="caption" muted center style={{ marginTop: space.lg }}>
            Type your question below and send.
          </Text>
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
          placeholder="Write a message…"
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
          onPress={send}
          disabled={busy || !draft.trim()}
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
