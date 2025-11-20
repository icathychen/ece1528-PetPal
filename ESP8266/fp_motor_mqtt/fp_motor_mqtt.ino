// WeMos D1 (ESP8266) + ULN2003 + 28BYJ-48 (5V)
// FINAL + MQTT minimal integration: sub "motor1", parse food_amount,
// move motor, then publish completion text to "lcd".
// Libs needed: ESP8266WiFi, PubSubClient, ArduinoJson

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

/* ---------- WiFi / MQTT ---------- */
char ssid_wifi[] = "Rogers";
char pass_wifi[] = "adminkentish30";

const char* MQTT_HOST = "10.0.0.108";   // 你的电脑IP（ipconfig 查到的 Wi-Fi IPv4）
const int   MQTT_PORT = 1883;

const char* TOPIC_MOTOR = "motor1";       // 先做单仓
const char* TOPIC_LCD   = "lcd";

WiFiClient net;
PubSubClient mqtt(net);

/* ---------- Pins (WeMos D1 silk) ---------- */
const uint8_t IN1 = D5;  // ULN2003 IN1 (GPIO14)
const uint8_t IN2 = D6;  // ULN2003 IN2 (GPIO12)
const uint8_t IN3 = D7;  // ULN2003 IN3 (GPIO13)
const uint8_t IN4 = D8;  // ULN2003 IN4 (GPIO15)

/* ---------- Half-step sequence ---------- */
const uint8_t SEQ[8][4] = {
  {1,0,0,0},{1,1,0,0},{0,1,0,0},{0,1,1,0},
  {0,0,1,0},{0,0,1,1},{0,0,0,1},{1,0,0,1}
};

/* ---------- Mechanics / calibration ---------- */
const int STEPS_PER_REV = 4096;   // 28BYJ-48 半步/圈（可微调）
float GRAMS_PER_STEP = 0.00250f;  // 每半步对应克数（测试后更新）

/* ---------- State ---------- */
bool busy = false;

/* ---------- Low-level drive ---------- */
static inline void drivePhase(uint8_t i) {
  digitalWrite(IN1, SEQ[i][0]);
  digitalWrite(IN2, SEQ[i][1]);
  digitalWrite(IN3, SEQ[i][2]);
  digitalWrite(IN4, SEQ[i][3]);
}

// WDT/MQTT-friendly blocking stepping
void stepN(long steps, float rpm, bool cw) {
  if (steps <= 0) return;

  float sps = (rpm <= 0) ? 200.0f : (rpm * STEPS_PER_REV / 60.0f);
  if (sps < 50.0f)   sps = 50.0f;
  if (sps > 1200.0f) sps = 1200.0f;
  unsigned long us_per = (unsigned long)(1000000.0f / sps);
  if (us_per < 500) us_per = 500;

  uint8_t idx = 0;
  for (long k = 0; k < steps; ++k) {
    drivePhase(idx);
    delayMicroseconds(us_per);

    // 喂狗 + 处理 MQTT 心跳（关键）
    if ((k & 0x3F) == 0) { // 每64步
      mqtt.loop();         // 保活
      yield();             // Wi-Fi/WDT
    }

    idx = cw ? (uint8_t)(idx + 1) : (uint8_t)(idx + 7);
    if (idx >= 8) idx -= 8;
  }
  // 释放线圈降温
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);
}

void rotateDegrees(float deg, float rpm, bool cw) {
  if (deg <= 0) return;
  long steps = (long)(STEPS_PER_REV * (deg / 360.0f) + 0.5f);
  stepN(steps, rpm, cw);
}

/* ---------- MQTT helpers ---------- */
void publishLCD(const String& text) {
  StaticJsonDocument<160> doc;
  char buf[160];
  doc["text"] = text;
  doc["timestamp"] = millis();
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(TOPIC_LCD, buf, n);
}

void handleMotorJson(const char* payload, size_t len) {
  if (busy) return; // 忙碌保护

  StaticJsonDocument<384> doc;
  DeserializationError e = deserializeJson(doc, payload, len);
  if (e) return;

  const char* cmd    = doc["command"] | "";
  float amountKg     = doc["food_amount"] | 0.0f;
  const char* status = doc["status"] | "pending";
  const char* name   = doc["animal_name"] | "Pet";
  // 可选：float rpm = doc["rpm"] | 8.0f;

  if (strcmp(cmd, "dispense") != 0) return;
  if (strcmp(status, "pending") != 0) return;
  if (amountKg <= 0) return;

  float grams = amountKg * 100.0f;
  long steps  = (long)((grams / GRAMS_PER_STEP) + 0.5f);
  if (steps < 1) steps = 1;

  busy = true;
  publishLCD(String("Feeding... ") + name + " " + String(amountKg,3) + "kg");

  // 先用安全转速
  stepN(steps, 10.0f /*rpm*/, true /*CW*/);

  busy = false;
  publishLCD(String("Feeding Complete - ") + name + ": " + String(amountKg,3) + "kg");
}

/* ---------- MQTT glue ---------- */
void onMqtt(char* topic, byte* payload, unsigned int len) {
  if (strcmp(topic, TOPIC_MOTOR) == 0) {
    handleMotorJson((const char*)payload, len);
  }
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid_wifi, pass_wifi);
  while (WiFi.status() != WL_CONNECTED) delay(300);
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  while (!mqtt.connected()) {
    String cid = String("feeder-") + String(ESP.getChipId(), HEX);
    if (mqtt.connect(cid.c_str())) {
      mqtt.subscribe(TOPIC_MOTOR, 1);        // QoS 1
      publishLCD("Motor online");            // 上线提示
    } else {
      delay(500);
    }
  }
}

/* ---------- Serial command (保留手工测试) ---------- */
void handleSerial() {
  if (!Serial.available()) return;
  String s = Serial.readStringUntil('\n');
  s.trim(); if (s.length()==0) return;

  bool cw;
  if (s.startsWith("CW")) cw = true;
  else if (s.startsWith("CCW")) cw = false;
  else return;

  int p1 = s.indexOf(' ');
  int p2 = s.indexOf(' ', p1 + 1);
  float deg = (p1>0) ? s.substring(p1+1, (p2>0 ? p2 : s.length())).toFloat() : 0.0f;
  float rpm = (p2>0) ? s.substring(p2+1).toFloat() : 10.0f;

  rotateDegrees(deg, rpm, cw);
  Serial.printf("OK %s %.1f deg @ %.1f RPM\n", cw?"CW":"CCW", deg, rpm);
}

/* ---------- Arduino hooks ---------- */
void setup() {
  Serial.begin(9600);
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  digitalWrite(IN1, LOW); digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW); digitalWrite(IN4, LOW);

  ensureWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqtt);
  ensureMqtt();

  Serial.println("Ready: sub motor1; publish lcd on completion");
}

void loop() {
  ensureWifi();
  ensureMqtt();
  mqtt.loop();      // 主循环心跳
  handleSerial();   // 仍可串口手动测试
}

