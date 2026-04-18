/*
 * StreetScan IoT Node Firmware
 * Hardware: ESP32 + MPU6050 + SIM800L (vehicle) or WiFi (static)
 * 
 * Wiring:
 *   MPU6050 SDA -> GPIO 21
 *   MPU6050 SCL -> GPIO 22
 *   MPU6050 VCC -> 3.3V
 *   MPU6050 GND -> GND
 * 
 * Libraries: Wire, Adafruit_MPU6050, TinyGPS++, ArduinoJson, HTTPClient
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>
#include <math.h>

// ========== CONFIGURATION ==========
#define DEVICE_ID       "DEV-001"
#define DEVICE_TYPE     "vehicle"   // "vehicle" | "building" | "static"
#define USE_WIFI        false        // true = WiFi, false = SIM800L

// WiFi (for static/building)
#define WIFI_SSID       "YourWiFiSSID"
#define WIFI_PASS       "YourWiFiPassword"

// Server endpoint
#define SERVER_URL      "http://your-server-ip:3000/api/iot"

// Thresholds
#define VIBRATION_THRESHOLD   0.80f   // g-force RMS
#define SAMPLE_WINDOW_MS      500     // ms to sample before computing RMS
#define SEND_INTERVAL_MS      5000    // min ms between transmissions
#define SAMPLE_RATE_HZ        100     // MPU6050 sample rate

// GPS (optional — for vehicle mode)
#define USE_GPS         true
#define GPS_RX_PIN      16
#define GPS_TX_PIN      17
#define GPS_BAUD        9600

// SIM800L
#define SIM_RX_PIN      26
#define SIM_TX_PIN      27
#define SIM_BAUD        9600
// ====================================

#if USE_WIFI
  #include <WiFi.h>
  #include <HTTPClient.h>
#endif

#if USE_GPS
  #include <TinyGPS++.h>
  HardwareSerial gpsSerial(1);
  TinyGPSPlus gps;
#endif

Adafruit_MPU6050 mpu;

// State
float    gpsLat      = 0.0f, gpsLng = 0.0f;
bool     gpsValid    = false;
uint32_t lastSendMs  = 0;

// Circular buffer for RMS computation
const int SAMPLE_COUNT = (SAMPLE_RATE_HZ * SAMPLE_WINDOW_MS) / 1000;
float     accelBuf[300];  // max 300 samples
int       bufIdx = 0;

// ----------------------------------------
float computeRMS(float* buf, int n) {
  float sum = 0;
  for (int i = 0; i < n; i++) sum += buf[i] * buf[i];
  return sqrt(sum / n);
}

// ----------------------------------------
void sendData(float rms, float ax, float ay, float az, const char* eventType) {
  StaticJsonDocument<512> doc;
  doc["device_id"]    = DEVICE_ID;
  doc["device_type"]  = DEVICE_TYPE;
  doc["vibration_rms"]= rms;
  doc["accel_x"]      = ax;
  doc["accel_y"]      = ay;
  doc["accel_z"]      = az;
  doc["magnitude"]    = rms;
  doc["event_type"]   = eventType;

  if (gpsValid) {
    doc["latitude"]   = gpsLat;
    doc["longitude"]  = gpsLng;
  }

  char payload[512];
  serializeJson(doc, payload);

  Serial.print("[TX] ");
  Serial.println(payload);

#if USE_WIFI
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(payload);
    Serial.print("[HTTP] Response: ");
    Serial.println(code);
    http.end();
  }
#else
  // SIM800L HTTP POST
  HardwareSerial sim(2);
  sim.begin(SIM_BAUD, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  delay(1000);

  auto simCmd = [&](const char* cmd, int wait = 1000) {
    sim.println(cmd); delay(wait);
    while (sim.available()) Serial.write(sim.read());
  };

  simCmd("AT");
  simCmd("AT+SAPBR=3,1,\"Contype\",\"GPRS\"");
  simCmd("AT+SAPBR=3,1,\"APN\",\"airtelgprs.com\"");
  simCmd("AT+SAPBR=1,1", 3000);
  simCmd("AT+HTTPINIT");
  simCmd("AT+HTTPPARA=\"CID\",1");

  String urlCmd = "AT+HTTPPARA=\"URL\",\"" + String(SERVER_URL) + "\"";
  simCmd(urlCmd.c_str());
  simCmd("AT+HTTPPARA=\"CONTENT\",\"application/json\"");

  String dataCmd = "AT+HTTPDATA=" + String(strlen(payload)) + ",5000";
  simCmd(dataCmd.c_str(), 500);
  sim.print(payload); delay(1000);
  simCmd("AT+HTTPACTION=1", 5000);
  simCmd("AT+HTTPTERM");
#endif
}

// ----------------------------------------
void classifyEvent(float rms, const char** type) {
  if (rms > 1.5f)       *type = "impact";
  else if (rms > 0.9f)  *type = "pothole";
  else if (rms > 0.6f)  *type = "vibration";
  else                   *type = "vibration";
}

// ----------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println("[StreetScan] Booting...");

  // MPU6050
  Wire.begin();
  if (!mpu.begin()) {
    Serial.println("[ERROR] MPU6050 not found. Check wiring.");
    while (1) delay(500);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  Serial.println("[OK] MPU6050 ready");

#if USE_GPS
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] GPS serial ready");
#endif

#if USE_WIFI
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.print("\n[WiFi] IP: "); Serial.println(WiFi.localIP());
#endif

  Serial.println("[StreetScan] Ready. Monitoring...");
}

// ----------------------------------------
void loop() {
  // Feed GPS
#if USE_GPS
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
    if (gps.location.isValid()) {
      gpsLat = gps.location.lat();
      gpsLng = gps.location.lng();
      gpsValid = true;
    }
  }
#endif

  // Read accelerometer
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Magnitude of acceleration vector minus gravity (net dynamic acceleration)
  float mag = sqrt(a.acceleration.x * a.acceleration.x +
                   a.acceleration.y * a.acceleration.y +
                   a.acceleration.z * a.acceleration.z) - 9.81f;
  if (mag < 0) mag = -mag;

  accelBuf[bufIdx % SAMPLE_COUNT] = mag;
  bufIdx++;

  // Compute RMS every window
  if (bufIdx % SAMPLE_COUNT == 0) {
    float rms = computeRMS(accelBuf, SAMPLE_COUNT);
    uint32_t now = millis();

    Serial.print("[RMS] ");
    Serial.print(rms, 3);
    Serial.print("g  Threshold: ");
    Serial.println(VIBRATION_THRESHOLD);

    if (rms > VIBRATION_THRESHOLD && (now - lastSendMs) > SEND_INTERVAL_MS) {
      const char* eventType;
      classifyEvent(rms, &eventType);

      Serial.print("[ALERT] Event detected: ");
      Serial.println(eventType);

      sendData(rms, a.acceleration.x, a.acceleration.y, a.acceleration.z, eventType);
      lastSendMs = now;
    }
  }

  delay(1000 / SAMPLE_RATE_HZ);
}
