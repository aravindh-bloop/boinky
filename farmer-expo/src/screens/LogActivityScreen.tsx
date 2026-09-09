import { alertT } from '../i18n/alert';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useApi } from '../api/useApi';
import { api, ApiError } from '../api/client';
import type { Field } from '../api/types';
import {
  Button,
  Card,
  Field as Input,
  Icon,
  Row,
  Screen,
  SelectChip,
  Text,
  kindMeta,
  palette,
  space,
} from '../ui';
import type { FieldsStackParams } from '../navigation';

type R = RouteProp<FieldsStackParams, 'LogActivity'>;

const KINDS = [
  { v: 'irrigation', label: 'Irrigation' },
  { v: 'spraying', label: 'Spraying' },
  { v: 'fertilizing', label: 'Fertilizing' },
  { v: 'sowing', label: 'Sowing' },
  { v: 'weeding', label: 'Weeding' },
  { v: 'scouting', label: 'Scouting' },
  { v: 'harvest', label: 'Harvest' },
  { v: 'other', label: 'Other' },
] as const;

export default function LogActivityScreen() {
  const nav = useNavigation<any>();
  const params = useRoute<R>().params ?? {};
  const { data } = useApi<{ fields: Field[] }>('/api/fields');
  const fields = data?.fields ?? [];

  const [kind, setKind] = useState<string>(mapPreset(params.presetKind) ?? 'irrigation');
  const [fieldId, setFieldId] = useState<string | undefined>(params.fieldId);
  const [title, setTitle] = useState('');
  const [inputName, setInputName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const needsInput = kind === 'spraying' || kind === 'fertilizing';

  async function save() {
    const t = title.trim() || defaultTitle(kind, inputName);
    if (!t) return alertT('Add a short description');
    setBusy(true);
    try {
      await api.request('/api/activities', {
        method: 'POST',
        body: {
          fieldId,
          kind,
          title: t,
          note: note.trim() || undefined,
          inputName: inputName.trim() || undefined,
          quantity: qty ? Number(qty) : undefined,
          unit: unit.trim() || undefined,
          cost: cost ? Number(cost) : undefined,
          sourceTaskId: params.taskId,
        },
      });
      nav.goBack();
    } catch (e) {
      alertT('Could not save', e instanceof ApiError ? e.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title="Save activity" onPress={save} loading={busy} size="lg" />}>
      <Card accent={kindMeta(kind).tint}>
        <Row gap={space.sm}>
          <Icon name={kindMeta(kind).icon} size={16} color={kindMeta(kind).tint} weight="fill" />
          <Text variant="label" muted>
            WHAT DID YOU DO?
          </Text>
        </Row>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {KINDS.map((k) => {
            const km = kindMeta(k.v);
            return (
              <SelectChip
                key={k.v}
                label={k.label}
                selected={kind === k.v}
                onPress={() => setKind(k.v)}
                accent={km.tint}
                accentSoft={km.soft}
                icon={
                  <Icon
                    name={km.icon}
                    size={13}
                    color={kind === k.v ? km.tint : palette.textFaint}
                    weight="fill"
                  />
                }
              />
            );
          })}
        </Row>
      </Card>

      <Card>
        {fields.length > 0 && (
          <View style={{ gap: space.xs }}>
            <Text variant="label" muted>
              FIELD
            </Text>
            <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
              <SelectChip label="No field" selected={!fieldId} onPress={() => setFieldId(undefined)} />
              {fields.map((f) => (
                <SelectChip key={f.id} label={f.name || f.crop} selected={fieldId === f.id} onPress={() => setFieldId(f.id)} />
              ))}
            </Row>
          </View>
        )}
        <Input
          label="Short description"
          value={title}
          onChangeText={setTitle}
          placeholder={defaultTitle(kind, inputName) || 'e.g. Irrigated the whole plot'}
        />
        {needsInput && (
          <Input label="Product used" value={inputName} onChangeText={setInputName} placeholder="e.g. Mancozeb 75% WP" />
        )}
        <Row gap={space.md}>
          <View style={{ flex: 1 }}>
            <Input label="Quantity" value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="2" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Unit" value={unit} onChangeText={setUnit} placeholder="kg / L / hrs" />
          </View>
        </Row>
        <Input
          label="Cost (₹, optional)"
          value={cost}
          onChangeText={setCost}
          keyboardType="decimal-pad"
          placeholder="900"
        />
        <Input label="Notes (optional)" value={note} onChangeText={setNote} placeholder="Anything worth remembering" multiline />
      </Card>
    </Screen>
  );
}

function mapPreset(t?: string) {
  if (!t) return undefined;
  if (['irrigation', 'spraying', 'fertilizing', 'scouting', 'harvest', 'sowing', 'weeding'].includes(t)) return t;
  return undefined;
}
function defaultTitle(kind: string, input: string) {
  const verb: Record<string, string> = {
    irrigation: 'Irrigated the field',
    spraying: input ? `Sprayed ${input}` : 'Sprayed the crop',
    fertilizing: input ? `Applied ${input}` : 'Applied fertiliser',
    sowing: 'Sowed the field',
    weeding: 'Weeded the field',
    scouting: 'Scouted the field',
    harvest: 'Harvested',
    other: '',
  };
  return verb[kind] ?? '';
}
