 #include "MqttClient.h"
 #include <ESP8266WiFi.h>

 char *ssid_wifi = "addr"; //use your own
 char *pass_wifi = "passwd"; //use your own

 const char *mqtt_broker_ip = "";//ipconfig Wireless LAN adapter Wi-Fi: IPv4 Address. . . . . . . . . . . : //use your own
 const int mqtt_broker_port = 1883;
 const char *client_id = "subscriber";//change
 const int num_subscribe_topics = 1;
 String subscribe_topics[num_subscribe_topics] = {"petpal/test"};//change
 const char *publish_topic = "";
 
 WifiClient wifi_client(ssid_wifi, pass_wifi);
 MqttClient mqtt_client(mqtt_broker_ip, mqtt_broker_port, subscribe_topics, num_subscribe_topics);

String last_message = "";



void setup() {
  // put your setup code here, to run once:
  Serial.begin(9600);
  wifi_client.connect();
  mqtt_client.connect(client_id);

}

void loop() {
  // put your main code here, to run repeatedly:
  mqtt_client.check_connection(client_id);
  String received_msg = mqtt_client.get_msg(); // get msg

  if (received_msg.length() > 0) {  // if received
    if (received_msg != last_message) {  // if changed
      Serial.print("Received modified message: ");
      Serial.println(received_msg);
      last_message = received_msg; // update last message
    }
  }

  delay(500);
}