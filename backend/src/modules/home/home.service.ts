import { query, queryMaybe, queryOne } from '../../db/query.js';
import { getUserById } from '../auth/auth.service.js';
import { getFarmerTasks } from '../farm/tasks.service.js';
import { getWeather } from '../weather/weather.service.js';
import { listFarmerAlerts } from '../alerts/alerts.service.js';
import { getNearbyOutbreaksForFarmer } from '../hotspots/hotspots.service.js';
import { logger } from '../../lib/logger.js';

export async function getHome(farmerId: string) {
  // Everything that can run in parallel, does. Each helper is 1–2 fast queries.
  const [me, fieldRisk, tasks, alerts, nearby, finance, lowStock, recentScans, w] = await Promise.all([
    getUserById(farmerId),
    fieldRiskOverview(farmerId),
    getFarmerTasks(farmerId, 7),
    listFarmerAlerts({ farmerId, limit: 3 }).catch(() => []),
    getNearbyOutbreaksForFarmer(farmerId).catch(() => null),
    financeSnapshot(farmerId),
    countLowStock(farmerId),
    query<{
      id: string;
      diagnosis_label: string | null;
      severity: string | null;
      status: string;
      image_url: string;
      created_at: string;
    }>(
      `SELECT id, diagnosis_label, severity, status, image_url, created_at
         FROM scans WHERE farmer_id = $1 ORDER BY created_at DESC LIMIT 3`,
      [farmerId],
    ),
    // cache-only — never block the dashboard on a live Open-Meteo call
    getWeather({ farmerId, cachedOnly: true }).catch(() => null),
  ]);

  const highestRisk =
    [...fieldRisk]
      .filter((f) => f.riskScore != null)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))[0] ?? null;

  const weather = w
    ? {
        place: w.place.label,
        current: w.current,
        today: w.daily[0] ?? null,
        topAdvisory: w.advisories[0] ?? null,
        advisoryCount: w.advisories.length,
        sprayWindow: w.sprayWindow,
      }
    : null;

  return {
    user: { name: me.name, region: me.region, language: me.preferred_language },
    fieldCount: fieldRisk.length,
    weather,
    tasks: {
      today: tasks.today,
      overdueCount: tasks.counts.overdue,
      upcomingCount: tasks.counts.upcoming,
    },
    alerts: {
      count: Array.isArray(alerts) ? alerts.length : 0,
      latest: Array.isArray(alerts) ? alerts.slice(0, 2) : [],
    },
    nearbyOutbreaks: nearby,
    fieldRisk,
    highestRisk,
    recentScans,
    lowStockCount: lowStock,
    finance,
  };
}

/** One query: each field + its most recent risk snapshot. */
async function fieldRiskOverview(farmerId: string) {
  return query<{
    id: string;
    name: string;
    crop: string;
    daysSinceSown: number | null;
    hasLocation: boolean;
    riskLevel: 'low' | 'medium' | 'high' | null;
    riskScore: number | null;
  }>(
    `SELECT f.id,
            coalesce(f.name, f.crop) AS name,
            f.crop,
            CASE WHEN f.sown_date IS NULL THEN NULL ELSE (CURRENT_DATE - f.sown_date) END AS "daysSinceSown",
            (f.location IS NOT NULL) AS "hasLocation",
            s.risk_level AS "riskLevel",
            s.risk_score AS "riskScore"
       FROM fields f
       LEFT JOIN LATERAL (
         SELECT risk_level, risk_score FROM risk_snapshots
          WHERE field_id = f.id ORDER BY date DESC LIMIT 1
       ) s ON true
      WHERE f.farmer_id = $1
      ORDER BY f.created_at`,
    [farmerId],
  );
}

/** One query for the season money snapshot. */
async function financeSnapshot(farmerId: string) {
  const row = await queryOne<{ spent: number; revenue: number }>(
    `SELECT
       (SELECT coalesce(sum(amount),0)::float FROM expenses
         WHERE farmer_id = $1 AND spent_on > now() - interval '180 days') AS spent,
       (SELECT coalesce(sum(revenue),0)::float FROM harvests
         WHERE farmer_id = $1 AND harvested_on > now() - interval '180 days') AS revenue`,
    [farmerId],
  );
  return { spent: row.spent, revenue: row.revenue, net: row.revenue - row.spent };
}

async function countLowStock(farmerId: string): Promise<number> {
  const row = await queryMaybe<{ n: number }>(
    `SELECT count(*)::int AS n FROM inventory_items
      WHERE farmer_id = $1 AND low_stock_at IS NOT NULL AND quantity IS NOT NULL
        AND quantity <= low_stock_at`,
    [farmerId],
  );
  return row?.n ?? 0;
}
