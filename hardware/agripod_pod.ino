/*
 * AgriPod field sensor — ESP32
 * Reads soil moisture, temperature and pH, then POSTs them to the AgriPod
 * backend over WiFi every READING_INTERVAL seconds.
 *
 * Libraries (Arduino IDE → Tools → Manage Libraries):
 *   - ArduinoJson            by Benoit Blanchon
 *   - DHT sensor library     by Adafruit   (only if you use a DHT22 for temp)
 *   - Adafruit Unified Sensor by Adafruit  (DHT dependency)
 *
 * Board: "ESP32 Dev Module" (or your exact board). Set the right COM port.
 *
 * ── WHAT YOU MUST EDIT ──────────────────────────────────────────────
 *   1. WIFI_SSID / WIFI_PASS   — the network the pod joins (a phone hotspot works)
 *   2. POD_KEY                  — the key printed by `npm run seed:demo`
 *   3. The pin numbers + the readSensors() body to match your wiring
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── 1. WiFi ──────────────────────────────────────────────────────────
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// ── 2. Backend ───────────────────────────────────────────────────────
const char* API_URL  = "https://agripod-backend.onrender.com/api/pod/readings";
const char* POD_KEY  = "pod_demo_a1b2c3d4e5f60718293a4b5c";  // <-- from seed:demo

const unsigned long READING_INTERVAL = 60UL * 1000UL;  // 60 s

// ── 3. Sensor pins (ADAPT to your board/wiring) ─────────────────────
const int   SOIL_PIN = 34;    // analog — capacitive soil-moisture AOUT
const int   PH_PIN   = 35;    // analog — pH module Po
const int   TEMP_PIN = 32;    // DHT22 data pin  (or a DS18B20 OneWire pin)

// Capacitive soil sensor: raw ADC value in DRY air vs fully WET.
// Measure yours once and put the numbers here.
const int   SOIL_RAW_DRY = 3200;
const int   SOIL_RAW_WET = 1400;

// pH probe calibration: (voltage, pH) at two buffer solutions.
const float PH_V1 = 2.50, PH_PH1 = 7.0;   // pH 7 buffer
const float PH_V2 = 3.05, PH_PH2 = 4.0;   // pH 4 buffer

#include <DHT.h>
DHT dht(TEMP_PIN, DHT22);

// ────────────────────────────────────────────────────────────────────

struct Reading {
  float temperature;
  float soilMoisture;
  float ph;
  float airHumidity;
  bool  hasTemp, hasMoist, hasPh, hasHum;
};

Reading readSensors() {
  Reading r{};

  // soil moisture: map raw ADC to 0–100 %
  int soilRaw = analogRead(SOIL_PIN);
  float m = 100.0f * (SOIL_RAW_DRY - soilRaw) / float(SOIL_RAW_DRY - SOIL_RAW_WET);
  r.soilMoisture = constrain(m, 0.0f, 100.0f);
  r.hasMoist = true;

  // pH: ADC → volts → pH via 2-point line
  float phV = analogRead(PH_PIN) * (3.3f / 4095.0f);
  float slope = (PH_PH2 - PH_PH1) / (PH_V2 - PH_V1);
  r.ph = PH_PH1 + slope * (phV - PH_V1);
  r.ph = constrain(r.ph, 0.0f, 14.0f);
  r.hasPh = true;

  // temperature + air humidity from DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) { r.temperature = t; r.hasTemp = true; }
  if (!isnan(h)) { r.airHumidity = h; r.hasHum = true; }

  return r;
}

// ────────────────────────────────────────────────────────────────────

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("WiFi: connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? " ok" : " FAILED");
}

void postReading(const Reading& r) {
  if (WiFi.status() != WL_CONNECTED) { connectWiFi(); return; }

  JsonDocument doc;
  if (r.hasTemp)  doc["temperature"]  = round(r.temperature * 10) / 10.0;
  if (r.hasMoist) doc["soilMoisture"] = round(r.soilMoisture * 10) / 10.0;
  if (r.hasPh)    doc["ph"]           = round(r.ph * 100) / 100.0;
  if (r.hasHum)   doc["airHumidity"]  = round(r.airHumidity * 10) / 10.0;

  String body;
  serializeJson(doc, body);

  WiFiClientSecure client;
  client.setInsecure();                 // skip cert check — fine for a demo pod
  HTTPClient http;
  http.begin(client, API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Pod-Key", POD_KEY);
  http.setTimeout(15000);

  int code = http.POST(body);
  Serial.printf("POST %s -> %d  %s\n", API_URL, code, body.c_str());
  if (code > 0) Serial.println(http.getString());
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(500);
  analogReadResolution(12);             // 0–4095
  dht.begin();
  connectWiFi();
}

void loop() {
  Reading r = readSensors();
  Serial.printf("soil=%.1f%%  temp=%.1fC  pH=%.2f  hum=%.1f%%\n",
                r.soilMoisture, r.temperature, r.ph, r.airHumidity);
  postReading(r);
  delay(READING_INTERVAL);
}
