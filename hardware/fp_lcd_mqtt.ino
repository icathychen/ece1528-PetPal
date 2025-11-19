// WeMos D1 R1 (ESP8266) — Subscribe topic "lcd" and print {"text":"..."} on LCD
// Libraries: ESP8266WiFi (board package), PubSubClient, ArduinoJson, hd44780

#include <ESP8266WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>

#define SDA_PIN D4   // GPIO2
#define SCL_PIN D3   // GPIO0

// ---- your network ----
const char* WIFI_SSID = "tayal";
const char* WIFI_PASS = "53EF3D4D";
const char* MQTT_HOST = "10.0.0.77";   // Raspberry Pi IP
const uint16_t MQTT_PORT = 1883;
const char* TOPIC_LCD = "lcd";

hd44780_I2Cexp lcd;

WiFiClient net;
PubSubClient mqtt(net);
unsigned long lastTry = 0;

static void lcdPrint16x2(const char* text) {
  lcd.clear();
  String s(text);
  int nl = s.indexOf('\n');
  if (nl >= 0) {
    String a = s.substring(0, nl);     if (a.length() > 16) a.remove(16);
    String b = s.substring(nl + 1);    if (b.length() > 16) b.remove(16);
    lcd.setCursor(0,0); lcd.print(a);
    lcd.setCursor(0,1); lcd.print(b);
    return;
  }
  int cut = min(16, (int)s.length());
  int sp  = s.lastIndexOf(' ', 16);    if (sp >= 0) cut = sp;  // 尽量按词换行
  String a = s.substring(0, cut);
  String b = (cut < (int)s.length()) ? s.substring(cut + (s[cut]==' ' ? 1 : 0)) : "";
  if (b.length() > 16) b.remove(16);
  lcd.setCursor(0,0); lcd.print(a);
  lcd.setCursor(0,1); lcd.print(b);
}

void onMqtt(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, len);
  if (err) { lcdPrint16x2("JSON parse error"); return; }
  const char* txt = doc["text"] | "";
  if (!*txt) { lcdPrint16x2("No 'text' field"); return; }
  lcdPrint16x2(txt);
}

void wifiEnsure() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(300); yield(); }
}

void mqttEnsure() {
  if (mqtt.connected()) return;
  if (millis() - lastTry < 1500) return;
  lastTry = millis();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqtt);
  String cid = String("lcd-d1r1-") + String(millis(), HEX);
  if (mqtt.connect(cid.c_str())) {
    mqtt.subscribe(TOPIC_LCD);
    // hello
    StaticJsonDocument<64> d; d["text"] = "LCD online (D1 R1)";
    char buf[64]; size_t n = serializeJson(d, buf);
    mqtt.publish(TOPIC_LCD, buf, n);
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(SDA_PIN, SCL_PIN);

  int status = lcd.begin(16, 2);
  if (status) { Serial.printf("LCD init error: 0x%02X\n", status); }
  lcd.backlight();
  lcdPrint16x2("Connecting WiFi");

  wifiEnsure();
  lcdPrint16x2("WiFi OK\nSubscribing...");
  mqttEnsure();
}

void loop() {
  wifiEnsure();
  mqttEnsure();
  mqtt.loop();
  yield();
}


