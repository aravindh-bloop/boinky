/*
 * AgriPod serial bridge — USB phase.
 *
 * Reads the `AGRIPOD,soil=..,ph=..,temp=..` line the ESP32 prints over USB and
 * forwards each reading to the backend. Run it on the laptop the pod is plugged
 * into. When the pod later gets its own WiFi (USE_WIFI 1 in the sketch), this is
 * no longer needed.
 *
 *   cd hardware
 *   npm install
 *   node pod-bridge.mjs COM5
 *     (Windows: "COM5" — check Arduino IDE → Tools → Port)
 *     (macOS/Linux: "/dev/tty.usbserial-XXXX" or "/dev/ttyUSB0")
 *
 * Optional args:  node pod-bridge.mjs <port> <podKey> <apiBase>
 */

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const PORT = process.argv[2];
const POD_KEY = process.argv[3] || 'pod_demo_a1b2c3d4e5f60718293a4b5c';
const API_BASE = process.argv[4] || 'https://agripod-backend.onrender.com';
const MIN_INTERVAL_MS = 5000; // don't POST more often than this

if (!PORT) {
  console.error('usage: node pod-bridge.mjs <serial-port> [podKey] [apiBase]');
  const list = await SerialPort.list();
  if (list.length) {
    console.error('\nports seen on this machine:');
    for (const p of list) console.error(`  ${p.path}${p.manufacturer ? '  (' + p.manufacturer + ')' : ''}`);
  }
  process.exit(1);
}

const url = `${API_BASE}/api/pod/readings`;
let lastSent = 0;

function parseLine(line) {
  const m = line.trim().match(/^AGRIPOD,(.+)$/);
  if (!m) return null;
  const out = {};
  for (const pair of m[1].split(',')) {
    const [k, v] = pair.split('=');
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

async function send(fields) {
  const body = {};
  if (fields.soil != null) body.soilMoisture = fields.soil;
  if (fields.ph != null) body.ph = fields.ph;
  if (fields.temp != null && fields.temp > -100) body.temperature = fields.temp;
  if (Object.keys(body).length === 0) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pod-key': POD_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const txt = await res.text();
    const t = new Date().toLocaleTimeString();
    if (res.ok) console.log(`${t}  sent  ${JSON.stringify(body)}  -> ${res.status}`);
    else console.error(`${t}  FAIL  ${res.status}  ${txt.slice(0, 200)}`);
  } catch (e) {
    console.error(`${new Date().toLocaleTimeString()}  ERROR  ${e.message}`);
  }
}

const port = new SerialPort({ path: PORT, baudRate: 115200 }, (err) => {
  if (err) {
    console.error(`could not open ${PORT}: ${err.message}`);
    process.exit(1);
  }
  console.log(`bridge: reading ${PORT} @ 115200 -> ${url}`);
  console.log(`bridge: pod key ${POD_KEY.slice(0, 12)}…  (Ctrl+C to stop)\n`);
});

port.pipe(new ReadlineParser({ delimiter: '\n' })).on('data', (line) => {
  const fields = parseLine(line);
  if (!fields) return;
  const now = Date.now();
  if (now - lastSent < MIN_INTERVAL_MS) return;
  lastSent = now;
  void send(fields);
});

port.on('close', () => {
  console.error('serial port closed — is the pod unplugged? exiting.');
  process.exit(1);
});
