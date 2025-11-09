# MQTT Integration for PetPal Scheduling

## Overview
This document explains how the MQTT publisher/subscriber system works for triggering hardware feeding when scheduled times arrive.

## Architecture

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Scheduler     │ ────────▶│ MQTT Broker  │ ────────▶│ Arduino Motor   │
│   (Backend)     │  Publish │  (Eclipse    │ Subscribe│  Controller     │
│   Publisher     │          │   Mosquitto) │          │  (Hardware)     │
└─────────────────┘         └──────────────┘         └─────────────────┘
        │                                                      │
        │ Every minute checks schedule                        │
        │ Publishes to motor1/motor2 topic                    │
        └──────────────────────────────────────────────────────┘
                    Hardware dispenses food
```

## MQTT Topics

### Published by Backend (Scheduler):
- **`motor1`** - Commands for motor 1 (container 1)
- **`motor2`** - Commands for motor 2 (container 2)
- **`lcd`** - Display messages for LCD screen

### Message Format:

#### Motor Control Message
```json
{
  "command": "dispense",
  "container_id": 1,
  "food_amount": 0.25,
  "animal_name": "Whiskers",
  "feeding_type": "scheduled",
  "timestamp": "2025-11-09T10:30:00.000Z",
  "status": "pending"
}
```

#### LCD Display Message
```json
{
  "text": "Feeding Whiskers - 0.25kg",
  "timestamp": "2025-11-09T10:30:00.000Z"
}
```

## How It Works

### 1. Scheduler Checks Time
Every minute, the feeding scheduler checks if any pets have scheduled feedings:

```javascript
// In backend/src/services/scheduler.js
async checkScheduledFeedings() {
  const currentTime = new Date().toTimeString().slice(0, 8);
  const currentSchedules = await dbService.getCurrentSchedules();
  
  for (const schedule of currentSchedules) {
    await this.triggerFeedingForSchedule(schedule);
  }
}
```

### 2. MQTT Message Published
When a scheduled feeding time arrives, the backend publishes an MQTT message:

```javascript
// Backend publishes to motor topic
await mqttService.publishMotorTrigger({
  container_id: 1,
  food_amount: 0.25,
  animal_name: "Whiskers",
  feeding_type: "scheduled"
});
```

### 3. Arduino Subscribes and Receives
Arduino hardware subscribes to the motor topic and receives the message:

```cpp
// Arduino subscribes to motor1 topic
client.subscribe("motor1");

// Callback receives message
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  // Parse JSON and dispense food
  dispense_food(food_amount);
}
```

## Setup Instructions

### Backend Setup

1. **Install MQTT Package** (Already in package.json):
```bash
cd backend
npm install mqtt@^5.3.0
```

2. **Configure MQTT Broker** in `.env`:
```env
MQTT_BROKER_URL=mqtt://mqtt:1883
```

3. **Services are Auto-Started**:
   - MQTT service connects on server startup
   - Scheduler starts checking every minute
   - Messages are published automatically

### Hardware Setup (Arduino)

1. **Required Libraries**:
   - WiFi (ESP32/ESP8266)
   - PubSubClient (MQTT client)
   - ArduinoJson (JSON parsing)

2. **Install Libraries** in Arduino IDE:
   - Tools → Manage Libraries
   - Search and install: "PubSubClient" and "ArduinoJson"

3. **Configure Arduino**:
   Edit `hardware/arduino_motor_controller.ino`:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* mqtt_server = "YOUR_MQTT_BROKER_IP";
   ```

4. **Upload to Arduino**:
   - Select correct board (ESP32/ESP8266)
   - Select correct port
   - Upload sketch

## Testing the Integration

### 1. Test Backend MQTT Publishing

Start your backend and check logs:
```bash
docker-compose logs -f backend
```

You should see:
```
📡 MQTT service initialized
✅ Connected to MQTT broker
⏰ Checking for scheduled feedings at 10:30:00
📤 Published to motor1: {command: "dispense", ...}
```

### 2. Test with MQTT Client

Use `mosquitto_sub` to listen for messages:
```bash
# Subscribe to motor1 topic
mosquitto_sub -h localhost -t motor1 -v

# You'll see messages like:
motor1 {"command":"dispense","container_id":1,"food_amount":0.25,...}
```

### 3. Manually Trigger a Test

```bash
# Trigger manual feeding via API
curl -X POST http://localhost:3001/api/feeding/manual \
  -H "Content-Type: application/json" \
  -d '{
    "container_id": 1,
    "food_amount": 0.1
  }'
```

### 4. Monitor Arduino Serial Output

Open Arduino Serial Monitor (115200 baud):
```
✅ WiFi connected!
✅ MQTT connected!
📥 Subscribed to: motor1
📩 Message received on topic: motor1
🎯 Dispensing food...
   Animal: Whiskers
   Amount: 0.25 kg
✅ Dispensing complete!
```

## Manual API Endpoints

### Trigger Manual Feeding
```bash
POST http://localhost:3001/api/feeding/manual
{
  "container_id": 1,
  "food_amount": 0.25
}
```

This will:
1. Update database
2. Publish MQTT message to motor
3. Return success response

### Check Scheduler Status
```bash
GET http://localhost:3001/api/scheduler/status
```

Returns:
```json
{
  "success": true,
  "scheduler": {
    "isRunning": true,
    "checkInterval": 60000,
    "nextCheck": "2025-11-09T10:31:00.000Z"
  }
}
```

## Troubleshooting

### Backend Can't Connect to MQTT
```
⚠️ MQTT connection failed: connect ECONNREFUSED
```

**Solution**: 
- Ensure MQTT broker (mosquitto) is running
- Check `docker-compose ps` to verify mqtt service
- Verify MQTT_BROKER_URL in .env

### Arduino Not Receiving Messages
```
MQTT connection failed, rc=-2
```

**Solution**:
- Check WiFi credentials
- Verify MQTT broker IP address
- Ensure broker allows anonymous connections
- Check network firewall settings

### Messages Published but Motor Not Responding

**Check**:
1. Arduino is subscribed to correct topic (motor1 or motor2)
2. JSON parsing is working (check Serial Monitor)
3. Motor pins are correctly configured
4. Motor power supply is connected

## Integration with Your Team

### @Yilin - Weight Sensor
When pet binding starts, publish to `weightSensor1` topic:
```javascript
mqttService.publish('weightSensor1', {
  command: 'measure',
  container_id: 1
});
```

### @Kevin - Manual Feeding
Your manual feeding API should publish motor commands:
```javascript
await mqttService.publishMotorTrigger({
  container_id: req.body.container_id,
  food_amount: req.body.food_amount,
  feeding_type: 'manual'
});
```

### @Cathy - Scheduling (You!)
Your scheduler is now publishing MQTT messages automatically when scheduled times arrive. Check `backend/src/services/scheduler.js` - the integration is complete!

## Next Steps

1. ✅ Backend MQTT service created
2. ✅ Scheduler integrated with MQTT
3. ✅ Arduino example code provided
4. 🔲 Test with real hardware
5. 🔲 Calibrate motor steps per kg
6. 🔲 Add LCD display code
7. 🔲 Implement weight sensor responses

## Questions?

- Backend MQTT: Check `backend/src/services/mqttService.js`
- Scheduler Integration: Check `backend/src/services/scheduler.js`
- Arduino Code: Check `hardware/arduino_motor_controller.ino`
- API Routes: Check `backend/src/routes/api.js`
