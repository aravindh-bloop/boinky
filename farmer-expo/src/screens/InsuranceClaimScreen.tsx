import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { getFix } from '../location';
import { useT } from '../i18n';
import type { ClaimCause, ClaimDetail, InsurancePolicy, Scan } from '../api/types';
import {
  Button,
  Card,
  Field as TextField,
  Icon,
  Row,
  SelectChip,
  Text,
  haptic,
  palette,
  radius,
  space,
} from '../ui';
import type { InsuranceStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<InsuranceStackParams, 'FileClaim'>;
type R = RouteProp<InsuranceStackParams, 'FileClaim'>;

const CAUSES: { value: ClaimCause; label: string }[] = [
  { value: 'flood', label: 'Flood' },
  { value: 'unseasonal_rain', label: 'Unseasonal rain' },
  { value: 'drought', label: 'Drought' },
  { value: 'hailstorm', label: 'Hailstorm' },
  { value: 'cyclone', label: 'Cyclone' },
  { value: 'frost', label: 'Frost' },
  { value: 'fire', label: 'Fire' },
  { value: 'pest_disease', label: 'Pest / disease' },
  { value: 'other', label: 'Other' },
];

interface Shot {
  localUri: string;
  mediaId: string | null;
  uploading: boolean;
  failed: boolean;
}

export default function InsuranceClaimScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const { policyId: presetPolicy } = useRoute<R>().params ?? {};

  const { data: polData } = useApi<{ policies: InsurancePolicy[] }>('/api/insurance/policies');
  const { data: scanData } = useApi<{ scans: Scan[] }>('/api/scans?limit=15');
  const policies = polData?.policies ?? [];
  const scans = (scanData?.scans ?? []).filter((s) => s.status !== 'rejected' && s.status !== 'draft');

  const [phase, setPhase] = useState<'form' | 'evidence'>('form');
  const [claimId, setClaimId] = useState<string | null>(null);

  const [policyId, setPolicyId] = useState<string | undefined>(presetPolicy ?? policies[0]?.id);
  const [cause, setCause] = useState<ClaimCause | undefined>();
  const [incidentDate, setIncidentDate] = useState('');
  const [description, setDescription] = useState('');
  const [lossPct, setLossPct] = useState('');
  const [scanId, setScanId] = useState<string | undefined>();

  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);

  async function createDraft() {
    if (!policyId) return alertT('Pick the insured field');
    if (!cause) return alertT('Choose what caused the damage');
    if (incidentDate && !/^\d{4}-\d{2}-\d{2}$/.test(incidentDate.trim()))
      return alertT('Date should look like 2026-08-30');
    setBusy(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const fix = await getFix();
        lat = fix.lat;
        lng = fix.lng;
      } catch {
        /* optional */
      }
      const res = await api.request<ClaimDetail>('/api/insurance/claims', {
        method: 'POST',
        body: {
          policyId,
          cause,
          incidentDate: incidentDate.trim() || undefined,
          description: description.trim() || undefined,
          estimatedLossPct: lossPct ? Number(lossPct) : undefined,
          scanId,
          lat,
          lng,
        },
      });
      setClaimId(res.claim.id);
      setPhase('evidence');
    } catch (e) {
      alertT('Could not start the claim', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function addPhotos() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const res = perm.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, exif: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          selectionLimit: 6,
          quality: 0.7,
        });
    if (res.canceled) return;
    haptic.select();
    for (const asset of res.assets) {
      const shot: Shot = { localUri: asset.uri, mediaId: null, uploading: true, failed: false };
      setShots((s) => [...s, shot]);
      void uploadShot(asset.uri, shot);
    }
  }

  async function uploadShot(uri: string, ref: Shot) {
    if (!claimId) return;
    try {
      const r = await api.upload<{ media: { id: string } }>(
        `/api/insurance/claims/${claimId}/media`,
        { uri, name: 'damage.jpg', type: 'image/jpeg' },
        {},
        { fieldName: 'media' },
      );
      setShots((s) => s.map((x) => (x === ref || x.localUri === uri ? { ...x, mediaId: r.media.id, uploading: false } : x)));
    } catch {
      setShots((s) => s.map((x) => (x === ref || x.localUri === uri ? { ...x, uploading: false, failed: true } : x)));
    }
  }

  async function submit() {
    if (!claimId) return;
    const ok = shots.filter((s) => s.mediaId).length;
    if (ok === 0) return alertT('Add at least one photo of the damage');
    if (shots.some((s) => s.uploading)) return alertT('Wait for the photos to finish uploading');
    setBusy(true);
    try {
      await api.request(`/api/insurance/claims/${claimId}/submit`, { method: 'POST', timeoutMs: 45_000 });
      haptic.success();
      nav.replace('ClaimDetail', { claimId });
    } catch (e) {
      alertT('Could not submit', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'form') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingTop: insets.top + space.md }}>
          <Text variant="hero" color={palette.primaryDeep}>{t('File a claim')}</Text>

          <Card elevation="flat">
            <Text variant="subhead">{t('Insured field')}</Text>
            <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
              {policies.map((p) => (
                <SelectChip
                  key={p.id}
                  label={`${p.field_name || p.crop} · ${p.season}`}
                  selected={policyId === p.id}
                  onPress={() => setPolicyId(p.id)}
                />
              ))}
            </Row>
          </Card>

          <Card elevation="flat">
            <Text variant="subhead">{t('What caused the damage?')}</Text>
            <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
              {CAUSES.map((c) => (
                <SelectChip key={c.value} label={t(c.label)} selected={cause === c.value} onPress={() => setCause(c.value)} />
              ))}
            </Row>
          </Card>

          <Card elevation="flat">
            <TextField
              label={t('When did it happen?')}
              value={incidentDate}
              onChangeText={setIncidentDate}
              placeholder="2026-08-30"
              hint="YYYY-MM-DD"
            />
            <TextField
              label={t('Describe the damage')}
              value={description}
              onChangeText={setDescription}
              placeholder={t('e.g. Heavy rain lodged the crop on the low end of the plot')}
              multiline
            />
            <TextField
              label={t('Roughly how much of the crop is lost? (%)')}
              value={lossPct}
              onChangeText={setLossPct}
              keyboardType="number-pad"
              placeholder="50"
            />
          </Card>

          {scans.length > 0 && (
            <Card elevation="flat">
              <Text variant="subhead">{t('Link a scan (optional)')}</Text>
              <Text variant="caption" faint>{t('If a crop scan shows the same problem, link it as evidence.')}</Text>
              <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
                <SelectChip label={t('None')} selected={!scanId} onPress={() => setScanId(undefined)} />
                {scans.slice(0, 8).map((s) => (
                  <SelectChip
                    key={s.id}
                    label={s.diagnosis_label ?? 'Scan'}
                    selected={scanId === s.id}
                    onPress={() => setScanId(s.id)}
                  />
                ))}
              </Row>
            </Card>
          )}
        </ScrollView>
        <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.md }}>
          <Button title={t('Next — add photos')} size="lg" loading={busy} onPress={createDraft} />
        </View>
      </View>
    );
  }

  // evidence phase
  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingTop: insets.top + space.md }}>
        <Text variant="hero" color={palette.primaryDeep}>{t('Photograph the damage')}</Text>
        <Text variant="body" muted>
          {t('Take clear photos — a wide shot of the field and close-ups of the worst areas. An officer uses these to assess the loss.')}
        </Text>

        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {shots.map((s, i) => (
            <View key={i} style={{ width: 104, height: 104, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: palette.surfaceAlt }}>
              <Image source={{ uri: s.localUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              {s.uploading && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
                  <Text variant="caption" color="#fff" raw>…</Text>
                </View>
              )}
              {s.failed && (
                <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: palette.danger, borderRadius: 9, padding: 2 }}>
                  <Icon name="retry" size={12} color="#fff" weight="bold" />
                </View>
              )}
            </View>
          ))}
          <Pressable
            onPress={addPhotos}
            style={{
              width: 104,
              height: 104,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: palette.border,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Icon name="camera" size={20} color={palette.primaryDeep} />
            <Text variant="caption" color={palette.primaryDeep}>{t('Add')}</Text>
          </Pressable>
        </Row>
      </ScrollView>
      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.md }}>
        <Button
          title={t('Submit claim')}
          size="lg"
          loading={busy}
          disabled={shots.filter((s) => s.mediaId).length === 0}
          onPress={submit}
        />
      </View>
    </View>
  );
}
