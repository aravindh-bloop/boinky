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

Standard Expo app (SDK 57) — runs in **Expo Go**, no native build.

```bash
cd farmer-expo
npm install
npx expo start
```

Open **Expo Go** on the phone and scan the QR code.

The app points at the deployed backend (`https://agripod-backend.onrender.com`) by default,
so the phone only needs internet.

### Config

`farmer-expo/src/config.ts` → `API_BASE_URL` defaults to the Render URL. To run against a
local backend, set `EXPO_PUBLIC_API_URL=http://localhost:4000` before `npx expo start`
(with `adb reverse tcp:4000 tcp:4000` if the phone is on USB).

`npx expo start` shows live JS logs and interactive keys (`r` reload, `j` debugger). If the
bundler misbehaves: `npx expo start --clear`.

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
