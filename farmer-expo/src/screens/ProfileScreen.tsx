import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import {
  Button,
  Card,
  Field,
  Icon,
  Row,
  Screen,
  SegmentedControl,
  Text,
  PressableScale,
  palette,
  radius,
  space,
} from '../ui';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../api/client';
import { cache } from '../api/cache';
import { useT, normalizeLang } from '../i18n';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const t = useT();

  const currentLang = normalizeLang(user?.preferred_language);
  const [region, setRegion] = useState(user?.region ?? '');
  const [busy, setBusy] = useState(false);

  async function patch(body: { preferredLanguage?: string; region?: string }) {
    setBusy(true);
    try {
      await api.request('/api/auth/me', { method: 'PATCH', body });
      cache.purge(); // every screen refetches in the new language
      await refreshUser();
    } catch (e) {
      alertT(t('Could not save'), e instanceof ApiError ? e.message : t('Please try again'));
    } finally {
      setBusy(false);
    }
  }

  const regionChanged = region.trim() && region.trim() !== (user?.region ?? '');

  return (
    <Screen>
      <Card>
        <Row gap={space.md}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: palette.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="title" color="#fff">
              {(user?.name?.[0] ?? 'F').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="title">{user?.name}</Text>
            <Text variant="caption" muted>
              {user?.phone ?? user?.email}
            </Text>
          </View>
        </Row>
      </Card>

      <Card elevation="flat" style={{ gap: space.md }}>
        <View style={{ gap: space.xs }}>
          <Row gap={space.sm}>
            <Icon name="scroll" size={18} color={palette.textMuted} />
            <Text variant="label" faint>
              {t('App language')}
            </Text>
          </Row>
          <SegmentedControl
            value={currentLang}
            onChange={(v) => {
              if (v !== currentLang && !busy) patch({ preferredLanguage: v });
            }}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ta', label: 'தமிழ்' },
            ]}
          />
          <Text variant="caption" faint>
            {t('Everything in the app, in your language.')}
          </Text>
        </View>
      </Card>

      <Card elevation="flat" style={{ gap: space.sm }}>
        <Field
          label={t('District')}
          value={region}
          onChangeText={setRegion}
          placeholder={t('e.g. Chennai')}
        />
        {regionChanged ? (
          <Button
            title={t('Save changes')}
            size="sm"
            loading={busy}
            onPress={() => patch({ region: region.trim() })}
          />
        ) : null}
      </Card>

      <PressableScale
        onPress={() =>
          alertT(t('Log out?'), '', [
            { text: t('Cancel'), style: 'cancel' },
            { text: t('Log out'), style: 'destructive', onPress: logout },
          ])
        }
        style={{ alignSelf: 'center', padding: space.lg, marginTop: space.md }}
      >
        <Row gap={space.sm}>
          <Icon name="signOut" size={18} color={palette.danger} />
          <Text variant="bodyStrong" color={palette.danger}>
            {t('Log out')}
          </Text>
        </Row>
      </PressableScale>
    </Screen>
  );
}
