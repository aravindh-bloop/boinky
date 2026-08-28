# AgriPod — Architecture & Decisions Log

Companion to `AgriPod_Solution_Document.docx` (the authoritative design). This file
records **concrete implementation decisions** made during the build — the "why" behind
the code, so anyone (or Claude, post-context-loss) can resume coherently.

---

## Stack (as built)

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 24, ESM, TypeScript 5 (strict, `noUncheckedIndexedAccess`) | `tsx` for dev watch, `tsc` for build |
| HTTP | Express 4 | Express 5 deferred — 4 has the stable middleware ecosystem |
| DB | Neon Postgres + PostGIS + pgcrypto | pooled connection string |
| DB access | `pg` + hand-written SQL, `node-pg-migrate` v9 (SQL migrations) | No ORM — PostGIS `GEOGRAPHY` + `ST_DWithin` are first-class in raw SQL, awkward in ORMs |
| Validation | zod at the HTTP boundary (`validate({body,query,params})`) | Parsed values replace raw request parts |
| Auth | JWT bearer (`jsonwebtoken`), bcryptjs hashing (10 rounds) | Lightweight by design — no OTP / refresh tokens / rate limiting |
| Logging | pino (pretty in dev), secret redaction | |
| Image storage | Cloudinary (unsigned not used — server-side signed upload) | |
| Vision AI | Gemini (`@google/genai` v2), model `gemini-2.0-flash` | structured JSON output |
| Language AI | Sarvam AI REST | language detect + advisory generation/translation |
| Weather | Open-Meteo REST (no key) | |
| Maps | Leaflet + OSM (dashboard) | never Google Maps (billing account requirement) |

---

## Conventions

- **Module layout:** `src/modules/<name>/<name>.service.ts` (logic + SQL) and
  `<name>.routes.ts` (Express router + zod schemas). Cross-cutting helpers in `src/http`,
  `src/db`, `src/lib`, `src/config`. External APIs wrapped in `src/integrations/<svc>.ts`.
- **Routes** mounted under `/api` in `src/routes.ts`. Each router owns its own path prefix.
- **Errors:** throw `AppError.badRequest(...)` etc.; never `res.status().json()` an error
  by hand inside services. The global handler formats `{ error: { code, message, details } }`.
- **Ownership:** every farmer-scoped query filters by `farmer_id = $currentUser`. Officials
  are scoped by `region` where relevant.
- **Geography:** store as `GEOGRAPHY(POINT, 4326)`. Write with
  `ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography`. Read as GeoJSON with
  `ST_AsGeoJSON(location)` or as `ST_Y(location::geometry) AS lat, ST_X(...) AS lng`.
- **NUMERIC** columns are parsed to JS `number` globally (see `db/pool.ts`).
- **Money / counts:** BIGINT parsed to number too.

---

## Scan pipeline (module 3) — planned flow

`POST /api/scans` (multipart: `image` + fields `fieldId?`, `lat?`, `lng?`)

1. `multer` memory storage receives the image (≤ ~8MB, jp/png/webp).
2. Upload buffer to Cloudinary (`folder: agripod/scans`) → `image_url`, `image_public_id`.
3. Call Gemini with the image + crop context (crop/variety/growth-stage from the field) →
   **structured JSON**: `{ label, category, affected_part, severity, confidence,
   summary, recommended_actions[], recommended_inputs[] }`.
4. Determine language: field owner's `preferred_language`. Call Sarvam to produce
   `advisory_text` in that language from the Gemini findings (+ safe-usage note).
5. Compute `risk_score` from the latest `risk_snapshots` row for the field (if any) +
   severity. (Full weather pipeline is module 4; module 3 uses whatever snapshot exists.)
