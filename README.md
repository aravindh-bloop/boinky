# 🌱 AgriPod — Smart Crop-Health & Farm Management

A two-sided system for **early detection and management of crop diseases & pest infestations**,
built for Smart India Hackathon (Govt. of Maharashtra). It has since grown into a full
**smart farm-management system**.

- **Farmer app** (React Native / Expo) — AI disease & pest diagnosis from a photo, local-language
  advisory with pesticide-safety checks, weather forecasting with agro-advice, a rule-based crop
  calendar, activity / expense / harvest tracking, government-scheme finder, and inventory.
- **Officials' dashboard** (React web) — *planned* — live hotspot map, diagnosis validation queue,
  regional alerts, trend charts.
- **Backend** (Node + Express + TypeScript) — one API over a shared Neon Postgres + PostGIS DB.

> Nothing in this project is mocked or hardcoded. Every AI call, weather lookup and image upload
> hits the real service. See `docs/ARCHITECTURE.md` and `PROGRESS.md` for the full picture.

---

## Architecture

```
┌─────────────┐        ┌────────────────────────┐        ┌──────────────────┐
│ Farmer app  │  HTTP  │  Backend (Express/TS)   │        │ Neon Postgres    │
│ (Expo RN)   │ ─────▶ │  /api/*                 │ ─────▶ │  + PostGIS       │
└─────────────┘        │                         │        └──────────────────┘
                       │  Gemini   (vision)      │
                       │  Sarvam   (advisory)    │
                       │  Cloudinary (images)    │
                       │  Open-Meteo (weather)   │
                       └────────────────────────┘
```

| Layer | Tech |
|---|---|
| Backend | Node 20+, Express 4, TypeScript (strict), `pg` + `node-pg-migrate` (raw SQL) |
| DB | Neon (managed Postgres, `ap-southeast-1`) + PostGIS + pgcrypto |
| Vision AI | Google Gemini (`gemini-3.1-flash-lite`) |
| Language AI | Sarvam AI (`sarvam-105b-conversations`) — Indian-language advisories |
| Images | Cloudinary |
| Weather | Open-Meteo (no key) |
| Farmer app | Expo SDK 57 / React Native 0.86, Reanimated 4, Skia, Phosphor icons |

---

## Prerequisites

- **Node.js 20+** and npm
- A **JDK 17** + **Android SDK** (for building the app) — Android Studio installs both.
  Set `ANDROID_HOME`. An Android device with USB debugging, or an emulator.
- Free accounts / API keys (all have a genuine free tier — no billing account required):

  | Service | Get the key at | Used for |
  |---|---|---|
  | **Neon Postgres** | https://console.neon.tech (create a project, region `ap-southeast-1` Singapore) | database |
  | **Google Gemini** | https://aistudio.google.com/apikey | photo → diagnosis |
  | **Sarvam AI** | https://dashboard.sarvam.ai | multilingual advisory |
  | **Cloudinary** | https://console.cloudinary.com (cloud name + API key + secret) | scan image storage |
  | Open-Meteo | — | weather (no key needed) |

---

## 1. Backend

```bash
cd backend
npm install

cp .env.example .env
#  → fill in DATABASE_URL, GEMINI_API_KEY, SARVAM_API_KEY, CLOUDINARY_*
#  → set JWT_SECRET to any long random string

npm run db:reset      # migrate + seed reference data + create a demo farmer/official
npm run dev           # http://localhost:4000   (health check: GET /health)
```

`npm run db:reset` runs migrations, seeds ~60 pesticide-PHI rows + ~20 government schemes,
and creates:

- farmer  — phone `9990001111` / password `secret123` (+ 3 demo fields with locations)
- official — email `officer@agri.gov.in` / password `secret123`

Other scripts: `npm run migrate:up`, `npm run seed`, `npm run seed:dev`, `npm run typecheck`,
`npm run build && npm start` (production).

The full API surface is documented in **`backend/README.md`**.

---

## 2. Farmer app

Expo **dev client** (it uses native modules — Skia, image-picker — so Expo Go won't work; you
build the dev client once, then iterate over the JS bundle).

```bash
cd farmer-expo
npm install

# generate the native android/ project from app.json + package.json
npx expo prebuild --platform android

# build & install the dev-client APK on a connected device (first build ~8 min)
#   Windows / Git Bash: run the gradle command from PowerShell if `expo run` chokes on gradlew.bat
npx expo run:android
#   …or manually:
#   cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Every session after that

```bash
# terminal 1 — backend
cd backend && npm run dev

# terminal 2 — Metro bundler + the app
cd farmer-expo
adb reverse tcp:4000 tcp:4000     # phone reaches the backend over USB
adb reverse tcp:8081 tcp:8081     # phone reaches Metro
npx expo start --dev-client
#   press `a`, or open the AgriPod app on the phone
```

`npx expo start` shows live JS logs and interactive keys (`r` reload, `j` debugger).

### Config

`farmer-expo/src/config.ts` → `API_BASE_URL` defaults to `http://localhost:4000` (works via
`adb reverse`). For a device on the same Wi-Fi instead of USB, set it to your machine's LAN IP.

### Faster / for a demo — release build

```bash
cd farmer-expo/android
./gradlew assembleRelease           # signed with the debug key via Expo prebuild config
adb install -r app/build/outputs/apk/release/app-release.apk
```

A release APK bundles the JS (no Metro needed) and runs ~2× faster than the dev build, but
does not hot-reload.

---

## Project structure

```
backend/            Express + TypeScript API
  migrations/        node-pg-migrate SQL migrations
  seeds/             pesticide_reference.csv
  src/
    config/env.ts    zod-validated environment
    db/              pg pool, query helpers, seeds
    http/            error handling, auth middleware, validation, uploads
    integrations/    gemini · sarvam · cloudinary · weather (Open-Meteo)
    modules/<name>/  <name>.service.ts (SQL + logic) + <name>.routes.ts
  README.md          full endpoint reference

farmer-expo/        Expo / React Native farmer app
  src/
    api/             fetch client, stale-while-revalidate cache, typed models
    auth/            JWT auth context
    ui/              design system (tokens, motion, Icon, Card, Button, RiskGauge (Skia)…)
    screens/         Home dashboard, Weather, Fields, Scan, Schemes, Stock, Tasks, …
    navigation.tsx   5-tab bottom nav with a centre Scan button

docs/               solution & presentation briefs, ARCHITECTURE.md (decisions log)
PROGRESS.md         running build log / status
```

---

## Status

- ✅ Backend — all modules built & tested against live services
- ✅ Farmer app — running on device; premium UI pass done
- ⬜ Officials' web dashboard — next
- ⬜ Deploy backend (Render / Railway free tier) for a multi-device demo

See `PROGRESS.md` for detail.
