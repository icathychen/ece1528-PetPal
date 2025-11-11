#include <ESP8266WiFi.h>
#include <HX711_ADC.h>
#include "MqttClient.h"
#include <EEPROM.h>
#include <ArduinoJson.h>

// ======== Wi-Fi & MQTT 配置 ========
char ssid_wifi[] = "Rogers";
char pass_wifi[] = "adminkentish30";

const char* MQTT_HOST = "10.0.0.108";   // 你的电脑IP（ipconfig 查到的 Wi-Fi IPv4）
const int   MQTT_PORT = 1883;           // Mosquitto TCP 端口

// 发布重量数据到 weightSensor1 (JSON格式)
const char* PUB_TOPIC = "weightSensor1";

// 订阅 weightEnable 接收 {"enable": true/false} 控制
const int NUM_SUB_TOPICS = 1;
String SUB_TOPICS[NUM_SUB_TOPICS] = { "weightEnable" };

// ======== HX711 接线 & 校准 ========
const int HX711_DOUT = D12;   // D12
const int HX711_SCK  = D13;   // D13
HX711_ADC LoadCell(HX711_DOUT, HX711_SCK);

const int   CAL_EEPROM_ADDR = 0;
float       calibrationValue = 300;   // 你之前用的值；建议校准后再写
const unsigned long STABILIZE_MS = 2000; // 上电稳定时间
const unsigned long PUBLISH_INTERVAL_MS = 500; // 发布间隔 500ms

// ======== 你的封装类 ========
WifiClient wifi_client(ssid_wifi, pass_wifi);
MqttClient mqtt_client(MQTT_HOST, MQTT_PORT, SUB_TOPICS, NUM_SUB_TOPICS);

unsigned long lastPub = 0;
bool weight_detection_enabled = false;  // 重量检测开关（默认关闭，必须收到enable才发布）
String last_received_msg = "";          // 记录上次消息，避免重复处理

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n\n=== ESP8266 Weight Sensor Starting ===");

  // 1) 连 Wi-Fi
  wifi_client.connect();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());

  // 2) 连接 MQTT（client_id 建议唯一）
  String cid = "esp8266-" + String(ESP.getChipId(), HEX);
  mqtt_client.connect(cid.c_str());
  Serial.println("MQTT connected and subscribed to: weightEnable");

  // 3) HX711 初始化
  LoadCell.begin();
  #if defined(ESP8266)|| defined(ESP32)
    EEPROM.begin(512);
  #endif
  float eepromCal = NAN;
  EEPROM.get(CAL_EEPROM_ADDR, eepromCal);
  if (isfinite(eepromCal) && eepromCal > 0.1f && eepromCal < 100000.0f) {
    calibrationValue = eepromCal;
  }
  Serial.printf("Calibration value in use: %.3f\n", calibrationValue);

  LoadCell.start(STABILIZE_MS, true);
  if (LoadCell.getTareTimeoutFlag()) {
    Serial.println("HX711 timeout, check wiring!");
    while (1) { delay(1000); }
  }
  LoadCell.setCalFactor(calibrationValue);
  for (int i=0; i<20; i++) { LoadCell.update(); delay(20); }
  Serial.println("HX711 ready");
  Serial.println("=== Waiting for enable command... ===");
  Serial.println("Weight detection is DISABLED by default.");
}

void loop() {
  // 维护 MQTT 连接
  String cid = "esp8266-" + String(ESP.getChipId(), HEX);
  mqtt_client.check_connection(cid.c_str());

  // 处理接收到的 MQTT 消息
  String rx = mqtt_client.get_msg();
  if (rx.length() > 0 && rx != last_received_msg) {
    Serial.print("RX  <- weightEnable :: ");
    Serial.println(rx);
    
    // 解析 JSON: {"enable": true} 或 {"enable": false}
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, rx);
    
    if (!error && doc.containsKey("enable")) {
      bool new_state = doc["enable"];
      
      // 只在状态变化时打印
      if (new_state != weight_detection_enabled) {
        weight_detection_enabled = new_state;
        Serial.println("========================================");
        Serial.print("Weight detection ");
        Serial.println(weight_detection_enabled ? "ENABLED ✅" : "DISABLED ❌");
        Serial.println("========================================");
      }
    } else if (error) {
      Serial.print("JSON parse error: ");
      Serial.println(error.c_str());
    }
    
    last_received_msg = rx;
    mqtt_client.reset_msg();
  }

  // 采样 HX711
  static bool newDataReady = false;
  if (LoadCell.update()) newDataReady = true;

  // ⚠️ 重要：只在 weight_detection_enabled = true 时才发布数据
  unsigned long now = millis();
  if (weight_detection_enabled && newDataReady && (now - lastPub >= PUBLISH_INTERVAL_MS)) {
    float weight = LoadCell.getData();  // 单位由校准决定（按 g）
    float weight_kg = weight / 1000.0;  // 转换为 kg
    
    // 发布最简 JSON: {"weight": "3.5"}
    StaticJsonDocument<64> jsonDoc;
    jsonDoc["weight"] = String(weight_kg, 1);  // 保留1位小数
    
    String payload;
    serializeJson(jsonDoc, payload);

    mqtt_client.publish_message(PUB_TOPIC, payload.c_str());
    Serial.print("📤 PUB -> ");
    Serial.print(PUB_TOPIC);
    Serial.print(" :: ");
    Serial.println(payload);

    lastPub = now;
    newDataReady = false;
  }

  delay(10);
}
