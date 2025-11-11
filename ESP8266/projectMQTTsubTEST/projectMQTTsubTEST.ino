 #include "MqttClient.h"
 #include <ESP8266WiFi.h>
 #include <ArduinoJson.h>

 char *ssid_wifi = "addr"; //use your own
 char *pass_wifi = "passwd"; //use your own

 const char *mqtt_broker_ip = "";//ipconfig Wireless LAN adapter Wi-Fi: IPv4 Address. . . . . . . . . . . : //use your own
 const int mqtt_broker_port = 1883;
 const char *client_id = "esp8266_weight_sensor";//change
 const int num_subscribe_topics = 1;
 String subscribe_topics[num_subscribe_topics] = {"weightEnable"};//change - subscribe to weight enable topic
 const char *publish_topic = "weightSensor1"; // publish weight data
 
 WifiClient wifi_client(ssid_wifi, pass_wifi);
 MqttClient mqtt_client(mqtt_broker_ip, mqtt_broker_port, subscribe_topics, num_subscribe_topics);

String last_message = "";
bool weight_detection_enabled = false;

// Simulated weight sensor reading (replace with actual sensor code)
float readWeightSensor() {
  // TODO: Replace with actual weight sensor (HX711) reading
  // Example: return scale.get_units(10);
  return random(10, 50) / 10.0; // Random weight between 1.0 - 5.0 kg for testing
}

void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  wifi_client.connect();
  mqtt_client.connect(client_id);
  
  randomSeed(analogRead(0)); // Initialize random seed for testing
}

void loop() {
  // put your main code here, to run repeatedly:
  mqtt_client.check_connection(client_id);
  String received_msg = mqtt_client.get_msg(); // get msg

  if (received_msg.length() > 0) {  // if received
    if (received_msg != last_message) {  // if changed
      Serial.print("Received message: ");
      Serial.println(received_msg);
      
      // Parse JSON message: {"enable": true} or {"enable": false}
      StaticJsonDocument<200> doc;
      DeserializationError error = deserializeJson(doc, received_msg);
      
      if (!error) {
        if (doc.containsKey("enable")) {
          weight_detection_enabled = doc["enable"];
          Serial.print("Weight detection ");
          Serial.println(weight_detection_enabled ? "ENABLED" : "DISABLED");
        }
      } else {
        Serial.print("JSON parse error: ");
        Serial.println(error.c_str());
      }
      
      last_message = received_msg; // update last message
    }
  }

  // If weight detection is enabled, read and publish weight data
  if (weight_detection_enabled) {
    float weight = readWeightSensor();
    
    // Create JSON message: {"weight": "3.5"}
    StaticJsonDocument<200> jsonDoc;
    jsonDoc["weight"] = String(weight, 1); // 1 decimal place
    
    String jsonString;
    serializeJson(jsonDoc, jsonString);
    
    // Publish to weightSensor1 topic
    mqtt_client.publish(publish_topic, jsonString.c_str());
    
    Serial.print("Published weight: ");
    Serial.println(jsonString);
    
    delay(500); // Publish every 500ms when enabled
  } else {
    delay(100); // Short delay when disabled
  }
}