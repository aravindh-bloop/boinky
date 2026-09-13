import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Button,
  Card,
  Field,
  Icon,
  Row,
  ScreenHeader,
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
import { TutorialOverlay } from '../onboarding/TutorialOverlay';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const nav = useNavigation<any>();
  const t = useT();

  const currentLang = normalizeLang(user?.preferred_language);
  const [region, setRegion] = useState(user?.region ?? '');
  const [busy, setBusy] = useState(false);
  const [tutorial, setTutorial] = useState<'app' | 'pod' | null>(null);

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
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.giant }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          tone="crop"
          title={t('Settings')}
          onBack={() => nav.goBack()}
        >
          <Row gap={space.md}>
            <View style={styles.avatar}>
              <Text variant="title" color="#fff" raw>
                {(user?.name?.[0] ?? 'F').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title" color="#fff" raw numberOfLines={1}>
                {user?.name ?? t('Farmer')}
              </Text>
              <Text variant="caption" raw color="rgba(255,255,255,0.8)" numberOfLines={1}>
                {user?.phone ?? user?.email ?? ''}
              </Text>
            </View>
          </Row>
        </ScreenHeader>

        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md }}>
          <Card elevation="flat" style={{ gap: space.md }}>
            <Row gap={space.sm}>
              <Icon name="scroll" size={18} color={palette.iris} weight="fill" />
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
          </Card>

          <Card elevation="flat" style={{ gap: space.sm }}>
            <Row gap={space.sm}>
              <Icon name="hotspot" size={18} color={palette.sky} weight="fill" />
              <Text variant="label" faint>
                {t('District')}
              </Text>
            </Row>
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

          <Card elevation="flat" style={{ gap: space.xs }}>
            <Text variant="label" faint>
              {t('Help')}
            </Text>
            <PressableScale onPress={() => setTutorial('app')} style={{ paddingVertical: space.sm }}>
              <Row gap={space.sm}>
                <Icon name="insight" size={18} color={palette.primary} weight="fill" />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {t('How to use Agrian')}
                </Text>
                <Icon name="right" size={16} color={palette.textFaint} />
              </Row>
            </PressableScale>
            <PressableScale onPress={() => setTutorial('pod')} style={{ paddingVertical: space.sm }}>
              <Row gap={space.sm}>
                <Icon name="stock" size={18} color={palette.primary} weight="fill" />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {t('Set up an Agrian sensor')}
                </Text>
                <Icon name="right" size={16} color={palette.textFaint} />
              </Row>
            </PressableScale>
          </Card>

          {tutorial && (
            <TutorialOverlay topic={tutorial} visible onDone={() => setTutorial(null)} />
          )}

          <PressableScale
            onPress={() =>
              alertT(t('Log out?'), '', [
                { text: t('Cancel'), style: 'cancel' },
                { text: t('Log out'), style: 'destructive', onPress: logout },
              ])
            }
            style={{ alignSelf: 'center', padding: space.lg, marginTop: space.sm }}
          >
            <Row gap={space.sm}>
              <Icon name="signOut" size={18} color={palette.danger} />
              <Text variant="bodyStrong" color={palette.danger}>
                {t('Log out')}
              </Text>
            </Row>
          </PressableScale>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = {
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};
