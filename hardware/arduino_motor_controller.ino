/*
 * PetPal Hardware - Motor Controller with MQTT
 * Arduino code for receiving motor control commands via MQTT
 * 
 * Hardware Setup:
 * - ESP32/ESP8266 board with WiFi
 * - Stepper motor or servo motor for food dispensing
 * - LCD display (optional)
 * - Weight sensors
 * 
 * Topics:
 * - motor1: Motor 1 control commands
 * - motor2: Motor 2 control commands
 * - lcd: LCD display messages
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker settings
const char* mqtt_server = "YOUR_MQTT_BROKER_IP";  // e.g., "192.168.1.100"
const int mqtt_port = 1883;
const char* mqtt_client_id = "petpal_motor1";  // Change for motor2

// MQTT Topics
const char* motor_topic = "motor1";  // Change to "motor2" for second motor
const char* lcd_topic = "lcd";
const char* response_topic = "motor1/response";  // For sending responses back

// Motor pins (adjust based on your hardware)
const int MOTOR_STEP_PIN = 5;
const int MOTOR_DIR_PIN = 18;
const int MOTOR_ENABLE_PIN = 19;

// Create WiFi and MQTT clients
WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🐾 PetPal Motor Controller Starting...");
  
  // Initialize motor pins
  pinMode(MOTOR_STEP_PIN, OUTPUT);
  pinMode(MOTOR_DIR_PIN, OUTPUT);
  pinMode(MOTOR_ENABLE_PIN, OUTPUT);
  digitalWrite(MOTOR_ENABLE_PIN, HIGH); // Disable motor initially
  
  // Connect to WiFi
  setup_wifi();
  
  // Configure MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqtt_callback);
  
  Serial.println("✅ Setup complete!");
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("✅ WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("📩 Message received on topic: ");
  Serial.println(topic);
  
  // Convert payload to string
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("Message: ");
  Serial.println(message);
  
  // Parse JSON message
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.print("❌ JSON parsing failed: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Check if this is a motor command
  if (strcmp(topic, motor_topic) == 0) {
    handle_motor_command(doc);
  }
  else if (strcmp(topic, lcd_topic) == 0) {
    handle_lcd_command(doc);
  }
}

void handle_motor_command(JsonDocument& doc) {
  const char* command = doc["command"];
  
  if (strcmp(command, "dispense") == 0) {
    float food_amount = doc["food_amount"];
    const char* animal_name = doc["animal_name"];
    const char* feeding_type = doc["feeding_type"];
    
    Serial.println("🎯 Dispensing food...");
    Serial.print("   Animal: ");
    Serial.println(animal_name);
    Serial.print("   Amount: ");
    Serial.print(food_amount);
    Serial.println(" kg");
    Serial.print("   Type: ");
    Serial.println(feeding_type);
    
    // DISPENSE FOOD
    dispense_food(food_amount);
    
    // Send response back
    send_response("completed", food_amount);
    
    Serial.println("✅ Dispensing complete!");
  }
}

void handle_lcd_command(JsonDocument& doc) {
  const char* text = doc["text"];
  
  Serial.print("💡 LCD Display: ");
  Serial.println(text);
  
  // TODO: Add your LCD display code here
  // lcd.clear();
  // lcd.print(text);
}

void dispense_food(float amount_kg) {
  // Convert kg to motor steps
  // Adjust this calibration based on your motor and dispenser mechanism
  int steps_per_kg = 1000;  // CALIBRATE THIS VALUE
  int total_steps = (int)(amount_kg * steps_per_kg);
  
  Serial.print("   Motor steps: ");
  Serial.println(total_steps);
  
  // Enable motor
  digitalWrite(MOTOR_ENABLE_PIN, LOW);
  digitalWrite(MOTOR_DIR_PIN, HIGH);  // Forward direction
  
  // Rotate motor
  for(int i = 0; i < total_steps; i++) {
    digitalWrite(MOTOR_STEP_PIN, HIGH);
    delayMicroseconds(1000);  // Adjust speed
    digitalWrite(MOTOR_STEP_PIN, LOW);
    delayMicroseconds(1000);
  }
  
  // Disable motor
  digitalWrite(MOTOR_ENABLE_PIN, HIGH);
  
  delay(500);  // Let motor settle
}

void send_response(const char* status, float amount) {
  StaticJsonDocument<128> doc;
  doc["status"] = status;
  doc["amount_dispensed"] = amount;
  doc["timestamp"] = millis();
  
  String output;
  serializeJson(doc, output);
  
  client.publish(response_topic, output.c_str());
  Serial.print("📤 Response sent: ");
  Serial.println(output);
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    if (client.connect(mqtt_client_id)) {
      Serial.println(" connected!");
      
      // Subscribe to motor topic
      client.subscribe(motor_topic);
      Serial.print("📥 Subscribed to: ");
      Serial.println(motor_topic);
      
      // Subscribe to LCD topic
      client.subscribe(lcd_topic);
      Serial.print("📥 Subscribed to: ");
      Serial.println(lcd_topic);
      
    } else {
      Serial.print(" failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void loop() {
  // Maintain MQTT connection
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Your other code here (weight sensors, etc.)
}
