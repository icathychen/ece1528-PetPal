#include <ESP8266WiFi.h>
#include <HX711_ADC.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>

// ======== Wi-Fi & MQTT 配置 ========
char ssid_wifi[] = "Rogers";
char pass_wifi[] = "adminkentish30";

const char* MQTT_HOST = "10.0.0.108";   // 你的电脑IP（ipconfig 查到的 Wi-Fi IPv4）
const int   MQTT_PORT = 1883;           // Mosquitto TCP 端口

// MQTT Topics
const char* TOPIC_WEIGHT_SENSOR = "weightSensor1";  // 发布重量数据
const char* TOPIC_WEIGHT_ENABLE = "weightEnable";   // 订阅重量控制
const char* TOPIC_MOTOR = "motor1";                 // 订阅电机控制
const char* TOPIC_LCD = "lcd";                      // 发布 LCD 消息

WiFiClient espClient;
PubSubClient mqtt(espClient);

// ======== 步进电机引脚配置 (28BYJ-48 + ULN2003) ========
const uint8_t MOTOR_IN1 = D5;  // ULN2003 IN1 (GPIO14)
const uint8_t MOTOR_IN2 = D6;  // ULN2003 IN2 (GPIO12)
const uint8_t MOTOR_IN3 = D7;  // ULN2003 IN3 (GPIO13)
const uint8_t MOTOR_IN4 = D8;  // ULN2003 IN4 (GPIO15)
const uint8_t MOTOR_EN  = D2;//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// 半步进序列
const uint8_t MOTOR_SEQ[8][4] = {
  {1,0,0,0},{1,1,0,0},{0,1,0,0},{0,1,1,0},
  {0,0,1,0},{0,0,1,1},{0,0,0,1},{1,0,0,1}
};

// 电机参数
const int STEPS_PER_REV = 4096;      // 28BYJ-48 半步/圈
float GRAMS_PER_STEP = 0.0250f;     // 每半步对应克数（需校准）
bool motor_busy = false;              // 电机忙碌标志

// ======== HX711 接线 & 校准 ========
const int HX711_DOUT = D12;   // D12
const int HX711_SCK  = D13;   // D13
HX711_ADC LoadCell(HX711_DOUT, HX711_SCK);

const int   CAL_EEPROM_ADDR = 0;
float       calibrationValue = 348.36;   // 你之前用的值；建议校准后再写
const unsigned long STABILIZE_MS = 2000; // 上电稳定时间
const unsigned long PUBLISH_INTERVAL_MS = 500; // 发布间隔 500ms

// ======== 全局状态 ========
unsigned long lastPub = 0;
bool weight_detection_enabled = false;  // 重量检测开关（默认关闭，必须收到enable才发布）
String last_received_msg = "";          // 记录上次消息，避免重复处理

// ======== 电机等待重量匹配状态 ========
bool waiting_for_weight = false;        // 是否在等待重量匹配
float target_animal_weight = 0.0f;      // 目标动物重量 (kg)
float weight_tolerance = 0.3f;          // 重量容差 (kg)，±0.3kg
String pending_animal_name = "";        // 待喂养的动物名称
float pending_food_amount = 0.0f;       // 待出粮数量 (kg)
unsigned long weight_match_start = 0;   // 重量匹配开始时间
unsigned long weight_wait_start = 0;    // 开始等待重量的时间
const unsigned long WEIGHT_STABLE_MS = 2000;  // 重量稳定时间 2秒
const unsigned long WEIGHT_TIMEOUT_MS = 30000000; // 重量检测超时 8.33h/3000s

