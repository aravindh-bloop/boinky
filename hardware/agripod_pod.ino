/*
 * AgriPod field sensor — ESP32
 * Soil moisture (GPIO34) + pH (GPIO35, divider) + DS18B20 temp (GPIO4) + SSD1306 OLED.
 *
 * Two ways to get the readings to the backend — same data, pick one:
 *
 *   USE_WIFI 0  (default, USB phase)
 *       The pod stays plugged into a laptop. It prints one machine line each
 *       cycle:   AGRIPOD,soil=44,ph=6.71,temp=31.25
 *       and `hardware/pod-bridge.mjs` on that laptop forwards it to the backend.
 *       Nothing else to change — just flash and run the bridge.
 *
 *   USE_WIFI 1  (standalone product, no laptop)
 *       Set WIFI_SSID / WIFI_PASS / POD_KEY below. The pod connects to WiFi and
 *       POSTs directly to the backend. The bridge is not needed.
 *
 * Libraries: Adafruit_GFX, Adafruit_SSD1306, OneWire, DallasTemperature,
 *            and (for USE_WIFI 1 only) ArduinoJson.
 */

#define USE_WIFI 0

// ── backend / WiFi (only used when USE_WIFI 1) ───────────────────────
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* API_URL   = "https://agripod-backend.onrender.com/api/pod/readings";
const char* POD_KEY   = "pod_demo_a1b2c3d4e5f60718293a4b5c";   // from `npm run seed:demo`

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#if USE_WIFI
  #include <WiFi.h>
  #include <WiFiClientSecure.h>
  #include <HTTPClient.h>
  #include <ArduinoJson.h>
#endif

// ── pins ────────────────────────────────────────────────────────────
#define SOIL_PIN     34
#define PH_PIN       35
#define DS18B20_PIN  4
#define OLED_SDA     21
#define OLED_SCL     22

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

OneWire oneWire(DS18B20_PIN);
DallasTemperature temperatureSensor(&oneWire);

// ── calibration ─────────────────────────────────────────────────────
const int SOIL_DRY = 3000;
const int SOIL_WET = 1200;

const float PH_REFERENCE_VOLTAGE = 1.40;   // probe voltage in the pH-7 reference
const float PH_REFERENCE         = 7.00;
const float PH_SLOPE             = 0.18;

const unsigned long INTERVAL_MS = 5000;    // send every 5 s

// ────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);

  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED NOT FOUND!");
    while (1);
  }

  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);
  analogSetPinAttenuation(PH_PIN, ADC_11db);
  temperatureSensor.begin();

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);   display.println("AGRIPOD");
  display.setCursor(0, 18);  display.println("SOIL + PH + TEMP");
  display.setCursor(0, 36);  display.println("Initializing...");
  display.display();
  delay(2000);

#if USE_WIFI
  connectWiFi();
#endif

  Serial.println("\n================ AGRIPOD MONITOR ================");
}

void loop() {
  // ── soil moisture ──
  int soilADC = analogRead(SOIL_PIN);
  int moisture = constrain(map(soilADC, SOIL_DRY, SOIL_WET, 0, 100), 0, 100);
  String soilStatus = moisture < 30 ? "DRY" : moisture < 60 ? "MEDIUM" : "MOIST";

  // ── pH ──
  int phADC = analogRead(PH_PIN);
  float adcVoltage = (phADC / 4095.0) * 3.3;
  float poVoltage  = adcVoltage * (25.0 / 15.0);        // PO -10k- GPIO35 -15k- GND
  float pH = PH_REFERENCE + ((PH_REFERENCE_VOLTAGE - poVoltage) / PH_SLOPE);
  pH = constrain(pH, 0.0, 14.0);
  String phStatus = pH < 5.5 ? "ACIDIC" : pH <= 7.5 ? "NORMAL" : "ALKALINE";

  // ── temperature ──
  temperatureSensor.requestTemperatures();
  float temperature = temperatureSensor.getTempCByIndex(0);
  bool temperatureOK = (temperature != DEVICE_DISCONNECTED_C);

  // ── serial (human) ──
  Serial.println("--------------------------------");
  Serial.printf("Soil ADC   : %d\n", soilADC);
  Serial.printf("Moisture   : %d%%  (%s)\n", moisture, soilStatus.c_str());
  Serial.printf("pH ADC     : %d   PO V: %.3f\n", phADC, poVoltage);
  Serial.printf("pH         : %.2f  (%s)\n", pH, phStatus.c_str());
  if (temperatureOK) Serial.printf("Temperature: %.2f C\n", temperature);
  else               Serial.println("Temperature: SENSOR ERROR");

  // ── serial (machine — the bridge reads this one line) ──
  Serial.printf("AGRIPOD,soil=%d,ph=%.2f,temp=%.2f\n",
                moisture, pH, temperatureOK ? temperature : -127.0);

  // ── OLED ──
  display.clearDisplay();
  display.setCursor(0, 0);  display.println("AGRIPOD");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
  display.setCursor(0, 16); display.printf("Moisture: %d%%", moisture);
  display.setCursor(0, 27); display.printf("Status: %s", soilStatus.c_str());
  display.setCursor(0, 38); display.printf("pH: %.2f", pH);
  display.setCursor(0, 50);
  if (temperatureOK) display.printf("Temp: %.1f C", temperature);
  else               display.print("Temp: ERROR");
  display.display();

#if USE_WIFI
  postReading(moisture, pH, temperatureOK ? temperature : NAN);
#endif

  delay(INTERVAL_MS);
}

// ────────────────────────────────────────────────────────────────────
#if USE_WIFI

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("WiFi: connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " ok" : " FAILED");
}

void postReading(int moisture, float pH, float temp) {
  if (WiFi.status() != WL_CONNECTED) { connectWiFi(); return; }

  JsonDocument doc;
  doc["soilMoisture"] = moisture;
  doc["ph"]           = round(pH * 100) / 100.0;
  if (!isnan(temp)) doc["temperature"] = round(temp * 100) / 100.0;

  String body;
  serializeJson(doc, body);

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Pod-Key", POD_KEY);
  http.setTimeout(15000);
  int code = http.POST(body);
  Serial.printf("POST -> %d\n", code);
  http.end();
}

#endif
