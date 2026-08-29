# AgriPod hardware pod → backend → app

An ESP32 with soil-moisture, temperature and pH sensors posts readings to the
AgriPod backend over WiFi. The app shows them live on the field's detail screen.

```
ESP32 + sensors ──HTTPS POST──> agripod-backend.onrender.com/api/pod/readings
                                          │
                                   pod_readings (Neon)
                                          │
                          app  GET /api/pod/latest?fieldId=…
```

Nothing is simulated: the endpoint only accepts a reading if the `X-Pod-Key`
matches a real `pod_devices` row, and that row is bound to one farmer + one field.

---

## Phase 1 — pod on USB (no Arduino changes)

The pod's sketch already prints the readings to the Serial Monitor. A small
script on the same laptop reads that output and forwards it to the backend.

Run it **on the laptop the pod is plugged into** (a script can only read a USB
port on its own machine).

1. **Close the Arduino IDE Serial Monitor** — only one program can hold the port.
2. Note the port — Arduino IDE → **Tools → Port** (Windows `COM5`, Mac/Linux
   `/dev/tty.usbserial-XXXX`).
3. Copy the `hardware/` folder to that laptop (git clone, or a pen drive — it's
   just `pod_bridge.py`).
4. Run it:
   ```bash
   pip install pyserial
   python pod_bridge.py COM5
   ```
   (run with no arguments once to list the ports it can see)
5. You'll see, every ~5 s:
   ```
   14:22:07  sent  {"soilMoisture":42,"ph":6.71,"temperature":31.3}  -> 201
   ```
   Leave it running.
6. App → **Home** or **Fields → North Plot** → the **AgriPod** card shows the
   live values and "Pod is in good condition".

The pod's firmware is untouched. (There's also a Node version, `pod-bridge.mjs`,
if you prefer — `npm install && node pod-bridge.mjs COM5`.)

## Phase 2 — standalone product (no laptop)

Flash `agripod_pod.ino` (your sketch + a WiFi block). Set `#define USE_WIFI 1`
and fill in `WIFI_SSID` / `WIFI_PASS` / `POD_KEY`. The pod then POSTs to the
backend itself. Same app card, no bridge.

---

## Reference

### Get the pod key (already done for the demo)

The demo field **North Plot** already has a pod paired. Its key is:

```
pod_demo_a1b2c3d4e5f60718293a4b5c
```

(`npm run seed:demo` prints it. To pair a *new* pod to any field, from the app:
Field → **Field pod → Connect**, or `POST /api/pod/devices { fieldId, label }` with
a farmer token — the response has a fresh `key`, shown once.)

### 2. Open the sketch

Open `hardware/agripod_pod.ino` in the Arduino IDE (the friend's laptop, where the
pod is already wired up).

Install these libraries via **Tools → Manage Libraries**:
- **ArduinoJson** (Benoit Blanchon)
- **DHT sensor library** + **Adafruit Unified Sensor** — only if temperature is a DHT22

### 3. Edit three things at the top of the sketch

| line | set to |
|---|---|
| `WIFI_SSID` / `WIFI_PASS` | the network the pod will join. **A phone hotspot is fine** and avoids venue-WiFi problems. |
| `POD_KEY` | the key from step 1 |
| pin numbers + `readSensors()` | match your actual wiring. If your friend's sketch already reads the sensors, copy that logic into `readSensors()` and keep the `postReading()` part. |

Calibrate once if you can:
- **Soil sensor** — note the raw `analogRead` value in dry air and in a glass of
  water, put them in `SOIL_RAW_DRY` / `SOIL_RAW_WET`.
- **pH probe** — dip in pH 7 and pH 4 buffer, note the voltages, fill in `PH_V1/2`.
  Uncalibrated still works for a demo, the number is just approximate.

### 4. Flash

- **Tools → Board** → your ESP32 board (usually "ESP32 Dev Module")
- **Tools → Port** → the COM port the pod is on
- Click **Upload** (→)

### 5. Watch it connect

Open **Tools → Serial Monitor** at **115200 baud**. You should see:

```
WiFi: connecting to MyHotspot... ok
soil=44.2%  temp=31.1C  pH=6.71  hum=67.0%
POST https://agripod-backend.onrender.com/api/pod/readings -> 201 {...}
```

A `201` means the backend accepted it. `401` = wrong `POD_KEY`. No response =
WiFi or the backend is asleep (first request after 15 min idle takes ~40 s).

### 6. See it in the app

Open the app → **Fields → North Plot**. The **Field pod** card shows a green
"Live" dot and the current soil moisture / temperature / pH, with 24-hour
sparklines. It refreshes every 30 s.

---

## Quick test without the hardware

```bash
curl -X POST https://agripod-backend.onrender.com/api/pod/readings \
  -H "content-type: application/json" \
  -H "X-Pod-Key: pod_demo_a1b2c3d4e5f60718293a4b5c" \
  -d '{"temperature":31.4,"soilMoisture":43.8,"ph":6.7,"airHumidity":68,"battery":91}'
```

Then reload the North Plot screen — the new values appear.

---

## API reference

| method | path | auth | body / query |
|---|---|---|---|
| `POST` | `/api/pod/readings` | `X-Pod-Key` header | `{ temperature?, soilMoisture?, ph?, airHumidity?, battery? }` — all optional, sensible ranges enforced |
| `GET` | `/api/pod/latest?fieldId=` | farmer JWT | → `{ device, reading, history[] }` (history = last 24 h) |
| `GET` | `/api/pod/devices` | farmer JWT | → `{ devices[] }` with `online` flag |
| `POST` | `/api/pod/devices` | farmer JWT | `{ fieldId, label? }` → `{ deviceId, key }` (key shown once) |
| `DELETE` | `/api/pod/devices/:id` | farmer JWT | unpair |

A device is **online** if it reported within the last 12 minutes.
