/**
 * Backend base URL.
 *
 * Default: the deployed backend on Render (Singapore, next to the DB) — works from
 * any network, so a release APK just runs.
 *
 * For local development against `npm run dev`, set EXPO_PUBLIC_API_URL, e.g.
 *   EXPO_PUBLIC_API_URL=http://localhost:4000 npx expo start --dev-client
 * (with `adb reverse tcp:4000 tcp:4000`), or point it at your machine's LAN IP.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://agripod-backend.onrender.com';

export const APP_NAME = 'AgriPod';
