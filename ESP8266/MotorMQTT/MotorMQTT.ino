#include <ESP8266WiFi.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>

// ======== Wi-Fi & MQTT 配置 ========
char ssid_wifi[] = "Rogers";
char pass_wifi[] = "adminkentish30";

const char* MQTT_HOST = "10.0.0.108";
const int   MQTT_PORT = 1883;

// MQTT Topics
const char* TOPIC_WEIGHT_SENSOR = "weightSensor1";
const char* TOPIC_WEIGHT_ENABLE = "weightEnable";
const char* TOPIC_MOTOR = "motor1";
const char* TOPIC_LCD = "lcd";

WiFiClient espClient;
PubSubClient mqtt(espClient);

// ======== 步进电机配置 (28BYJ-48 + ULN2003) ========
const uint8_t MOTOR_IN1 = D5;
const uint8_t MOTOR_IN2 = D6;
const uint8_t MOTOR_IN3 = D7;
const uint8_t MOTOR_IN4 = D8;

const uint8_t MOTOR_SEQ[8][4] = {
  {1,0,0,0},{1,1,0,0},{0,1,0,0},{0,1,1,0},
  {0,0,1,0},{0,0,1,1},{0,0,0,1},{1,0,0,1}
};

const int STEPS_PER_REV = 4096;
float GRAMS_PER_STEP = 0.0250f;
bool motor_busy = false;

// ======== 重量匹配状态 ========
bool waiting_for_weight = false;
float target_animal_weight = 0.0f;
float weight_tolerance = 0.3f;
String pending_animal_name = "";
float pending_food_amount = 0.0f;
unsigned long weight_match_start = 0;
unsigned long weight_wait_start = 0;
const unsigned long WEIGHT_STABLE_MS = 2000;
const unsigned long WEIGHT_TIMEOUT_MS = 30000;

// ======== 电机控制 ========
static inline void driveMotorPhase(uint8_t i) {
  digitalWrite(MOTOR_IN1, MOTOR_SEQ[i][0]);
  digitalWrite(MOTOR_IN2, MOTOR_SEQ[i][1]);
  digitalWrite(MOTOR_IN3, MOTOR_SEQ[i][2]);
  digitalWrite(MOTOR_IN4, MOTOR_SEQ[i][3]);
}

void stepMotor(long steps, float rpm, bool cw) {
  if (steps <= 0) return;

  float sps = (rpm <= 0) ? 200.0f : (rpm * STEPS_PER_REV / 60.0f);
  if (sps < 50.0f)   sps = 50.0f;
  if (sps > 1200.0f) sps = 1200.0f;
  unsigned long us_per = (unsigned long)(1000000.0f / sps);
  if (us_per < 500) us_per = 500;

  uint8_t idx = 0;
  for (long k = 0; k < steps; ++k) {
    driveMotorPhase(idx);
    delayMicroseconds(us_per);

    if ((k & 0x3F) == 0) {
      mqtt.loop();
      yield();
    }

    idx = cw ? (uint8_t)(idx + 1) : (uint8_t)(idx + 7);
    if (idx >= 8) idx -= 8;
  }
  
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
}

// ======== MQTT 辅助函数 ========
void publishLCD(const String& text) {
  StaticJsonDocument<160> doc;
  doc["text"] = text;
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  mqtt.publish(TOPIC_LCD, payload.c_str());
  
  Serial.print("📺 LCD -> ");
  Serial.println(text);
}

void publishWeightEnable(bool enable) {
  StaticJsonDocument<64> doc;
  doc["enable"] = enable;
  
  String payload;
  serializeJson(doc, payload);
  
  bool success = mqtt.publish(TOPIC_WEIGHT_ENABLE, payload.c_str());
  Serial.print("📤 weightEnable -> ");
  Serial.print(payload);
  Serial.println(success ? " ✅" : " ❌");
}