// ======== 步进电机函数 ========
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
  digitalWrite(MOTOR_EN, HIGH);////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  Serial.print("MOTOR_EN, HIGH");
  for (long k = 0; k < steps; ++k) {
    driveMotorPhase(idx);
    delayMicroseconds(us_per);

    // 保持 MQTT 连接和 WDT
    if ((k & 0x3F) == 0) { // 每64步
      mqtt.loop();
      yield();
    }

    idx = cw ? (uint8_t)(idx + 1) : (uint8_t)(idx + 7);
    if (idx >= 8) idx -= 8;
  }
  
  // 释放线圈
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
  digitalWrite(MOTOR_EN, LOW);////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  Serial.print("MOTOR_EN, LOW");
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
    Serial.print("Motor JSON parse error: ");
    Serial.println(e.c_str());
    return;
  }

  const char* cmd = doc["command"] | "";
  const char* status = doc["status"] | "pending";
  const char* name = doc["animal_name"] | "Pet";
  const char* feedingType = doc["feeding_type"] | "scheduled";
  
  // 解析 food_amount（可能是字符串或数字）
  float amountKg = 0.0f;
  if (doc.containsKey("food_amount")) {
    if (doc["food_amount"].is<float>() || doc["food_amount"].is<double>()) {
      amountKg = doc["food_amount"];
    } else if (doc["food_amount"].is<const char*>()) {
      String amountStr = doc["food_amount"].as<const char*>();
      amountKg = amountStr.toFloat();
    }
  }
  
  // 解析 animal_weight（可能是字符串或数字）
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
  Serial.print(" | ");
  Serial.print(amountKg, 2);
  Serial.print("kg | Animal: ");
  Serial.print(animalWeight, 2);
  Serial.println("kg");

  if (strcmp(cmd, "dispense") != 0) return;
  if (strcmp(status, "pending") != 0) return;
  if (amountKg <= 0) return;

  // 判断喂食类型
  if (strcmp(feedingType, "manual") == 0) {
    // ========== Manual Feeding ==========
    Serial.print("🍽️ MANUAL: ");
    Serial.print(name);
    Serial.print(" ");
    Serial.print(amountKg, 2);
    Serial.println("kg");

    float grams = amountKg * 1000.0f;
    long steps = (long)((grams / GRAMS_PER_STEP) + 0.5f);
    if (steps < 1) steps = 1;

    motor_busy = true;
    publishLCD(String("Manual Feed - ") + name + " " + String(amountKg, 3) + "kg");

    stepMotor(steps, 10.0f /*rpm*/, true /*CW*/);

    motor_busy = false;
    publishLCD(String("Complete - ") + name + ": " + String(amountKg, 3) + "kg");
    
    return;  // 手动喂食完成
  }

  // ========== Scheduled Feeding ==========
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
  publishLCD(String("Waiting for ") + name + " (" + String(animalWeight, 1) + "kg)");
}

void handleWeightMatch(float detected_kg) {
  if (!waiting_for_weight) return;

  // 检查是否在容差范围内
  float diff = abs(detected_kg - target_animal_weight);
  
  if (diff <= weight_tolerance) {
    // 重量匹配！开始计时
    if (weight_match_start == 0) {
      weight_match_start = millis();
      Serial.print("✓ Weight matched! Waiting for stability... (");
      Serial.print(detected_kg, 1);
      Serial.println("kg)");
    }
    
    // 检查是否已稳定
    if (millis() - weight_match_start >= WEIGHT_STABLE_MS) {
      Serial.println("✓✓ Weight stable! Starting dispense...");
      
      // 🔴 停止重量检测 (Disable loadcell)
      publishWeightEnable(false);
      
      // 计算出粮步数
      float grams = pending_food_amount * 1000.0f;
      long steps = (long)((grams / GRAMS_PER_STEP) + 0.5f);
      if (steps < 1) steps = 1;

      // 🔵 第二个Enable信号：启动电机旋转出粮
      motor_busy = true;
      waiting_for_weight = false;
      
      publishLCD(String("Feeding ") + pending_animal_name + " " + String(pending_food_amount, 3) + "kg");
      
      stepMotor(steps, 10.0f /*rpm*/, true /*CW*/);
      
      motor_busy = false;
      publishLCD(String("Complete - ") + pending_animal_name + ": " + String(pending_food_amount, 3) + "kg");
      
      // 重置状态
      target_animal_weight = 0.0f;
      pending_animal_name = "";
      pending_food_amount = 0.0f;
      weight_match_start = 0;
    }
  } else {
    // 重量不匹配，重置稳定计时
    if (weight_match_start > 0) {
      Serial.print("✗ Weight changed, resetting timer (");
      Serial.print(detected_kg, 1);
      Serial.println("kg)");
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

  // 处理 weightEnable
  if (topicStr == TOPIC_WEIGHT_ENABLE) {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, payloadStr);
    
    if (!error && doc.containsKey("enable")) {
      bool new_state = doc["enable"];
      
      if (new_state != weight_detection_enabled) {
        weight_detection_enabled = new_state;
        Serial.print("⚡ Weight detection ");
        Serial.println(weight_detection_enabled ? "ENABLED" : "DISABLED");
      }
    }
  }
  // 处理 motor1
  else if (topicStr == TOPIC_MOTOR) {
    handleMotorCommand((const char*)payload, len);
  }
  // 处理 weightSensor1（Motor 订阅以检测动物）
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
    String cid = "esp8266-" + String(ESP.getChipId(), HEX);
    Serial.print("Connecting to MQTT... ");
    
    if (mqtt.connect(cid.c_str())) {
      Serial.println("connected!");
      
      // 订阅 topics（包括 weightSensor1）
      mqtt.subscribe(TOPIC_WEIGHT_ENABLE);
      mqtt.subscribe(TOPIC_MOTOR);
      mqtt.subscribe(TOPIC_WEIGHT_SENSOR);  // Motor 也订阅重量数据
      
      Serial.print("Subscribed to: ");
      Serial.print(TOPIC_WEIGHT_ENABLE);
      Serial.print(", ");
      Serial.print(TOPIC_MOTOR);
      Serial.print(", ");
      Serial.println(TOPIC_WEIGHT_SENSOR);
      
      publishLCD("System online");
    } else {
      Serial.print("failed, rc=");
      Serial.println(mqtt.state());
      delay(500);
    }
  }
}

