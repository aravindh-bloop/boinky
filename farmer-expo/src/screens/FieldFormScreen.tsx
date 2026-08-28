import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, ApiError } from '../api/client';
import { Button, Card, Field, Row, Screen, Stagger, Text, palette, space } from '../ui';
import type { FieldsStackParams } from '../navigation';

type Nav = NativeStackNavigationProp<FieldsStackParams, 'FieldForm'>;

export default function FieldFormScreen() {
  const nav = useNavigation<Nav>();
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [crop, setCrop] = useState('');
  const [variety, setVariety] = useState('');
  const [sownDate, setSownDate] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [area, setArea] = useState('');

  async function save() {
    if (!crop.trim()) return Alert.alert('Crop is required');
    if (sownDate && !/^\d{4}-\d{2}-\d{2}$/.test(sownDate.trim()))
      return Alert.alert('Sowing date should look like 2026-06-15');
    setBusy(true);
    try {
      await api.request('/api/fields', {
        method: 'POST',
        body: {
          name: name.trim() || undefined,
          crop: crop.trim(),
          variety: variety.trim() || undefined,
          sownDate: sownDate.trim() || undefined,
          lat: lat ? Number(lat) : undefined,
          lng: lng ? Number(lng) : undefined,
          areaAcres: area ? Number(area) : undefined,
        },
      });
      nav.goBack();
    } catch (e) {
      Alert.alert('Could not save', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title="Save field" onPress={save} loading={busy} size="lg" />}>
      <Stagger>
        <Card>
          <Field label="Field name (optional)" value={name} onChangeText={setName} placeholder="e.g. North plot" />
          <Field label="Crop" value={crop} onChangeText={setCrop} placeholder="cotton, soybean, tomato…" />
          <Field label="Variety (optional)" value={variety} onChangeText={setVariety} placeholder="e.g. Bt-II" />
          <Field
            label="Sowing date"
            value={sownDate}
            onChangeText={setSownDate}
            placeholder="2026-06-15"
            hint="YYYY-MM-DD — used to build your crop calendar"
          />
        </Card>

        <Card>
          <Text variant="subhead">Location</Text>
          <Text variant="caption" faint>
            Needed for weather-risk alerts and the regional hotspot map.
          </Text>
          <Row gap={space.md}>
            <View style={{ flex: 1 }}>
              <Field label="Latitude" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="18.5204" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Longitude" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" placeholder="73.8567" />
            </View>
          </Row>
          <Field label="Area in acres (optional)" value={area} onChangeText={setArea} keyboardType="decimal-pad" placeholder="2.5" />
        </Card>
      </Stagger>
    </Screen>
  );
}
