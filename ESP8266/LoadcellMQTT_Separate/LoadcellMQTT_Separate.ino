#include <ESP8266WiFi.h>
#include <HX711_ADC.h>
#include <EEPROM.h>
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

WiFiClient espClient;
PubSubClient mqtt(espClient);

// ======== HX711 配置 ========
const int HX711_DOUT = D5;
const int HX711_SCK  = D6;
HX711_ADC LoadCell(HX711_DOUT, HX711_SCK);

const int   CAL_EEPROM_ADDR = 0;
float       calibrationValue = 348.36;
const unsigned long STABILIZE_MS = 2000;
const unsigned long PUBLISH_INTERVAL_MS = 500;

// ======== 全局状态 ========
unsigned long lastPub = 0;
bool weight_detection_enabled = false;

// ======== MQTT 回调 ========
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

  if (topicStr == TOPIC_WEIGHT_ENABLE) {
    StaticJsonDocument<128> doc;
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
    String cid = "loadcell-" + String(ESP.getChipId(), HEX);
    Serial.print("Connecting to MQTT... ");
    
    if (mqtt.connect(cid.c_str())) {
      Serial.println("connected!");
      mqtt.subscribe(TOPIC_WEIGHT_ENABLE);
      Serial.print("Subscribed to: ");
      Serial.println(TOPIC_WEIGHT_ENABLE);
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
  Serial.println("\n\n=== LoadCell Weight Sensor ===");

  ensureWifi();
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
  Serial.printf("Calibration: %.3f\n", calibrationValue);

  LoadCell.start(STABILIZE_MS, true);
  if (LoadCell.getTareTimeoutFlag()) {
    Serial.println("❌ HX711 timeout!");
    while (1) { delay(1000); }
  }
  
  LoadCell.setCalFactor(calibrationValue);
  for (int i = 0; i < 20; i++) {
    LoadCell.update();
    delay(20);
  }
  
  Serial.println("✅ HX711 ready");
}

void loop() {
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  static bool newDataReady = false;
  if (LoadCell.update()) newDataReady = true;

  unsigned long now = millis();
  if (weight_detection_enabled && newDataReady && (now - lastPub >= PUBLISH_INTERVAL_MS)) {
    float weight = LoadCell.getData();
    float weight_kg = weight / 1000.0;
    
    StaticJsonDocument<64> jsonDoc;
    jsonDoc["weight"] = String(weight_kg, 3);
    
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
