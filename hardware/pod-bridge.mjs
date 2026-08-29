/*
 * AgriPod serial bridge — USB phase.
 *
 * Reads your friend's EXISTING Serial Monitor output (no Arduino changes needed)
 * and forwards each reading to the backend. Run it on the laptop the pod is
 * plugged into. When the pod later gets its own WiFi (USE_WIFI 1 in the sketch),
 * this is no longer needed.
 *
 *   cd hardware
 *   npm install
 *   node pod-bridge.mjs COM5
 *     Windows:      "COM5"  (Arduino IDE -> Tools -> Port)
 *     macOS/Linux:  "/dev/tty.usbserial-XXXX"  or  "/dev/ttyUSB0"
 *
 * Optional args:  node pod-bridge.mjs <port> <podKey> <apiBase>
 *
 * IMPORTANT: close the Arduino IDE Serial Monitor before running this — only one
 * program can hold the serial port at a time.
 */

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const PORT = process.argv[2];
const POD_KEY = process.argv[3] || 'pod_demo_a1b2c3d4e5f60718293a4b5c';
const API_BASE = process.argv[4] || 'https://agripod-backend.onrender.com';
const MIN_INTERVAL_MS = 5000;

if (!PORT) {
  console.error('usage: node pod-bridge.mjs <serial-port> [podKey] [apiBase]');
  try {
    const list = await SerialPort.list();
    if (list.length) {
      console.error('\nports on this machine:');
      for (const p of list)
        console.error(`  ${p.path}${p.manufacturer ? '  (' + p.manufacturer + ')' : ''}`);
    }
  } catch {}
  process.exit(1);
}

const url = `${API_BASE}/api/pod/readings`;
let lastSent = 0;
let acc = {}; // readings collected from the current print cycle

// Matches the lines your friend's sketch already prints:
//   Moisture       : 0%
//   pH             : 13.32
//   Temperature    : 31.31 °C   (or  "Temperature    : SENSOR ERROR")
// Also matches the optional one-liner  AGRIPOD,soil=..,ph=..,temp=..
function ingest(line) {
  const s = line.trim();

  const one = s.match(/^AGRIPOD,(.+)$/);
  if (one) {
    for (const pair of one[1].split(',')) {
      const [k, v] = pair.split('=');
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) {
        if (k === 'soil') acc.soilMoisture = n;
        if (k === 'ph') acc.ph = n;
        if (k === 'temp' && n > -100) acc.temperature = n;
      }
    }
    flush();
    return;
  }

  let m;
  if ((m = s.match(/^Moisture\s*:\s*(-?\d+(?:\.\d+)?)\s*%/i))) acc.soilMoisture = +m[1];
  else if ((m = s.match(/^pH\s*:\s*(-?\d+(?:\.\d+)?)\s*$/i))) acc.ph = +m[1];
  else if ((m = s.match(/^Temp(?:erature)?\s*:\s*(-?\d+(?:\.\d+)?)/i))) {
    acc.temperature = +m[1];
    flush(); // Temperature is the last line of a cycle
  } else if (/^Temp(?:erature)?\s*:\s*SENSOR ERROR/i.test(s)) {
    flush();
  }
}

async function flush() {
  const now = Date.now();
  if (now - lastSent < MIN_INTERVAL_MS) {
    acc = {};
    return;
  }
  const body = {};
  if (acc.soilMoisture != null) body.soilMoisture = clamp(acc.soilMoisture, 0, 100);
  if (acc.ph != null) body.ph = clamp(acc.ph, 0, 14);
  if (acc.temperature != null && acc.temperature > -100)
    body.temperature = clamp(acc.temperature, -40, 90);
  acc = {};
  if (Object.keys(body).length === 0) return;
  lastSent = now;

  const t = new Date().toLocaleTimeString();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pod-key': POD_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) console.log(`${t}  sent  ${JSON.stringify(body)}  -> ${res.status}`);
    else console.error(`${t}  FAIL  ${res.status}  ${(await res.text()).slice(0, 200)}`);
  } catch (e) {
    console.error(`${t}  ERROR ${e.message}`);
  }
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const port = new SerialPort({ path: PORT, baudRate: 115200 }, (err) => {
  if (err) {
    console.error(`could not open ${PORT}: ${err.message}`);
    console.error('(is the Arduino Serial Monitor still open? close it and retry)');
    process.exit(1);
  }
  console.log(`bridge: ${PORT} @ 115200  ->  ${url}`);
  console.log(`bridge: pod key ${POD_KEY.slice(0, 12)}…   Ctrl+C to stop\n`);
});

port.pipe(new ReadlineParser({ delimiter: '\n' })).on('data', ingest);
port.on('close', () => {
  console.error('serial port closed — pod unplugged? exiting.');
  process.exit(1);
});
