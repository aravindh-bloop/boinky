import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useApi } from '../api/useApi';
import type { PodLatest } from '../api/types';
import { Card } from './Card';
import { Text } from './Text';
import { Row } from './misc';
import { Icon, type IconName } from './Icon';
import { Sparkline } from './Sparkline';
import { palette, space, radius } from './tokens';

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

interface MetricProps {
  icon: IconName;
  label: string;
  value: number | null;
  unit: string;
  series: number[];
  tint: string;
}

function Metric({ icon, label, value, unit, series, tint }: MetricProps) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Row gap={5}>
        <Icon name={icon} size={14} color={tint} weight="fill" />
        <Text variant="caption" faint>
          {label}
        </Text>
      </Row>
      <Text variant="title" style={{ fontSize: 22 }} raw>
        {value == null ? '—' : `${Math.round(value * 10) / 10}`}
        <Text variant="caption" faint raw>
          {value == null ? '' : ` ${unit}`}
        </Text>
      </Text>
      {series.length > 1 && (
        <Sparkline data={series} color={tint} width={90} height={26} />
      )}
    </View>
  );
}

/**
 * Live readings from the field's hardware pod (ESP32 + soil/temp/pH sensors).
 * Polls every 30 s while mounted. Shows a connect prompt when no pod is bound.
 */
export function PodCard({ fieldId, onConnect }: { fieldId: string; onConnect?: () => void }) {
  const { data, reload } = useApi<PodLatest>('/api/pod/latest', { fieldId });

  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);

  if (!data) return null;

  const { device, reading, history } = data;

  if (!device) {
    return (
      <Card elevation="flat" onPress={onConnect}>
        <Row between>
          <Row gap={8}>
            <Icon name="tractor" size={18} color={palette.textMuted} />
            <Text variant="subhead">Field pod</Text>
          </Row>
          {onConnect && (
            <Text variant="label" color={palette.primary}>
              Connect
            </Text>
          )}
        </Row>
        <Text variant="caption" faint>
          Pair an AgriPod sensor to see live soil moisture, temperature and pH here.
        </Text>
      </Card>
    );
  }

  const dot = device.online ? palette.success : palette.textFaint;
  const sm = history.map((h) => h.soil_moisture ?? 0);
  const tp = history.map((h) => h.temperature ?? 0);
  const ph = history.map((h) => h.soil_ph ?? 0);

  return (
    <Card elevation="raised" accent={device.online ? palette.leaf : undefined}>
      <Row between>
        <Row gap={8}>
          <Icon name="tractor" size={18} color={palette.primaryDeep} weight="fill" />
          <Text variant="subhead">{device.label}</Text>
        </Row>
        <Row gap={6}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
          <Text variant="caption" faint>
            {device.online ? 'Live' : `Last seen ${ago(device.last_seen_at)}`}
          </Text>
        </Row>
      </Row>

      <Row gap={space.md} style={{ marginTop: space.sm }}>
        <Metric icon="irrigate" label="Soil moisture" value={reading?.soil_moisture ?? null} unit="%" series={sm} tint={palette.info} />
        <Metric icon="thermometer" label="Temperature" value={reading?.temperature ?? null} unit="°C" series={tp} tint={palette.clay} />
        <Metric icon="spray" label="Soil pH" value={reading?.soil_ph ?? null} unit="" series={ph} tint={palette.honey} />
      </Row>

      {(reading?.air_humidity != null || reading?.battery_pct != null) && (
        <Row gap={space.md} style={{ marginTop: space.xs }}>
          {reading?.air_humidity != null && (
            <Text variant="caption" faint>
              Air humidity {Math.round(reading.air_humidity)}%
            </Text>
          )}
          {reading?.battery_pct != null && (
            <Text variant="caption" faint>
              Battery {Math.round(reading.battery_pct)}%
            </Text>
          )}
          {reading && (
            <Text variant="caption" faint>
              Updated {ago(reading.created_at)}
            </Text>
          )}
        </Row>
      )}
    </Card>
  );
}