6. Insert `scans` row. Status logic:
   - `confidence >= CONFIDENCE_ESCALATION_THRESHOLD (0.65)` → `auto_confirmed`
   - else → `needs_validation` (appears in officials' queue)
   - Gemini `category = 'healthy'` with high confidence → `auto_confirmed`
7. Respond with the full scan record (farmer-friendly shape).

Failure handling: if Cloudinary/Gemini/Sarvam fails, the whole request fails with a
`502 upstream_error` (no silent fallback — per working agreement). Partial success is
not persisted.

---

## Risk model (module 4) — AS BUILT

`risk_snapshots`: one row per field per day (`UNIQUE(field_id, date)`, upserted).
`GET /api/risk/:fieldId` computes + caches today's snapshot and returns a live 3-day
outlook (outlook days are computed, not stored). `?refresh=true` forces recompute.

Weather (`src/integrations/weather.ts`): Open-Meteo `/forecast`, hourly
temp+RH+precip aggregated to per-day: mean/min/max temp, mean/max RH,
`highHumidityHours` (hours RH≥90 — leaf-wetness proxy), rainfall sum. `past_days=3`,
`forecast_days=3`.

Score 0–100 (`src/modules/risk/risk.model.ts`), fully transparent:
- **Fungal pressure (0–45):** RH bands + leaf-wetness hours + temperate band (12–26°C) + rain.
- **Pest pressure (0–25):** warm (24–34°C) + moderate recent rain + mid-range RH.
- **Growth-stage multiplier (0.6–1.25):** from `crop-profiles.ts` peak-vulnerability window
  vs `days_since_sown`. Past `durationDays` → 0.6.
- **History term (0–25, added after multiplier):** count of confirmed high-severity scans
  within 10km in last 21 days (PostGIS `ST_DWithin`).
- `level`: low <34, medium 34–66, high ≥67. `reason` = human string naming the crop's
  main threat + top 3 contributing factors.

`crop-profiles.ts` covers 13 Maharashtra crops (cotton, soybean, tur, wheat, rice,
sugarcane, onion, tomato, potato, chilli, grape, maize + generic fallback).

Not ML — a documented heuristic. Honest for the pitch.

---

## Verified external-API facts (tested 2026-08-27)

### Gemini (`@google/genai` v2)
- API key **valid**. Key format `AQ.Ab8...` is the current Google AI Studio format (not `AIza`).
- **Model: `gemini-3.6-flash`** — all 2.x models are deprecated / 404 for new users.
  `gemini-flash-latest` also works as an evergreen alias. Pinned to `gemini-3.6-flash`.
- Vision + structured JSON output via `responseMimeType: 'application/json'` + `responseSchema`.

### Sarvam AI (REST, base `https://api.sarvam.ai`)
- Auth header: **`api-subscription-key: <key>`** (not Bearer).
- Language ID: `POST /text-lid` body `{ input }` → `{ language_code: "mr-IN", script_code }`.
- Translate: `POST /translate` body `{ input, source_language_code, target_language_code }`
  (codes like `en-IN`, `mr-IN`) → `{ translated_text }`.
- Chat: `POST /v1/chat/completions`, OpenAI-compatible. **Use model
  `sarvam-105b-conversations`** — the base `sarvam-105b` is a reasoning model that spends
  its entire completion budget on hidden reasoning and returns empty `content`
  (`finish_reason: "length"`) for advisory-sized prompts. The `-conversations` variant
  does not reason and returns clean output in ~8s with `max_tokens: 800`.
- `reasoning_effort` only accepts `low|medium|high` (no "none").
- **Advisory approach:** Gemini returns findings in English → Sarvam `/v1/chat/completions`
  with `sarvam-105b-conversations` + system prompt "respond only in <language>,
  farmer-friendly, keep chemical names in English, mention PHI + PPE" generates the
  advisory directly in the target language. Verified: Marathi + English outputs are
  correct, structured, literacy-appropriate. (Not `/translate` — we want rephrasing.)

### Latency — RESOLVED
- `gemini-3.6-flash` was **12–136s**, wildly variable (cold-start/queue on free tier).
- **Switched to `gemini-3.1-flash-lite`** (`GEMINI_MODEL` in `.env`): consistent **~3–6s**,
  and it still nails the diagnosis (potato late blight, full structured output, quality
  advisory downstream). `gemini-flash-lite-latest` is even faster (~1.5s) but an evergreen
  alias — pinned the dated one for reproducibility. Re-run `scripts/bench-gemini.ts` if
  revisiting.
- Also added `src/lib/image.ts::downscaleForVision` — `sharp` re-encode to ≤1024px JPEG
  before sending to Gemini (smaller payload, EXIF-rotation-safe).
- End-to-end `POST /scans` now ~15s (sharp <1s + Cloudinary ~2s + Gemini ~5s + Sarvam ~9s).
  Farmer app shows a "diagnosing…" state; keep client timeout ≥ 60s.
- Sarvam advisory: ~7–9s. Future optimisation: return scan row after Gemini, generate
  advisory async. Not needed yet.

## Pesticide PHI (module 7) — AS BUILT

`pesticide_reference` seeded from `backend/seeds/pesticide_reference.csv` (60 rows,
`source='curated'`, `npm run seed`). Values are indicative CIB&RC-style label norms
compiled by hand — NOT scraped from the official register. A `source` column
(`curated | ai_estimate | official`) tracks provenance on every row and every API result
carries a "confirm on the label" disclaimer.

`lookupPHI(rawName, crop)`:
1. `normalizePesticide` strips formulation codes (`75% WP`, `EC`…), parentheticals, and
   splits mixtures on `+` into active ingredients.
2. SQL lookup scored by how many ingredients match `pesticide_name`/`active_ingredient`;
   crop-specific row preferred over generic; among ties the higher (safer) PHI wins.
3. On a miss → `gemini.estimatePHI` → row inserted with `source='ai_estimate'` (self-populating).

`checkScanSafety(scanId, harvestDate?)` reads the scan's `raw_model_response.recommendedInputs`,
resolves crop + expected harvest date (field `sown_date` + `cropProfile.durationDays`, or an
explicit `?harvestDate=`), and per input returns `safe | caution | unsafe | unknown` with a
plain-language note. `overall` = worst item.

## Open questions / to confirm with user

- **Cloudinary:** still need `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` (have secret only).
- Crop calendar: rule-based templates for which crops? (cotton, soybean, wheat, rice,
  sugarcane are the Maharashtra priorities.) Need task templates — ask user or derive
  from an agri source.
