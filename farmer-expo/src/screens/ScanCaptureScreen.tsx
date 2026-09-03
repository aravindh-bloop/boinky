import { alertT } from '../i18n/alert';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import { getFix } from '../location';
import { useT } from '../i18n';
import type { Field, Scan, ScanAngle, ScanDraft } from '../api/types';
import {
  Button,
  Card,
  Icon,
  OrganicBackground,
  Reveal,
  Row,
  SelectChip,
  Text,
  VoiceNote,
  haptic,
  palette,
  radius,
  space,
} from '../ui';
import type { ScanStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<ScanStackParams, 'ScanCapture'>;

/** The guided angles, with the farmer-facing name and one-line framing hint. */
const GUIDE: { kind: ScanAngle; title: string; hint: string; required?: boolean }[] = [
  { kind: 'whole_plant', title: 'The whole plant', hint: 'Stand back so the full plant fits in the frame', required: true },
  { kind: 'affected_closeup', title: 'Close-up of the problem', hint: 'Fill the frame with the spots, holes or discolouring', required: true },
  { kind: 'leaf_underside', title: 'Underside of a leaf', hint: 'Turn a leaf over — pests and mould hide here' },
  { kind: 'stem_base', title: 'Stem and base', hint: 'The lower stem where it meets the soil' },
  { kind: 'fruit_panicle', title: 'Fruit / grain head', hint: 'Any pods, fruit or panicles — skip if none yet' },
  { kind: 'field_wide', title: 'The wider field', hint: 'How much of the crop around it looks the same' },
];

interface Shot {
  localUri: string;
  mediaId: string | null;
  uploading: boolean;
  failed: boolean;
}

type Phase = 'setup' | 'capture' | 'video' | 'review';

export default function ScanCaptureScreen() {
  const nav = useNavigation<Nav>();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { data } = useApi<{ fields: Field[] }>('/api/fields');
  const fields = data?.fields ?? [];

  const [phase, setPhase] = useState<Phase>('setup');
  const [fieldId, setFieldId] = useState<string | undefined>();
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  const [starting, setStarting] = useState(false);

  const [step, setStep] = useState(0); // index into GUIDE
  const [shots, setShots] = useState<Record<string, Shot>>({});
  const [video, setVideo] = useState<Shot | null>(null);

  const [note, setNote] = useState('');
  const [noteLanguage, setNoteLanguage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const camRef = useRef<CameraView>(null);
  const [camReady, setCamReady] = useState(false);
  const [busyShot, setBusyShot] = useState(false);
  const [recording, setRecording] = useState(false);

  const capturedCount = Object.values(shots).filter((s) => !s.failed).length;

  // ── start a draft ──────────────────────────────────────────────────────────
  async function begin() {
    setStarting(true);
    try {
      const perm = camPerm?.granted ? camPerm : await requestCam();
      if (!perm.granted) {
        setStarting(false);
        return alertT('Camera permission needed', 'Allow camera access to run a guided scan.');
      }
      let lat: number | undefined;
      let lng: number | undefined;
      let accuracyM: number | undefined;
      try {
        const fix = await getFix();
        lat = fix.lat;
        lng = fix.lng;
        accuracyM = fix.accuracyM ?? undefined;
      } catch {
        /* no fix — the field's location is the fallback */
      }
      const d = await api.request<ScanDraft>('/api/scans/draft', {
        method: 'POST',
        body: { fieldId, lat, lng, accuracyM },
      });
      setDraft(d);
      setStep(0);
      setShots({});
      setVideo(null);
      setPhase('capture');
    } catch (e) {
      alertT('Could not start the scan', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setStarting(false);
    }
  }

  // ── capture one photo for the current angle ────────────────────────────────
  const angle = GUIDE[step]!;

  async function capture() {
    if (!camRef.current || !camReady || busyShot || !draft) return;
    setBusyShot(true);
    haptic.select();
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
      if (!pic?.uri) throw new Error('no image');
      const kind = angle.kind;
      setShots((s) => ({ ...s, [kind]: { localUri: pic.uri, mediaId: null, uploading: true, failed: false } }));
      // advance immediately; the upload finishes in the background
      if (step < GUIDE.length - 1) setStep((n) => n + 1);
      void uploadShot(kind, pic.uri, step);
    } catch (e) {
      haptic.error();
      alertT('Could not take the photo', e instanceof Error ? e.message : '');
    } finally {
      setBusyShot(false);
    }
  }

  async function uploadShot(kind: ScanAngle, uri: string, position: number) {
    if (!draft) return;
    try {
      const res = await api.upload<{ media: { id: string } }>(
        `/api/scans/${draft.scanId}/media`,
        { uri, name: `${kind}.jpg`, type: 'image/jpeg' },
        { kind, position: String(position) },
        { fieldName: 'media' },
      );
      setShots((s) => ({ ...s, [kind]: { localUri: uri, mediaId: res.media.id, uploading: false, failed: false } }));
    } catch {
      setShots((s) => ({ ...s, [kind]: { localUri: uri, mediaId: null, uploading: false, failed: true } }));
    }
  }

  async function retake(kind: ScanAngle) {
    const shot = shots[kind];
    if (shot?.mediaId && draft) {
      void api.request(`/api/scans/${draft.scanId}/media/${shot.mediaId}`, { method: 'DELETE' }).catch(() => {});
    }
    setShots((s) => {
      const next = { ...s };
      delete next[kind];
      return next;
    });
    const idx = GUIDE.findIndex((g) => g.kind === kind);
    if (idx >= 0) {
      setStep(idx);
      setPhase('capture');
    }
  }

  // ── optional video ────────────────────────────────────────────────────────
  async function toggleRecord() {
    if (!camRef.current || !draft) return;
    if (recording) {
      camRef.current.stopRecording();
      return;
    }
    const perm = micPerm?.granted ? micPerm : await requestMic();
    if (!perm.granted) return alertT('Microphone needed', 'A video needs microphone access. You can skip the video.');
    setRecording(true);
    haptic.select();
    try {
      const rec = await camRef.current.recordAsync({ maxDuration: 12 });
      setRecording(false);
      if (!rec?.uri) return;
      setVideo({ localUri: rec.uri, mediaId: null, uploading: true, failed: false });
      const res = await api.upload<{ media: { id: string } }>(
        `/api/scans/${draft.scanId}/media`,
        { uri: rec.uri, name: 'scan.mp4', type: 'video/mp4' },
        { kind: 'video', position: '20' },
        { fieldName: 'media' },
      );
      setVideo({ localUri: rec.uri, mediaId: res.media.id, uploading: false, failed: false });
      setPhase('review');
    } catch {
      setRecording(false);
      setVideo((v) => (v ? { ...v, uploading: false, failed: true } : v));
    }
  }

  // ── submit ────────────────────────────────────────────────────────────────
  async function submit(force = false) {
    if (!draft) return;
    if (Object.values(shots).some((s) => s.uploading)) {
      return alertT('Still uploading', 'Wait a moment for the photos to finish uploading.');
    }
    setSubmitting(true);
    try {
      const res = await api.request<{ scan: Scan }>(`/api/scans/${draft.scanId}/submit`, {
        method: 'POST',
        body: {
          note: note.trim() || undefined,
          noteLanguage: noteLanguage || undefined,
          force: force || undefined,
        },
        timeoutMs: 60_000,
      });
      haptic.success();
      resetAll();
      nav.navigate('ScanResult', { scanId: res.scan.id });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const missing = (e.details as { missingAngles?: ScanAngle[] })?.missingAngles ?? [];
        const names = missing.map((m) => GUIDE.find((g) => g.kind === m)?.title ?? m).join(', ');
        Alert.alert(
          t('Some photos are missing'),
          t('For an accurate diagnosis, add: {names}', { names }),
          [
            { text: t('Add them'), onPress: () => { setPhase('capture'); setStep(GUIDE.findIndex((g) => g.kind === missing[0])); } },
            { text: t('Diagnose anyway'), style: 'destructive', onPress: () => submit(true) },
          ],
        );
      } else {
        alertT('Diagnosis failed', e instanceof ApiError ? e.message : 'Try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setPhase('setup');
    setDraft(null);
    setShots({});
    setVideo(null);
    setNote('');
    setNoteLanguage(null);
    setStep(0);
  }

  // Discard a half-finished draft if the farmer leaves the flow.
  useEffect(() => {
    return () => {
      if (draft && phase !== 'setup') {
        // best-effort: server also sweeps abandoned drafts after 24h
      }
    };
  }, [draft, phase]);

  // ───────────────────────────── render ─────────────────────────────────────

  if (phase === 'capture' || phase === 'video') {
    const isVideo = phase === 'video';
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode={isVideo ? 'video' : 'picture'}
          onCameraReady={() => setCamReady(true)}
        />

        {/* frame guide */}
        <View pointerEvents="none" style={styles.frameWrap}>
          <View style={styles.frame} />
        </View>

        {/* top: what to shoot */}
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <Pressable onPress={() => (isVideo ? setPhase('review') : nav.goBack())} hitSlop={12}>
            <Icon name="close" size={24} color="#fff" weight="bold" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="subhead" color="#fff" raw>
              {isVideo ? t('Pan slowly around the plant') : t(angle.title)}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.75)" raw>
              {isVideo ? t('Up to 12 seconds') : `${step + 1} / ${GUIDE.length} · ${t(angle.hint)}`}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* bottom: thumbnails + shutter */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space.md }]}>
          {!isVideo && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 56, marginBottom: space.sm }}>
              <Row gap={6}>
                {GUIDE.map((g, i) => {
                  const shot = shots[g.kind];
                  return (
                    <View
                      key={g.kind}
                      style={[
                        styles.thumb,
                        i === step && styles.thumbActive,
                        shot?.failed && { borderColor: palette.danger },
                      ]}
                    >
                      {shot ? (
                        <Image source={{ uri: shot.localUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <Text variant="caption" color="rgba(255,255,255,0.5)" raw>{i + 1}</Text>
                      )}
                      {shot?.uploading && (
                        <View style={styles.thumbOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      )}
                    </View>
                  );
                })}
              </Row>
            </ScrollView>
          )}

          <Row between style={{ alignItems: 'center' }}>
            <Pressable
              onPress={() => (isVideo ? setPhase('review') : step < GUIDE.length - 1 ? setStep(step + 1) : setPhase(capturedCount > 0 ? 'review' : 'capture'))}
              hitSlop={10}
              style={{ width: 80 }}
            >
              <Text variant="label" color="#fff">{t('Skip')}</Text>
            </Pressable>

            {isVideo ? (
              <Pressable onPress={toggleRecord} style={[styles.shutter, recording && styles.shutterRec]}>
                <View style={recording ? styles.recSquare : styles.recDot} />
              </Pressable>
            ) : (
              <Pressable onPress={capture} disabled={!camReady || busyShot} style={styles.shutter}>
                {busyShot ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
              </Pressable>
            )}

            <Pressable
              onPress={() => setPhase('review')}
              hitSlop={10}
              style={{ width: 80, alignItems: 'flex-end' }}
            >
              <Text variant="label" color="#fff">
                {t('Done')} {capturedCount > 0 ? `(${capturedCount})` : ''}
              </Text>
            </Pressable>
          </Row>
        </View>
      </View>
    );
  }

  // ── setup ─────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        <OrganicBackground tint="green" height={190 + insets.top} />
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.xxl }}
        >
          <View>
            <Text variant="hero" color={palette.primaryDeep}>{t('Scan a crop')}</Text>
            <Text variant="body" muted>
              {t('A guided set of photos from every angle — the more the AI sees, the more accurate the diagnosis.')}
            </Text>
          </View>

          <Reveal>
            <Card>
              <Text variant="subhead">{t('What you will photograph')}</Text>
              <View style={{ gap: space.xs, marginTop: space.xs }}>
                {GUIDE.map((g) => (
                  <Row key={g.kind} gap={space.sm}>
                    <Icon name={g.required ? 'check' : 'circle'} size={15} color={g.required ? palette.primary : palette.textFaint} weight={g.required ? 'fill' : 'regular'} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {t(g.title)}
                      {g.required ? '' : ` · ${t('optional')}`}
                    </Text>
                  </Row>
                ))}
                <Row gap={space.sm}>
                  <Icon name="video" size={15} color={palette.textFaint} />
                  <Text variant="body" style={{ flex: 1 }}>{t('A short video')} · {t('optional')}</Text>
                </Row>
              </View>
            </Card>
          </Reveal>

          {fields.length > 0 && (
            <Reveal index={1}>
              <Card elevation="flat">
                <Text variant="subhead">{t('Which field?')}</Text>
                <Text variant="caption" faint>{t('Improves the diagnosis and risk score')}</Text>
                <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
                  <SelectChip label={t('None')} selected={!fieldId} onPress={() => setFieldId(undefined)} />
                  {fields.map((f) => (
                    <SelectChip key={f.id} label={f.name || f.crop} selected={fieldId === f.id} onPress={() => setFieldId(f.id)} />
                  ))}
                </Row>
              </Card>
            </Reveal>
          )}

          <Reveal index={2}>
            <Button
              title={t('Start guided scan')}
              size="lg"
              loading={starting}
              onPress={begin}
              icon={<Icon name="camera" size={18} color="#fff" weight="fill" />}
            />
            <Pressable onPress={() => nav.navigate('ScanQuick')} style={{ alignSelf: 'center', paddingVertical: space.md }}>
              <Text variant="label" color={palette.textMuted}>{t('Quick scan — one photo')}</Text>
            </Pressable>
          </Reveal>
        </ScrollView>
      </View>
    );
  }

  // ── review ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.xxl }}
      >
        <Text variant="hero" color={palette.primaryDeep}>{t('Review the set')}</Text>

        <Animated.View entering={FadeIn}>
          <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
            {GUIDE.map((g) => {
              const shot = shots[g.kind];
              return (
                <Pressable
                  key={g.kind}
                  onPress={() => retake(g.kind)}
                  style={[styles.reviewTile, !shot && styles.reviewTileEmpty]}
                >
                  {shot ? (
                    <>
                      <Image source={{ uri: shot.localUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      {shot.failed && (
                        <View style={styles.reviewBadge}>
                          <Icon name="retry" size={13} color="#fff" weight="bold" />
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', gap: 2 }}>
                      <Icon name="plus" size={16} color={palette.textFaint} />
                      <Text variant="caption" faint center raw>{t(g.title)}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            <Pressable onPress={() => setPhase('video')} style={[styles.reviewTile, styles.reviewTileEmpty]}>
              {video ? (
                <Image source={{ uri: video.localUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Icon name="video" size={16} color={palette.textFaint} />
                  <Text variant="caption" faint raw>{t('Video')}</Text>
                </View>
              )}
            </Pressable>
          </Row>
        </Animated.View>

        <Text variant="caption" faint>{t('Tap a photo to retake it.')}</Text>

        <Card elevation="flat">
          <VoiceNote value={note} onChange={setNote} language={noteLanguage} onLanguage={setNoteLanguage} />
        </Card>
      </ScrollView>

      <View style={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.md, gap: space.sm }}>
        <Button
          title={t('Diagnose crop')}
          size="lg"
          loading={submitting}
          disabled={capturedCount === 0}
          onPress={() => submit(false)}
        />
        <Pressable onPress={resetAll} style={{ alignSelf: 'center', paddingVertical: space.xs }}>
          <Text variant="label" color={palette.textMuted}>{t('Start over')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: '78%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 24,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  thumbActive: { borderColor: '#fff' },
  thumbOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  shutter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  shutterRec: { borderColor: 'rgba(255,80,80,0.5)' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  recDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#e33' },
  recSquare: { width: 24, height: 24, borderRadius: 5, backgroundColor: '#e33' },
  reviewTile: {
    width: 104,
    height: 104,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTileEmpty: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: palette.border,
  },
  reviewBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: palette.danger,
    borderRadius: 10,
    padding: 3,
  },
});
