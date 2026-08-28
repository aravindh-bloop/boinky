import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import type { Field, Scan } from '../api/types';
import {
  Button,
  Card,
  Icon,
  Loader,
  OrganicBackground,
  Reveal,
  Row,
  SelectChip,
  Text,
  palette,
  radius,
  space,
  PressableScale,
  haptic,
} from '../ui';
import type { ScanStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<ScanStackParams, 'ScanCapture'>;

interface Picked {
  uri: string;
  mimeType: string;
  fileName: string;
}

export default function ScanScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { data } = useApi<{ fields: Field[] }>('/api/fields');
  const fields = data?.fields ?? [];

  const [image, setImage] = useState<Picked | null>(null);
  const [fieldId, setFieldId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function pick(from: 'camera' | 'library') {
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Camera permission needed', 'Allow camera access, or use Gallery.');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, exif: false };
      const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      const a = res.assets[0];
      if (a?.uri) {
        haptic.select();
        setImage({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', fileName: a.fileName ?? `scan-${Date.now()}.jpg` });
      }
    } catch (e: any) {
      Alert.alert('Camera / gallery error', e?.message ?? String(e));
    }
  }

  async function submit() {
    if (!image) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('image', { uri: image.uri, type: image.mimeType, name: image.fileName } as any);
      if (fieldId) form.append('fieldId', fieldId);
      const res = await api.upload<{ scan: Scan }>('/api/scans', form);
      haptic.success();
      setImage(null);
      nav.navigate('ScanResult', { scanId: res.scan.id });
    } catch (e) {
      haptic.error();
      Alert.alert('Diagnosis failed', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.canvas }}>
        <OrganicBackground tint="green" height={500} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl }}>
          {image && (
            <Animated.View entering={ZoomIn.springify().damping(15)} style={{ borderRadius: radius.xxl, overflow: 'hidden' }}>
              <Image source={{ uri: image.uri }} style={{ width: 200, height: 200 }} contentFit="cover" />
            </Animated.View>
          )}
          <Loader size={44} />
          <Text variant="heading" center>
            Diagnosing your crop
          </Text>
          <Text variant="body" muted center>
            Checking the photo for diseases and pests. Just a few seconds.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.canvas }}>
      <OrganicBackground tint="green" height={190 + insets.top} />
      <View style={{ paddingTop: insets.top + space.xl, paddingHorizontal: space.lg, gap: space.md, flex: 1 }}>
        <View>
          <Text variant="hero" color={palette.primaryDeep}>
            Scan a crop
          </Text>
          <Text variant="body" muted>
            Photograph the affected leaf, stem or fruit
          </Text>
        </View>

        <Reveal>
          <Card>
            {image ? (
              <PressableScale onPress={() => pick('library')} style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
                <Image source={{ uri: image.uri }} style={{ width: '100%', height: 240, borderRadius: radius.lg }} contentFit="cover" transition={200} />
              </PressableScale>
            ) : (
              <View
                style={{
                  height: 200,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderStyle: 'dashed',
                  borderColor: palette.borderStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: space.sm,
                  backgroundColor: palette.surfaceAlt,
                }}
              >
                <Icon name="leaf" size={38} color={palette.sage} weight="duotone" />
                <Text variant="body" muted>
                  No photo yet
                </Text>
              </View>
            )}
            <Row gap={space.md} style={{ marginTop: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button title="Camera" variant="soft" icon={<Icon name="scan" size={16} color={palette.primaryDeep} weight="fill" />} onPress={() => pick('camera')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Gallery" variant="soft" onPress={() => pick('library')} />
              </View>
            </Row>
          </Card>
        </Reveal>

        {fields.length > 0 && (
          <Reveal index={1}>
            <Card elevation="flat">
              <Text variant="subhead">Which field?</Text>
              <Text variant="caption" faint>
                Optional — improves the diagnosis and risk score
              </Text>
              <Row gap={space.sm} style={{ flexWrap: 'wrap', marginTop: space.xs }}>
                <SelectChip label="None" selected={!fieldId} onPress={() => setFieldId(undefined)} />
                {fields.map((f) => (
                  <SelectChip key={f.id} label={f.name || f.crop} selected={fieldId === f.id} onPress={() => setFieldId(f.id)} />
                ))}
              </Row>
            </Card>
          </Reveal>
        )}

        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: insets.bottom + space.md }}>
          <Button title="Diagnose crop" onPress={submit} disabled={!image} size="lg" />
        </View>
      </View>
    </View>
  );
}