// ======== Arduino Setup ========

// ======== Arduino Setup ========
void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n=== ESP8266 Integrated System Starting ===");
  Serial.println("Features: Weight Sensor + Motor Control");

  // 初始化电机引脚
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);
  pinMode(MOTOR_EN, OUTPUT);////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
  digitalWrite(MOTOR_EN, LOW);////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  Serial.print("setupMOTOR_EN, LOW");

  // 连接 Wi-Fi
  ensureWifi();

  // 配置 MQTT
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  ensureMqtt();

  // 初始化 HX711
  LoadCell.begin();
  #if defined(ESP8266) || defined(ESP32)
    EEPROM.begin(512);
  #endif
  
  float eepromCal = 348.36;
  EEPROM.get(CAL_EEPROM_ADDR, eepromCal);
  if (isfinite(eepromCal) && eepromCal > 0.1f && eepromCal < 100000.0f) {
    calibrationValue = eepromCal;
  }
  Serial.printf("Calibration value: %.3f\n", calibrationValue);

  LoadCell.start(STABILIZE_MS, true);
  if (LoadCell.getTareTimeoutFlag()) {
    Serial.println("❌ HX711 timeout, check wiring!");
    while (1) { delay(1000); }
  }
  
  LoadCell.setCalFactor(calibrationValue);
  for (int i = 0; i < 20; i++) {
    LoadCell.update();
    delay(20);
  }
  
  Serial.println("✅ HX711 ready");
  Serial.println("=== System Ready ===");
  Serial.println("Waiting for commands...");
}

// ======== Arduino Loop ========
void loop() {
  // 维护网络连接
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  // 检查等待重量超时
  unsigned long now = millis();
  if (waiting_for_weight && (now - weight_wait_start >= WEIGHT_TIMEOUT_MS)) {
    Serial.println("⚠️ Weight detection timeout!");
    publishLCD("Timeout: " + pending_animal_name + " not detected");
    publishWeightEnable(false);
    waiting_for_weight = false;
    target_animal_weight = 0.0f;
    pending_animal_name = "";
    pending_food_amount = 0.0f;
    weight_match_start = 0;
    weight_wait_start = 0;
  }

  // 采样 HX711
  static bool newDataReady = false;
  if (LoadCell.update()) newDataReady = true;

  // 发布重量数据（仅在 enabled 时）
  if (weight_detection_enabled && newDataReady && (now - lastPub >= PUBLISH_INTERVAL_MS)) {
    float weight = LoadCell.getData();     // 单位 g
    float weight_kg = weight / 1000.0;     // 转换为 kg
    
    // 发布 JSON: {"weight": "3.5"}
    StaticJsonDocument<64> jsonDoc;
    jsonDoc["weight"] = String(weight_kg, 3);  // 保留3位小数
    
    String payload;
    serializeJson(jsonDoc, payload);

    mqtt.publish(TOPIC_WEIGHT_SENSOR, payload.c_str());
    Serial.print("📤 Weight -> ");
    Serial.println(payload);

    lastPub = now;
    newDataReady = false;
  }

  delay(10);
}
