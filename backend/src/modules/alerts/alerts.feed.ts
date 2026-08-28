/**
 * The farmer's alert feed = one merged, severity-ranked list computed live from
 * real data. Nothing here is stored or hand-authored:
 *
 *  - office       extension-officer broadcasts (alerts table)
 *  - weather      Open-Meteo advisories for the field location
 *  - forewarning  Open-Meteo forecast + crop growth stage + nearby confirmed
 *                 scans, run through the risk heuristic (modules/risk)
 *  - outbreak     confirmed medium/high scans by OTHER farmers nearby (hotspots)
 */
import { query } from '../../db/query.js';
import { logger } from '../../lib/logger.js';
import { fetchWeatherWindow, type WeatherDay } from '../../integrations/weather.js';
import { computeRisk, type RiskResult } from '../risk/risk.model.js';
import { cropProfile } from '../risk/crop-profiles.js';
import { getWeather } from '../weather/weather.service.js';
import { getNearbyOutbreaksForFarmer } from '../hotspots/hotspots.service.js';
import { listFarmerAlerts } from './alerts.service.js';

export type AlertSource = 'office' | 'weather' | 'forewarning' | 'outbreak';

export type ReasonKind = 'humidity' | 'weather' | 'stage' | 'pest' | 'history' | 'score';

/** One line of the "why we're flagging this" strip on an alert card. */
export interface AlertReason {
  kind: ReasonKind;
  text: string;
}

export interface FeedAlert {
  id: string;
  source: AlertSource;
  severity: 'low' | 'medium' | 'high' | null;
  title: string;
  message: string;
  match_reason: string | null;
  official_name: string | null;
  field_id: string | null;
  created_at: string;
  /** Present on computed alerts (weather / forewarning): the evidence behind it. */
  reasons?: AlertReason[];
  /** 0-100 risk score, forewarning only. */
  score?: number;
}

function classifyFactor(f: string): AlertReason {
  const t = f.toLowerCase();
  if (t.includes('outbreak') || t.includes('confirmed')) return { kind: 'history', text: f };
  if (t.includes('pest') || t.includes('favour')) return { kind: 'pest', text: f };
  if (t.includes('vulnerable stage') || t.includes('growth stage') || t.includes('day '))
    return { kind: 'stage', text: f };
  if (t.includes('humid') || t.includes('leaf wetness') || t.includes('rain'))
    return { kind: 'humidity', text: f };
  return { kind: 'weather', text: f };
}

/**
 * Only the Open-Meteo-dependent parts of the feed (weather advisories +
 * per-field forewarning) are cached, per farmer, for 15 min — well within the
 * useful life of a weather / pest advisory. Office broadcasts and nearby
 * outbreaks are cheap DB reads and always fetched live, so a new alert or a
 * fresh outbreak shows up immediately.
 */
const WEATHER_PART_TTL_MS = 15 * 60_000;
const weatherPartCache = new Map<string, { at: number; items: FeedAlert[] }>();

const SEV_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const SOURCE_RANK: Record<AlertSource, number> = {
  outbreak: 4,
  office: 3,
  forewarning: 2,
  weather: 1,
};

interface LocatedField {
  id: string;
  name: string | null;
  crop: string;
  days: number | null;
  lat: number;
  lng: number;
}

export async function buildFarmerAlertFeed(
  farmerId: string,
  opts: { live?: boolean; since?: string; fresh?: boolean } = {},
): Promise<FeedAlert[]> {
  const live = opts.live ?? false;

  const [office, nearby, weatherParts] = await Promise.all([
    listFarmerAlerts({ farmerId, since: opts.since, limit: 50 }).catch(() => []),
    getNearbyOutbreaksForFarmer(farmerId).catch(() => null),
    weatherAndForewarnings(farmerId, live, opts.fresh ?? false).catch((err) => {
      logger.warn({ err, farmerId }, 'alert feed: weather/forewarning step failed');
      return [] as FeedAlert[];
    }),
  ]);

  const out: FeedAlert[] = [...weatherParts];

  // extension-office broadcasts
  for (const a of office) {
    out.push({
      id: a.id,
      source: 'office',
      severity: a.severity,
      title: a.title,
      message: a.message,
      match_reason: a.match_reason ?? null,
      official_name: a.official_name ?? null,
      field_id: null,
      created_at: a.created_at,
    });
  }

  // outbreaks reported by other farmers nearby
  if (nearby && nearby.count > 0) {
    for (const d of nearby.topDiagnoses) {
      if (!d.label) continue;
      out.push({
        id: `outbreak:${d.label.toLowerCase()}`,
        source: 'outbreak',
        severity: 'high',
        title: `${d.label} reported nearby`,
        message:
          `${d.count} confirmed case${d.count > 1 ? 's' : ''} of ${d.label} on other farms ` +
          `within ${nearby.radiusKm} km` +
          (nearby.nearestKm != null ? ` (nearest ~${nearby.nearestKm} km)` : '') +
          ` in the last ${nearby.days} days. Scout your crop and act early if you see symptoms.`,
        match_reason: `outbreak · within ${nearby.radiusKm} km`,
        official_name: null,
        field_id: null,
        created_at: new Date().toISOString(),
      });
    }
  }

  out.sort((a, b) => {
    const s = (SEV_RANK[b.severity ?? 'low'] ?? 0) - (SEV_RANK[a.severity ?? 'low'] ?? 0);
    if (s !== 0) return s;
    const src = SOURCE_RANK[b.source] - SOURCE_RANK[a.source];
    if (src !== 0) return src;
    return b.created_at.localeCompare(a.created_at);
  });

  return out;
}

