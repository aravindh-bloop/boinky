# Running the AgriPod farmer app

Expo dev-client build (SDK 57 / RN 0.86.3). The dev-client APK is already built and
installed on the phone (`com.agripod.farmer`). You only rebuild the APK when native
deps change — day to day you just start the dev server.

## Every session

**Terminal 1 — backend**
```
cd D:\E-Farmer\backend
npm run dev
```

**Terminal 2 — the app** (this is the one with live logs + interactive keys)
```
cd D:\E-Farmer\farmer-expo
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client
```

Then either:
- press **`a`** to open the app on the connected Android device, or
- open the **AgriPod** app on the phone manually (it reconnects to the dev server)

`npx expo start` interactive keys: `r` reload · `j` open debugger · `m` toggle dev menu ·
`a` open on Android. **App `console.log` / warnings / errors stream into this terminal.**

> The phone reaches the backend through `adb reverse` over the USB cable. Keep the cable
> connected. If requests start failing with "Cannot reach the server", re-run the two
> `adb reverse` commands (they drop when the phone reconnects).

## Rebuild the dev-client APK (only after adding a native module)

```
cd D:\E-Farmer\farmer-expo\android
.\gradlew.bat app:assembleDebug -PreactNativeArchitectures=arm64-v8a
adb install -r app\build\outputs\apk\debug\app-debug.apk
```
(`npx expo run:android` also works but can choke on `gradlew.bat` under Git Bash — use
PowerShell for the gradle command.)

## Config

- Backend URL: `src/config.ts` → `API_BASE_URL` (currently `http://localhost:4000` via adb reverse).
  For WiFi instead of USB, set it to your PC's LAN IP and make sure the phone is on the same network.
