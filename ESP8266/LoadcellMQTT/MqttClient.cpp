#include "MqttClient.h"
#include <MQTT.h>
#include <ESP8266WiFi.h>

WiFiClient _wifi_client;
String _msg;
String _topic;
// 🔴 删掉这一行全局变量，否则会遮蔽类成员
// int _num_subscribe_topics;

static void callback(String &topic, String &payload) {
  _msg = payload;
  _topic = topic;
}

// --- 构造1：不带订阅列表 ---
MqttClient::MqttClient(const char *mqtt_broker_ip, const int mqtt_broker_port) {
  // ✅ 用上端口
  _mqtt_client.begin(mqtt_broker_ip, mqtt_broker_port, _wifi_client);
  _mqtt_client.setKeepAlive(30);
  _mqtt_client.setCleanSession(true);
  _mqtt_client.onMessage(callback);

  // 初始化成员
  _subscribe_topics = nullptr;
  _num_subscribe_topics = 0;
}

// --- 构造2：带订阅列表 ---
MqttClient::MqttClient(const char *mqtt_broker_ip, const int mqtt_broker_port,
                       String *subscribe_topics, const int num_subscribe_topics) {
  // ✅ 用上端口
  _mqtt_client.begin(mqtt_broker_ip, mqtt_broker_port, _wifi_client);
  _mqtt_client.setKeepAlive(30);
  _mqtt_client.setCleanSession(true);
  _mqtt_client.onMessage(callback);

  // ✅ 赋值到“类成员”
  this->_subscribe_topics = subscribe_topics;
  this->_num_subscribe_topics = num_subscribe_topics;
}

void MqttClient::connect(const char *client_id) {
  Serial.print("Connecting to MQTT broker... ");
  while (!_mqtt_client.connect(client_id)) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("done!");

  // 连接后统一订阅
  for (int i = 0; i < this->_num_subscribe_topics; i++) {
    const String &t = this->_subscribe_topics[i];
    if (_mqtt_client.subscribe(t)) {
      Serial.println("Subscribed to topic: " + t);
    } else {
      Serial.println("Subscribe failed: " + t);
    }
  }
}

void MqttClient::publish_message(const char *topic, const char *msg) {
  if (!_mqtt_client.connected()) return;
  _mqtt_client.publish(topic, msg);
  Serial.println("Message published [ " + String(topic) + " ]: " + String(msg));
}

void MqttClient::check_connection(const char *client_id) {
  _mqtt_client.loop();
  // delay(10);  // 可要可不要
  if (!_mqtt_client.connected()) {
    Serial.println("MQTT disconnected, reconnecting...");
    connect(client_id);
  }
}

String MqttClient::get_msg()   { return _msg;   }
String MqttClient::get_topic() { return _topic; }

void MqttClient::reset_msg() {
  _msg = "";
  _topic = "";
}