/**
 * Weather advisories + per-field forewarning — the parts that call Open-Meteo.
 * Cached per farmer for 15 min. `live: false` uses only the 30-min weather cache
 * for advisories and still computes forewarnings (one Open-Meteo window call per
 * field grid, then cached here).
 */
async function weatherAndForewarnings(
  farmerId: string,
  live: boolean,
  fresh: boolean,
): Promise<FeedAlert[]> {
  const key = farmerId;
  if (!fresh) {
    const hit = weatherPartCache.get(key);
    if (hit && Date.now() - hit.at < WEATHER_PART_TTL_MS) return hit.items;
  }

  const [weather, fields] = await Promise.all([
    getWeather({ farmerId, cachedOnly: !live }).catch(() => null),
    query<LocatedField>(
      `SELECT id, name, crop,
              CASE WHEN sown_date IS NULL THEN NULL ELSE (CURRENT_DATE - sown_date) END AS days,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
         FROM fields
        WHERE farmer_id = $1 AND location IS NOT NULL`,
      [farmerId],
    ).catch(() => [] as LocatedField[]),
  ]);

  const items: FeedAlert[] = [];

  if (weather) {
    for (const adv of weather.advisories) {
      if (adv.severity === 'info') continue;
      items.push({
        id: `weather:${adv.key}`,
        source: 'weather',
        severity: adv.severity === 'warning' ? 'high' : 'medium',
        title: adv.title,
        message: adv.detail,
        match_reason: weather.place.label ? `weather · ${weather.place.label}` : 'weather forecast',
        official_name: null,
        field_id: null,
        created_at: new Date().toISOString(),
      });
    }
  }

  if (fields.length) {
    try {
      items.push(...(await fieldForewarnings(fields)));
    } catch (err) {
      logger.warn({ err, farmerId }, 'alert feed: forewarning failed');
    }
  }

  weatherPartCache.set(key, { at: Date.now(), items });
  return items;
}

/** count of nearby high-severity confirmed scans, grid-deduped within a request */
async function countNearbyHighSeverity(lat: number, lng: number): Promise<number> {
  const row = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM scans
      WHERE location IS NOT NULL
        AND severity = 'high'
        AND status IN ('auto_confirmed', 'validated', 'corrected')
        AND created_at > now() - interval '21 days'
        AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 10000)`,
    [lat, lng],
  );
  return row[0]?.n ?? 0;
}

async function fieldForewarnings(fields: LocatedField[]): Promise<FeedAlert[]> {
  const today = new Date().toISOString().slice(0, 10);
  const gridKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

  const windows = new Map<string, WeatherDay[]>();
  const nearbyByGrid = new Map<string, number>();
  for (const f of fields) {
    const g = gridKey(f.lat, f.lng);
    if (!windows.has(g)) {
      windows.set(
        g,
        await fetchWeatherWindow(f.lat, f.lng, { pastDays: 1, forecastDays: 3 }).catch(() => []),
      );
    }
    if (!nearbyByGrid.has(g)) nearbyByGrid.set(g, await countNearbyHighSeverity(f.lat, f.lng));
  }

  const out: FeedAlert[] = [];
  for (const f of fields) {
    const g = gridKey(f.lat, f.lng);
    const win = (windows.get(g) ?? []).filter((d) => d.date >= today);
    if (!win.length) continue;
    const nearbyOutbreaks = nearbyByGrid.get(g) ?? 0;

    let worst: (RiskResult & { date: string }) | null = null;
    for (const d of win) {
      const offset =
        f.days == null
          ? null
          : f.days + Math.round((Date.parse(d.date) - Date.parse(today)) / 86_400_000);
      const r = computeRisk({ weather: d, crop: f.crop, daysSinceSown: offset, nearbyOutbreaks });
      if (!worst || r.score > worst.score) worst = { ...r, date: d.date };
    }
    if (!worst) continue;

    const profile = cropProfile(f.crop);
    const inWindow =
      f.days != null &&
      f.days >= profile.peakVulnerability.fromDay &&
      f.days <= profile.peakVulnerability.toDay;
    const emit = worst.level === 'high' || (worst.level === 'medium' && inWindow);
    if (!emit) continue;

    const threat = profile.mainThreats[0] ?? 'crop disease';
    const where = f.name || f.crop;
    const peakSoon = worst.date !== today;

    const reasons: AlertReason[] = [
      { kind: 'score', text: `Risk score ${worst.score}/100 (${worst.level})` },
      ...worst.factors.map(classifyFactor),
    ];
    if (peakSoon) {
      reasons.push({
        kind: 'weather',
        text: `Forecast keeps conditions favourable through ${friendlyDate(worst.date)}`,
      });
    }

    out.push({
      id: `forewarn:${f.id}`,
      source: 'forewarning',
      severity: worst.level === 'high' ? 'high' : 'medium',
      score: worst.score,
      title: `${cap(threat)} risk ${worst.level === 'high' ? 'is high' : 'building'} — ${where}`,
      message:
        `Your ${f.crop} is in the growth stage this threat targets and the weather ` +
        `favours it${peakSoon ? ' over the next few days' : ''}. Scout the field now and ` +
        `line up inputs so you can act quickly if it worsens.`,
      match_reason: `${f.crop} · early warning from weather + crop stage`,
      official_name: null,
      field_id: f.id,
      created_at: new Date().toISOString(),
      reasons,
    });
  }
  return out;
}

function friendlyDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
