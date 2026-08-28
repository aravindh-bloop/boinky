# Running the AgriPod farmer app

Standard Expo app (SDK 57 / RN 0.86.3). Runs in **Expo Go** — no native build, no APK.

## Every session

```
cd D:\E-Farmer\farmer-expo
npx expo start
```

Then on the phone: open **Expo Go** and scan the QR code from the terminal.

The app talks to the **deployed backend** (`https://agripod-backend.onrender.com`) by
default, so the phone just needs internet — no cable, no `adb reverse`, no local backend.

`npx expo start` interactive keys: `r` reload · `j` open debugger · `m` toggle dev menu.
App `console.log` / warnings / errors stream into this terminal.

If the bundler gets into a weird state: `npx expo start --clear`.

## Running against a local backend instead

```
cd D:\E-Farmer\backend && npm run dev          # terminal 1
```
```
cd D:\E-Farmer\farmer-expo
adb reverse tcp:4000 tcp:4000                   # phone on USB
set EXPO_PUBLIC_API_URL=http://localhost:4000
npx expo start
```

## Config

- Backend URL: `src/config.ts` → `API_BASE_URL`. Defaults to the Render URL; override with
  the `EXPO_PUBLIC_API_URL` env var.
