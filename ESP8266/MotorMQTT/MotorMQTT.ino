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
const char* TOPIC_MOTOR1 = "motor1";
const char* TOPIC_MOTOR2 = "motor2";
const char* TOPIC_LCD = "lcd";

WiFiClient espClient;
PubSubClient mqtt(espClient);

// ======== 步进电机配置 (28BYJ-48 + ULN2003) ========
// Motor 1
const uint8_t MOTOR1_IN1 = D5;
const uint8_t MOTOR1_IN2 = D6;
const uint8_t MOTOR1_IN3 = D7;
const uint8_t MOTOR1_IN4 = D8;

// Motor 2
const uint8_t MOTOR2_IN1 = D9;
const uint8_t MOTOR2_IN2 = D10;
const uint8_t MOTOR2_IN3 = D11;
const uint8_t MOTOR2_IN4 = D12;

const uint8_t MOTOR_SEQ[8][4] = {
  {1,0,0,0},{1,1,0,0},{0,1,0,0},{0,1,1,0},
  {0,0,1,0},{0,0,1,1},{0,0,0,1},{1,0,0,1}
};

const int STEPS_PER_REV = 4096;
float GRAMS_PER_STEP = 0.0250f;
bool motor1_busy = false;
bool motor2_busy = false;

// ======== 重量匹配状态 ========
// Motor 1
bool waiting_for_weight_m1 = false;
float target_animal_weight_m1 = 0.0f;
String pending_animal_name_m1 = "";
float pending_food_amount_m1 = 0.0f;
unsigned long weight_match_start_m1 = 0;
unsigned long weight_wait_start_m1 = 0;

// Motor 2
bool waiting_for_weight_m2 = false;
float target_animal_weight_m2 = 0.0f;
String pending_animal_name_m2 = "";
float pending_food_amount_m2 = 0.0f;
unsigned long weight_match_start_m2 = 0;
unsigned long weight_wait_start_m2 = 0;

// 公共参数
float weight_tolerance = 0.3f;
const unsigned long WEIGHT_STABLE_MS = 2000;
const unsigned long WEIGHT_TIMEOUT_MS = 30000000; // 重量检测超时 8.33h/3000s

// ======== 电机控制 ========
static inline void driveMotorPhase(uint8_t motor_id, uint8_t i) {
  if (motor_id == 1) {
    digitalWrite(MOTOR1_IN1, MOTOR_SEQ[i][0]);
    digitalWrite(MOTOR1_IN2, MOTOR_SEQ[i][1]);
    digitalWrite(MOTOR1_IN3, MOTOR_SEQ[i][2]);
    digitalWrite(MOTOR1_IN4, MOTOR_SEQ[i][3]);
  } else if (motor_id == 2) {
    digitalWrite(MOTOR2_IN1, MOTOR_SEQ[i][0]);
    digitalWrite(MOTOR2_IN2, MOTOR_SEQ[i][1]);
    digitalWrite(MOTOR2_IN3, MOTOR_SEQ[i][2]);
    digitalWrite(MOTOR2_IN4, MOTOR_SEQ[i][3]);
  }
}

