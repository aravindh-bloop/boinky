/**
 * Backend base URL.
 *
 * On a USB-connected Android device we run `adb reverse tcp:4000 tcp:4000`, so
 * localhost on the phone tunnels to the dev machine's backend.
 * For a real network / deployed backend, change this to the LAN IP or public URL.
 */
export const API_BASE_URL = 'http://localhost:4000';

export const APP_NAME = 'AgriPod';
