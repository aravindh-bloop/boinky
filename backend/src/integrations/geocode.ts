import { query, queryMaybe } from '../db/query.js';
import { logger } from '../lib/logger.js';

/**
 * Resolve a GPS coordinate to its administrative area (state / district /
 * sub-district / village) for district-wise outbreak tracking and officer
 * scoping. A city name is too coarse.
 *
 * Two resolvers, tried in order:
 *  1. `admin_areas` — an offline PostGIS boundary set, if one has been seeded
 *     (scripts/seed-admin-areas.ts). Authoritative, no network, no rate limit.
 *  2. BigDataCloud reverse-geocode — keyless, free, and accurate to the Indian
 *     district / taluk level (verified 2026-09-03). Used when `admin_areas` is
 *     empty, and always for the village name.
 *
 * Every resolved coordinate is cached in `geocode_cache` keyed by lat/lng
 * rounded to ~110 m, so a field or scan in a place we have already seen is a
 * single table read. Never throws — an unresolvable point stores as all-null.
 */

export interface AdminArea {
  state: string | null;
  district: string | null;
  subdistrict: string | null;
  village: string | null;
}

const EMPTY: AdminArea = { state: null, district: null, subdistrict: null, village: null };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function resolveAdmin(lat: number, lng: number): Promise<AdminArea> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return EMPTY;
  const latKey = round3(lat);
  const lngKey = round3(lng);

  const cached = await queryMaybe<AdminArea>(
    `SELECT state, district, subdistrict, village
       FROM geocode_cache WHERE lat_key = $1 AND lng_key = $2`,
    [latKey, lngKey],
  );
  if (cached) return cached;

  let resolved = EMPTY;
  let source = 'bigdatacloud';
  try {
    const fromBoundaries = await fromAdminAreas(lat, lng);
    const fromNetwork = await fromBigDataCloud(lat, lng);
    if (fromBoundaries) {
      source = 'admin_areas';
      resolved = {
        ...fromBoundaries,
        // village name is not in the boundary set — take it from the network call
        village: fromNetwork?.village ?? null,
      };
    } else if (fromNetwork) {
      resolved = fromNetwork;
    }
  } catch (err) {
    logger.warn({ err, lat, lng }, 'reverse geocode failed — storing unresolved');
  }

  await query(
    `INSERT INTO geocode_cache (lat_key, lng_key, state, district, subdistrict, village, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (lat_key, lng_key) DO UPDATE SET
       state = EXCLUDED.state, district = EXCLUDED.district,
       subdistrict = EXCLUDED.subdistrict, village = EXCLUDED.village,
       source = EXCLUDED.source`,
    [latKey, lngKey, resolved.state, resolved.district, resolved.subdistrict, resolved.village, source],
  ).catch((err) => logger.warn({ err }, 'geocode_cache write failed (non-fatal)'));

  return resolved;
}

/** PostGIS lookup against a seeded boundary set. Returns null when the table is empty. */
async function fromAdminAreas(lat: number, lng: number): Promise<Omit<AdminArea, 'village'> | null> {
  const any = await queryMaybe<{ n: number }>(`SELECT 1 AS n FROM admin_areas LIMIT 1`, []);
  if (!any) return null;

  const point = `ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography`;
  const hit = async (level: string) =>
    queryMaybe<{ name: string; state: string | null }>(
      `SELECT name, state FROM admin_areas
        WHERE level = $3 AND ST_Covers(geom, ${point})
        ORDER BY ST_Area(geom::geometry) ASC LIMIT 1`,
      [lat, lng, level],
    );

  const [district, subdistrict, state] = await Promise.all([
    hit('district'),
    hit('subdistrict'),
    hit('state'),
  ]);
  if (!district && !state) return null;
  return {
    state: state?.name ?? district?.state ?? null,
    district: district?.name ?? null,
    subdistrict: subdistrict?.name ?? null,
  };
}

interface BdcAdmin {
  name?: string;
  adminLevel?: number;
  isoName?: string;
  order?: number;
}
interface BdcResponse {
  principalSubdivision?: string;
  city?: string;
  locality?: string;
  localityInfo?: { administrative?: BdcAdmin[] };
}

const TALUK_RE = /\b(taluk|taluka|tehsil|mandal|block|circle|sub-?district)\b/i;
const DISTRICT_RE = /\bdistrict\b/i;

async function fromBigDataCloud(lat: number, lng: number): Promise<AdminArea | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lng}&localityLanguage=en`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  let json: BdcResponse;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`bigdatacloud ${res.status}`);
    json = (await res.json()) as BdcResponse;
  } finally {
    clearTimeout(timer);
  }

  const admins = json.localityInfo?.administrative ?? [];
  const clean = (s: string | undefined | null) =>
    (s ?? '').replace(/\s+district$/i, '').replace(/\s+(urban|rural)$/i, '').trim() || null;

  const state = clean(json.principalSubdivision) ?? clean(admins.find((a) => a.adminLevel === 4)?.name);

  // District: an admin entry that literally says "… district", else the level-5/6 entry.
  const districtEntry =
    admins.find((a) => DISTRICT_RE.test(a.name ?? '')) ??
    admins.find((a) => a.adminLevel === 5) ??
    admins.find((a) => a.adminLevel === 6 && !TALUK_RE.test(a.name ?? ''));
  const subEntry = admins.find((a) => TALUK_RE.test(a.name ?? ''));

  const village = json.locality || json.city || clean(admins[admins.length - 1]?.name);

  const out: AdminArea = {
    state,
    district: clean(districtEntry?.name),
    subdistrict: clean(subEntry?.name),
    village: village || null,
  };
  return out.state || out.district ? out : null;
}