void handleMotorCommand(const char* payload, size_t len) {
  if (motor_busy || waiting_for_weight) {
    publishLCD("Motor busy, please wait");
    return;
  }

  StaticJsonDocument<384> doc;
  DeserializationError e = deserializeJson(doc, payload, len);
  if (e) {
    Serial.print("JSON parse error: ");
    Serial.println(e.c_str());
    return;
  }

  const char* cmd = doc["command"] | "";
  const char* status = doc["status"] | "pending";
  const char* name = doc["animal_name"] | "Pet";
  const char* feedingType = doc["feeding_type"] | "scheduled";
  
  // 解析 food_amount
  float amountKg = 0.0f;
  if (doc.containsKey("food_amount")) {
    if (doc["food_amount"].is<float>() || doc["food_amount"].is<double>()) {
      amountKg = doc["food_amount"];
    } else if (doc["food_amount"].is<const char*>()) {
      String amountStr = doc["food_amount"].as<const char*>();
      amountKg = amountStr.toFloat();
    }
  }
  
  // 解析 animal_weight
  float animalWeight = 0.0f;
  if (doc.containsKey("animal_weight")) {
    if (doc["animal_weight"].is<float>() || doc["animal_weight"].is<double>()) {
      animalWeight = doc["animal_weight"];
    } else if (doc["animal_weight"].is<const char*>()) {
      String weightStr = doc["animal_weight"].as<const char*>();
      animalWeight = weightStr.toFloat();
    }
  }
  
  Serial.print("📥 Motor: ");
  Serial.print(feedingType);
  Serial.print(" | ");
  Serial.print(name);
  Serial.print(" | Food:");
  Serial.print(amountKg, 2);
  Serial.print("kg | Animal:");
  Serial.print(animalWeight, 2);
  Serial.println("kg");

  if (strcmp(cmd, "dispense") != 0) return;
  if (strcmp(status, "pending") != 0) return;
  if (amountKg <= 0) return;

  // Manual feeding
  if (strcmp(feedingType, "manual") == 0) {
    Serial.print("🍽️ MANUAL: ");
    Serial.print(name);
    Serial.print(" ");
    Serial.print(amountKg, 2);
    Serial.println("kg");

    float grams = amountKg * 1000.0f;
    long steps = (long)((grams / GRAMS_PER_STEP) + 0.5f);
    if (steps < 1) steps = 1;

    motor_busy = true;
    publishLCD(String("Manual Feed - ") + name);

    stepMotor(steps, 10.0f, true);

    motor_busy = false;
    publishLCD(String("Complete - ") + name);
    return;
  }

  // Scheduled feeding
  Serial.print("📅 SCHEDULED: Waiting for ");
  Serial.print(name);
  Serial.print(" (");
  Serial.print(animalWeight, 2);
  Serial.println("kg)");
  
  waiting_for_weight = true;
  target_animal_weight = animalWeight;
  pending_animal_name = String(name);
  pending_food_amount = amountKg;
  weight_match_start = 0;
  weight_wait_start = millis();

  publishWeightEnable(true);
  publishLCD(String("Waiting for ") + name);
}

void handleWeightMatch(float detected_kg) {
  if (!waiting_for_weight) return;

  float diff = abs(detected_kg - target_animal_weight);
  
  if (diff <= weight_tolerance) {
    if (weight_match_start == 0) {
      weight_match_start = millis();
      Serial.print("✓ Weight matched: ");
      Serial.print(detected_kg, 2);
      Serial.println("kg");
    }
    
    if (millis() - weight_match_start >= WEIGHT_STABLE_MS) {
      Serial.println("✓✓ Stable! Dispensing...");
      
      publishWeightEnable(false);
      
      float grams = pending_food_amount * 1000.0f;
      long steps = (long)((grams / GRAMS_PER_STEP) + 0.5f);
      if (steps < 1) steps = 1;

      motor_busy = true;
      waiting_for_weight = false;
      
      publishLCD(String("Feeding ") + pending_animal_name);
      
      stepMotor(steps, 10.0f, true);
      
      motor_busy = false;
      publishLCD(String("Complete - ") + pending_animal_name);
      
      target_animal_weight = 0.0f;
      pending_animal_name = "";
      pending_food_amount = 0.0f;
      weight_match_start = 0;
    }
  } else {
    if (weight_match_start > 0) {
      Serial.println("✗ Weight changed");
      weight_match_start = 0;
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int len) {
  String topicStr = String(topic);
  String payloadStr = "";
  for (unsigned int i = 0; i < len; i++) {
    payloadStr += (char)payload[i];
  }

  Serial.print("📩 RX <- ");
  Serial.print(topicStr);
  Serial.print(" :: ");
  Serial.println(payloadStr);

  if (topicStr == TOPIC_MOTOR) {
    handleMotorCommand((const char*)payload, len);
  }
  else if (topicStr == TOPIC_WEIGHT_SENSOR && waiting_for_weight) {
    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, payloadStr);
    
    if (!error && doc.containsKey("weight")) {
      String weightStr = doc["weight"];
      float detected_kg = weightStr.toFloat();
      handleWeightMatch(detected_kg);
    }
  }
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid_wifi);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid_wifi, pass_wifi);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  
  while (!mqtt.connected()) {
    String cid = "motor-" + String(ESP.getChipId(), HEX);
    Serial.print("Connecting to MQTT... ");
    
    if (mqtt.connect(cid.c_str())) {
      Serial.println("connected!");
      
      mqtt.subscribe(TOPIC_MOTOR);
      mqtt.subscribe(TOPIC_WEIGHT_SENSOR);
      
      Serial.print("Subscribed to: ");
      Serial.print(TOPIC_MOTOR);
      Serial.print(", ");
      Serial.println(TOPIC_WEIGHT_SENSOR);
      
      publishLCD("Motor online");
    } else {
      Serial.print("failed, rc=");
      Serial.println(mqtt.state());
      delay(500);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n=== Motor Control System ===");

  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);

  ensureWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  ensureMqtt();
  
  Serial.println("✅ Motor ready");
}

void loop() {
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  unsigned long now = millis();
  if (waiting_for_weight && (now - weight_wait_start >= WEIGHT_TIMEOUT_MS)) {
    Serial.println("⚠️ Timeout!");
    publishLCD("Timeout: " + pending_animal_name);
    publishWeightEnable(false);
    waiting_for_weight = false;
    target_animal_weight = 0.0f;
    pending_animal_name = "";
    pending_food_amount = 0.0f;
    weight_match_start = 0;
    weight_wait_start = 0;
  }

  delay(10);
}