void stepMotor(uint8_t motor_id, long steps, float rpm, bool cw) {
  if (steps <= 0) return;

  float sps = (rpm <= 0) ? 200.0f : (rpm * STEPS_PER_REV / 60.0f);
  if (sps < 50.0f)   sps = 50.0f;
  if (sps > 1200.0f) sps = 1200.0f;
  unsigned long us_per = (unsigned long)(1000000.0f / sps);
  if (us_per < 500) us_per = 500;

  uint8_t idx = 0;
  for (long k = 0; k < steps; ++k) {
    driveMotorPhase(motor_id, idx);
    delayMicroseconds(us_per);

    if ((k & 0x3F) == 0) {
      mqtt.loop();
      yield();
    }

    idx = cw ? (uint8_t)(idx + 1) : (uint8_t)(idx + 7);
    if (idx >= 8) idx -= 8;
  }
  
  // 释放线圈
  if (motor_id == 1) {
    digitalWrite(MOTOR1_IN1, LOW);
    digitalWrite(MOTOR1_IN2, LOW);
    digitalWrite(MOTOR1_IN3, LOW);
    digitalWrite(MOTOR1_IN4, LOW);
  } else if (motor_id == 2) {
    digitalWrite(MOTOR2_IN1, LOW);
    digitalWrite(MOTOR2_IN2, LOW);
    digitalWrite(MOTOR2_IN3, LOW);
    digitalWrite(MOTOR2_IN4, LOW);
  }
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

void handleMotorCommand(const char* payload, size_t len, uint8_t motor_id) {
  bool *motor_busy = (motor_id == 1) ? &motor1_busy : &motor2_busy;
  bool *waiting_for_weight = (motor_id == 1) ? &waiting_for_weight_m1 : &waiting_for_weight_m2;
  
  if (*motor_busy || *waiting_for_weight) {
    publishLCD(String("Motor") + motor_id + " busy");
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
  
  Serial.print("📥 Motor");
  Serial.print(motor_id);
  Serial.print(": ");
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
    Serial.print("🍽️ MANUAL M");
    Serial.print(motor_id);
    Serial.print(": ");
    Serial.print(name);
    Serial.print(" ");
    Serial.print(amountKg, 2);
    Serial.println("kg");

    float grams = amountKg * 1000.0f;
    long steps = (long)((grams / GRAMS_PER_STEP) + 0.5f);
    if (steps < 1) steps = 1;

    *motor_busy = true;
    publishLCD(String("M") + motor_id + " Manual - " + name);

    stepMotor(motor_id, steps, 10.0f, true);

    *motor_busy = false;
    publishLCD(String("M") + motor_id + " Complete - " + name);
    return;
  }

  // Scheduled feeding
  Serial.print("📅 SCHEDULED M");
  Serial.print(motor_id);
  Serial.print(": Waiting for ");
  Serial.print(name);
  Serial.print(" (");
  Serial.print(animalWeight, 2);
  Serial.println("kg)");
  
  *waiting_for_weight = true;
  
  if (motor_id == 1) {
    target_animal_weight_m1 = animalWeight;
    pending_animal_name_m1 = String(name);
    pending_food_amount_m1 = amountKg;
    weight_match_start_m1 = 0;
    weight_wait_start_m1 = millis();
  } else {
    target_animal_weight_m2 = animalWeight;
    pending_animal_name_m2 = String(name);
    pending_food_amount_m2 = amountKg;
    weight_match_start_m2 = 0;
    weight_wait_start_m2 = millis();
  }

  publishWeightEnable(true);
  publishLCD(String("M") + motor_id + " Waiting - " + name);
}

void handleWeightMatch(float detected_kg, uint8_t motor_id) {
  bool *waiting_for_weight = (motor_id == 1) ? &waiting_for_weight_m1 : &waiting_for_weight_m2;
  bool *motor_busy = (motor_id == 1) ? &motor1_busy : &motor2_busy;
  float *target_weight = (motor_id == 1) ? &target_animal_weight_m1 : &target_animal_weight_m2;
  String *pending_name = (motor_id == 1) ? &pending_animal_name_m1 : &pending_animal_name_m2;
  float *pending_amount = (motor_id == 1) ? &pending_food_amount_m1 : &pending_food_amount_m2;
  unsigned long *match_start = (motor_id == 1) ? &weight_match_start_m1 : &weight_match_start_m2;
  
  if (!*waiting_for_weight) return;

  float diff = abs(detected_kg - *target_weight);
  
  if (diff <= weight_tolerance) {
    if (*match_start == 0) {
      *match_start = millis();
      Serial.print("✓ M");
      Serial.print(motor_id);
      Serial.print(" Weight matched: ");
      Serial.print(detected_kg, 2);
      Serial.println("kg");
    }
    
    if (millis() - *match_start >= WEIGHT_STABLE_MS) {
      Serial.print("✓✓ M");
      Serial.print(motor_id);
      Serial.println(" Stable! Dispensing...");
      
      publishWeightEnable(false);
      
      float grams = *pending_amount * 1000.0f;
      long steps = (long)((grams / GRAMS_PER_STEP) + 0.5f);
      if (steps < 1) steps = 1;

      *motor_busy = true;
      *waiting_for_weight = false;
      
      publishLCD(String("M") + motor_id + " Feeding " + *pending_name);
      
      stepMotor(motor_id, steps, 10.0f, true);
      
      *motor_busy = false;
      publishLCD(String("M") + motor_id + " Complete - " + *pending_name);
      
      *target_weight = 0.0f;
      *pending_name = "";
      *pending_amount = 0.0f;
      *match_start = 0;
    }
  } else {
    if (*match_start > 0) {
      Serial.print("✗ M");
      Serial.print(motor_id);
      Serial.println(" Weight changed");
      *match_start = 0;
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

  if (topicStr == TOPIC_MOTOR1) {
    handleMotorCommand((const char*)payload, len, 1);
  }
  else if (topicStr == TOPIC_MOTOR2) {
    handleMotorCommand((const char*)payload, len, 2);
  }
  else if (topicStr == TOPIC_WEIGHT_SENSOR) {
    StaticJsonDocument<128> doc;
    DeserializationError error = deserializeJson(doc, payloadStr);
    
    if (!error && doc.containsKey("weight")) {
      String weightStr = doc["weight"];
      float detected_kg = weightStr.toFloat();
      
      // 检查哪个motor在等待重量
      if (waiting_for_weight_m1) {
        handleWeightMatch(detected_kg, 1);
      }
      if (waiting_for_weight_m2) {
        handleWeightMatch(detected_kg, 2);
      }
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
      
      mqtt.subscribe(TOPIC_MOTOR1);
      mqtt.subscribe(TOPIC_MOTOR2);
      mqtt.subscribe(TOPIC_WEIGHT_SENSOR);
      
      Serial.print("Subscribed to: ");
      Serial.print(TOPIC_MOTOR1);
      Serial.print(", ");
      Serial.print(TOPIC_MOTOR2);
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

  // 初始化 Motor 1 引脚
  pinMode(MOTOR1_IN1, OUTPUT);
  pinMode(MOTOR1_IN2, OUTPUT);
  pinMode(MOTOR1_IN3, OUTPUT);
  pinMode(MOTOR1_IN4, OUTPUT);
  digitalWrite(MOTOR1_IN1, LOW);
  digitalWrite(MOTOR1_IN2, LOW);
  digitalWrite(MOTOR1_IN3, LOW);
  digitalWrite(MOTOR1_IN4, LOW);
  
  // 初始化 Motor 2 引脚
  pinMode(MOTOR2_IN1, OUTPUT);
  pinMode(MOTOR2_IN2, OUTPUT);
  pinMode(MOTOR2_IN3, OUTPUT);
  pinMode(MOTOR2_IN4, OUTPUT);
  digitalWrite(MOTOR2_IN1, LOW);
  digitalWrite(MOTOR2_IN2, LOW);
  digitalWrite(MOTOR2_IN3, LOW);
  digitalWrite(MOTOR2_IN4, LOW);

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
  
  // 检查 Motor 1 超时
  if (waiting_for_weight_m1 && (now - weight_wait_start_m1 >= WEIGHT_TIMEOUT_MS)) {
    Serial.println("⚠️ M1 Timeout!");
    publishLCD("M1 Timeout: " + pending_animal_name_m1);
    publishWeightEnable(false);
    waiting_for_weight_m1 = false;
    target_animal_weight_m1 = 0.0f;
    pending_animal_name_m1 = "";
    pending_food_amount_m1 = 0.0f;
    weight_match_start_m1 = 0;
    weight_wait_start_m1 = 0;
  }
  
  // 检查 Motor 2 超时
  if (waiting_for_weight_m2 && (now - weight_wait_start_m2 >= WEIGHT_TIMEOUT_MS)) {
    Serial.println("⚠️ M2 Timeout!");
    publishLCD("M2 Timeout: " + pending_animal_name_m2);
    publishWeightEnable(false);
    waiting_for_weight_m2 = false;
    target_animal_weight_m2 = 0.0f;
    pending_animal_name_m2 = "";
    pending_food_amount_m2 = 0.0f;
    weight_match_start_m2 = 0;
    weight_wait_start_m2 = 0;
  }

  delay(10);
}
