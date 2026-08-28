# AgriPod Backend

Node + Express + TypeScript API for the AgriPod crop-health platform.
Postgres (Neon) + PostGIS. Gemini (vision), Sarvam AI (multilingual advisory),
Cloudinary (images), Open-Meteo (weather).

See `../PROGRESS.md` for build state and `../docs/ARCHITECTURE.md` for design decisions.

## Run

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, GEMINI_API_KEY, SARVAM_API_KEY, CLOUDINARY_*
npm run migrate:up        # apply migrations to the DB in .env
npm run seed              # load pesticide_reference + schemes reference data (idempotent)
npm run dev               # http://localhost:4000  — health: GET /health
```

`npm run build` → `dist/`, then `npm start`. `npm run typecheck` for CI.

## Auth

`POST /api/auth/signup` / `login` return `{ token, user }`. Send `Authorization: Bearer <token>`
on every other call. Two roles: `farmer`, `official`.

## API surface

### Auth
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | – | `{name,password,role,phone?/email?,preferredLanguage?,region?}` |
| POST | `/api/auth/login` | – | `{identifier,password}` (identifier = phone or email) |
| GET | `/api/auth/me` | any | |
| PATCH | `/api/auth/me` | any | `{name?,preferredLanguage?,region?}` |

### Fields (farmer)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/fields` | `{crop,name?,variety?,sownDate?,lat?,lng?,areaAcres?}` — auto-seeds calendar if sownDate |
| GET | `/api/fields` · `/api/fields/:id` | own fields; `days_since_sown` derived |
| PATCH / DELETE | `/api/fields/:id` | |

### Scans (farmer) — the core detection loop
| Method | Path | Notes |
|---|---|---|
| POST | `/api/scans` | multipart: `image` (≤8MB jpg/png/webp) + `fieldId?`/`lat?`/`lng?`. ~15s: downscale → Cloudinary → Gemini → Sarvam → risk → persist. Status: `auto_confirmed` \| `needs_validation` \| `rejected` |
| GET | `/api/scans` | `?fieldId=&status=&limit=&offset=` |
| GET | `/api/scans/:id` | |
| GET | `/api/scans/:id/safety` | `?harvestDate=YYYY-MM-DD` — PHI check of recommended inputs vs harvest window |

### Risk / weather (farmer)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/risk/:fieldId` | `?refresh=true` — computes+caches today's `risk_snapshots` row, returns live 3-day outlook |
| GET | `/api/risk/:fieldId/history` | `?days=30` |

### Alerts
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/api/alerts` | official | `{title,message,region?,crop?,severity?,centerLat?,centerLng?,radiusKm?}` — needs ≥1 target |
| GET | `/api/alerts` | any | official → own/`?scope=region`; farmer → relevance feed w/ `match_reason`, `?since=` |
| GET / DELETE | `/api/alerts/:id` | any / official(own) | |

### Hotspots
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/api/hotspots` | official | `?bbox=minLng,minLat,maxLng,maxLat` or `?centerLat=&centerLng=&radiusKm=`; `?days=&crop=&severity=&category=&includePending=`. Returns `points[]` + `summary[]` |
| GET | `/api/hotspots/summary` | official | summary only |
| GET | `/api/hotspots/nearby` | farmer | nearby-outbreak banner: count + nearestKm + top diagnoses near own fields |

### Pesticides (any auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/pesticides` | `?q=&crop=` search the reference table |
| GET | `/api/pesticides/lookup` | `?name=&crop=` — table match, else Gemini estimate (cached as `ai_estimate`) |

### Calendar (farmer)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/calendar/:fieldId` | `?from=&to=` |
| POST | `/api/calendar/:fieldId/generate` | (re)build from crop-stage rules; preserves done state + user/scan tasks |
| POST | `/api/calendar/:fieldId/tasks` | `{taskDate,title,taskType?,description?}` |
| PATCH / DELETE | `/api/calendar/tasks/:taskId` | `{isDone?,title?,description?,taskDate?}` |

### Schemes (any auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/schemes` | `?q=` search; for farmers sorted relevant-first with `match_reasons`; `?forMe=true` filters |
| GET | `/api/schemes/:id` | |

### Inventory (farmer)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/inventory` | `{itemName,itemType?,quantity?,unit?,lowStockAt?,purchaseDate?,expiryDate?}` |
| GET | `/api/inventory` | `?itemType=&lowStock=true`; computed `low_stock`/`expired`/`expiring_soon` |
| GET / PATCH / DELETE | `/api/inventory/:id` | PATCH accepts `quantityDelta` for consume/restock |

### Official dashboard (`official` role) — region-scoped, `?allRegions=true` to widen
| Method | Path | Notes |
|---|---|---|
| GET | `/api/official/overview` | stats: scans, byStatus, activeAlerts, topDiagnoses, byCrop |
| GET | `/api/official/validation-queue` | `?crop=&includeResolved=&limit=&offset=` |
| POST | `/api/official/scans/:id/validate` | `{action: confirm\|correct\|reject, correctedLabel?, correctedCategory?, correctedSeverity?, note?}` — `correct` regenerates the advisory in the farmer's language |
| GET | `/api/official/directory` | `?q=&limit=&offset=` |
| GET | `/api/official/trends` | `?days=90` — weekly category buckets + top diagnoses |

## Deploy (Render)

`render.yaml` at the repo root is a Render Blueprint. Deploy it **in the Singapore region**
so it sits next to the Neon Postgres project (also `ap-southeast-1`) — that's what makes
the app fast (backend↔DB is ~1 ms instead of ~120 ms).

1. Render dashboard → **New + → Blueprint** → pick this repo → Apply.
2. In the service's **Environment** tab set the secrets (`sync: false` in the yaml):
   `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `SARVAM_API_KEY`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. Build runs `migrate:deploy` automatically (idempotent). Reference data is already in the
   Neon DB; to reseed a fresh DB run `npm run seed && npm run seed:dev` locally against it.
4. **Keep it awake:** Render free spins down after 15 min idle (cold start ~40 s). Add a
   free cron (cron-job.org / UptimeRobot) hitting `GET https://<app>.onrender.com/health`
   every 10 min.
5. Point the app at it: `farmer-expo/src/config.ts` → `API_BASE_URL = 'https://<app>.onrender.com'`,
   then rebuild the APK.

## Scripts

- `scripts/try-diagnosis.ts <image> [lang]` — run the Gemini→Sarvam pipeline standalone
- `scripts/bench-gemini.ts [image]` — model/size latency benchmark
- `scripts/fixtures/potato-late-blight.jpg` — test image

## Layout

```
src/
  config/env.ts          zod-validated env
  db/                    pool, query helpers, seed
  http/                  errors, asyncHandler+validate, auth middleware, multer
  lib/                   logger, image downscale
  integrations/          gemini, sarvam, cloudinary, weather
  modules/<name>/        <name>.service.ts (SQL+logic) + <name>.routes.ts
  app.ts routes.ts index.ts
migrations/              node-pg-migrate SQL
seeds/                   pesticide_reference.csv
```
