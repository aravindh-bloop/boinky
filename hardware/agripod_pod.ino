/*
 * AgriPod field sensor — ESP32
 * Soil moisture (GPIO34) + pH (GPIO35, divider) + DS18B20 temp (GPIO4) + SSD1306 OLED.
 *
 * ── PHASE 1 (pod on USB): you do NOT need this file. ──
 *    Keep running the sketch that's already on the pod. On the laptop, close the
 *    Arduino Serial Monitor and run  `node hardware/pod-bridge.mjs COM5`  — the
 *    bridge reads the Serial Monitor output you already print and forwards it.
 *
 * ── PHASE 2 (standalone product, no laptop): flash this file. ──
 *    Set  #define USE_WIFI 1  and fill in WIFI_SSID / WIFI_PASS / POD_KEY below.
 *    The pod then POSTs straight to the backend over WiFi. Needs the ArduinoJson
 *    library. All the sensor code below is unchanged from your version.
 */

#define USE_WIFI 0

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

// ===================== PIN DEFINITIONS =====================
#define SOIL_PIN 34
#define PH_PIN   35
#define DS18B20_PIN 4
#define OLED_SDA 21
#define OLED_SCL 22

// ===================== OLED =====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ===================== DS18B20 =====================
OneWire oneWire(DS18B20_PIN);
DallasTemperature temperatureSensor(&oneWire);

// ===================== SOIL MOISTURE CALIBRATION =====================
const int SOIL_DRY = 3000;
const int SOIL_WET = 1200;

// ===================== PH REFERENCE =====================
const float PH_REFERENCE_VOLTAGE = 1.40;
const float PH_REFERENCE = 7.00;
const float PH_SLOPE = 0.18;

// ===================== SETUP =====================
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
  display.setCursor(0, 0);  display.println("SMART FARMING");
  display.setCursor(0, 18); display.println("SOIL + PH + TEMP");
  display.setCursor(0, 36); display.println("Initializing...");
  display.display();
  delay(2000);

#if USE_WIFI
  connectWiFi();
#endif

  Serial.println();
  Serial.println("================================");
  Serial.println(" SMART FARMING MONITOR");
  Serial.println("================================");
}

// ===================== LOOP =====================
void loop() {

  // ---------- SOIL MOISTURE ----------
  int soilADC = analogRead(SOIL_PIN);
  int moisture = map(soilADC, SOIL_DRY, SOIL_WET, 0, 100);
  moisture = constrain(moisture, 0, 100);

  String soilStatus;
  if (moisture < 30)      soilStatus = "DRY";
  else if (moisture < 60) soilStatus = "MEDIUM";
  else                    soilStatus = "MOIST";

  // ---------- PH SENSOR ----------
  int phADC = analogRead(PH_PIN);
  float adcVoltage = (phADC / 4095.0) * 3.3;
  float poVoltage  = adcVoltage * (25.0 / 15.0);   // PO -> 10k -> GPIO35 -> 15k -> GND

  float pH = PH_REFERENCE + ((PH_REFERENCE_VOLTAGE - poVoltage) / PH_SLOPE);
  pH = constrain(pH, 0.0, 14.0);

  String phStatus;
  if (pH < 5.5)       phStatus = "ACIDIC";
  else if (pH <= 7.5) phStatus = "NORMAL";
  else                phStatus = "ALKALINE";

  // ---------- DS18B20 TEMPERATURE ----------
  temperatureSensor.requestTemperatures();
  float temperature = temperatureSensor.getTempCByIndex(0);
  bool temperatureOK = (temperature != DEVICE_DISCONNECTED_C);

  // ---------- SERIAL MONITOR ----------
  Serial.println();
  Serial.println("--------------------------------");
  Serial.print("Soil ADC       : "); Serial.println(soilADC);
  Serial.print("Moisture       : "); Serial.print(moisture); Serial.println("%");
  Serial.print("Soil Status    : "); Serial.println(soilStatus);
  Serial.print("pH ADC         : "); Serial.println(phADC);
  Serial.print("ADC Voltage    : "); Serial.print(adcVoltage, 3); Serial.println(" V");
  Serial.print("PO Voltage     : "); Serial.print(poVoltage, 3); Serial.println(" V");
  Serial.print("pH             : "); Serial.println(pH, 2);
  Serial.print("pH Status      : "); Serial.println(phStatus);
  if (temperatureOK) { Serial.print("Temperature    : "); Serial.print(temperature, 2); Serial.println(" C"); }
  else               { Serial.println("Temperature    : SENSOR ERROR"); }

  // ---------- OLED DISPLAY ----------
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0); display.println("SMART FARMING");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
  display.setCursor(0, 16); display.print("Moisture: "); display.print(moisture); display.println("%");
  display.setCursor(0, 27); display.print("Status: "); display.println(soilStatus);
  display.setCursor(0, 38); display.print("pH: "); display.print(pH, 2);
  display.setCursor(0, 50); display.print("Temp: ");
  if (temperatureOK) { display.print(temperature, 1); display.print(" C"); }
  else               { display.print("ERROR"); }
  display.display();

#if USE_WIFI
  postReading(moisture, pH, temperatureOK ? temperature : NAN);
#endif

  delay(2000);
}

// ===================== PHASE 2 — WiFi upload =====================
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
