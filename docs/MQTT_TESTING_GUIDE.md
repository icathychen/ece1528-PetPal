# Testing MQTT Integration - Quick Guide

## ✅ MQTT Integration Complete!

Your scheduler is now publishing MQTT messages to trigger hardware motors when scheduled feeding times arrive.

## What Was Implemented

### 1. Backend Files Created/Modified:
- ✅ `backend/src/services/mqttService.js` - MQTT publisher service
- ✅ `backend/src/services/scheduler.js` - Integrated with MQTT
- ✅ `backend/src/index.js` - Initializes MQTT on startup
- ✅ `backend/package.json` - Added mqtt dependency

### 2. Hardware Files Created:
- ✅ `hardware/arduino_motor_controller.ino` - Arduino subscriber code
- ✅ `docs/MQTT_INTEGRATION.md` - Complete documentation

### 3. Logs Show Success:
```
🔌 Connecting to MQTT broker at mqtt://mqtt:1883...
✅ Connected to MQTT broker
⏰ Automatic feeding scheduler started
```

## How to Test

### Test 1: Add a Schedule for Current Time

```bash
# Get current time
date "+%H:%M:%S"

# Create schedule for 1 minute from now
# Example: If current time is 14:30:00, set schedule for 14:31:00
curl -X POST http://localhost:3001/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "animal_id": 1,
    "container_id": 1,
    "schedule_time": "19:47:00",
    "food_amount": 0.25
  }'
```

### Test 2: Watch Backend Logs

```bash
docker-compose logs -f backend
```

When the scheduled time arrives, you should see:
```
⏰ Checking for scheduled feedings at 14:31:00
🍽️ Found 1 scheduled feeding(s) to trigger
🎯 Triggering feeding for Whiskers (Container 1)
📤 Published to motor1: {command: "dispense", ...}
✅ Feeding triggered for Whiskers: 0.25kg dispensed
```

### Test 3: Subscribe to MQTT Messages

Open a new terminal and subscribe to motor topics:

```bash
# Subscribe to motor1 topic
docker-compose exec mqtt mosquitto_sub -h localhost -t motor1 -v

# Or subscribe to all topics
docker-compose exec mqtt mosquitto_sub -h localhost -t '#' -v
```

### Test 4: Manual Feeding (Immediate MQTT Trigger)

```bash
# Trigger manual feeding
curl -X POST http://localhost:3001/api/feeding/manual \
  -H "Content-Type: application/json" \
  -d '{
    "container_id": 1,
    "food_amount": 0.1
  }'
```

This should immediately publish an MQTT message.

## Message Format Your Hardware Will Receive

### Motor Control Message
```json
{
  "command": "dispense",
  "container_id": 1,
  "food_amount": 0.25,
  "animal_name": "Whiskers",
  "feeding_type": "scheduled",
  "timestamp": "2025-11-09T14:31:00.000Z",
  "status": "pending"
}
```

### LCD Display Message
```json
{
  "text": "Feeding Whiskers - 0.25kg",
  "timestamp": "2025-11-09T14:31:00.000Z"
}
```

## Arduino Setup

1. **Install Required Libraries** in Arduino IDE:
   - PubSubClient (for MQTT)
   - ArduinoJson (for JSON parsing)
   - WiFi (ESP32/ESP8266)

2. **Configure WiFi and MQTT** in `hardware/arduino_motor_controller.ino`:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   const char* mqtt_server = "YOUR_MQTT_BROKER_IP";  // e.g., "192.168.1.100"
   ```

3. **Get your MQTT broker IP**:
   ```bash
   # Get your machine's IP
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Or on Mac
   ipconfig getifaddr en0
   ```

4. **Upload to Arduino** and open Serial Monitor (115200 baud)

## Verification Checklist

- [x] Backend connects to MQTT broker
- [x] Scheduler checks every minute for scheduled feedings
- [x] MQTT messages published when feeding time arrives
- [ ] Arduino subscribes to motor topics
- [ ] Arduino receives and parses MQTT messages
- [ ] Motor dispenses food based on MQTT commands

## Next Steps for Your Team

### @Yilin - Pet Binding with Weight Sensor
Add MQTT publishing for weight detection:
```javascript
const { mqttService } = require('./services/mqttService');

// When starting pet binding
mqttService.publishWeightRequest(1);  // Request weight from sensor 1
```

### @Kevin - Manual Feeding
Your manual feeding API already has MQTT integration! Just use:
```javascript
await mqttService.publishMotorTrigger({
  container_id: req.body.container_id,
  food_amount: req.body.food_amount,
  feeding_type: 'manual'
});
```

### @Cathy - Your Scheduler ✅
Your part is DONE! The scheduler automatically publishes MQTT messages when scheduled feeding times arrive.

## Troubleshooting

### Backend can't connect to MQTT
```
⚠️ MQTT connection failed
```
**Solution**: Check if MQTT container is running:
```bash
docker-compose ps mqtt
docker-compose logs mqtt
```

### Arduino can't connect
**Solution**: 
1. Verify WiFi credentials
2. Check MQTT broker IP address
3. Ensure firewall allows port 1883
4. Try: `mosquitto_sub -h YOUR_IP -t test` from another machine

### Messages not triggering hardware
**Solution**:
1. Check Arduino Serial Monitor for messages
2. Verify Arduino subscribed to correct topic (motor1 or motor2)
3. Test with mosquitto_pub to send test message

## Useful Commands

```bash
# Health check (includes MQTT status)
curl http://localhost:3001/health | jq .

# View all schedules
curl http://localhost:3001/api/schedules | jq .

# Trigger manual scheduler check
curl -X POST http://localhost:3001/api/scheduler/trigger

# View MQTT logs
docker-compose logs -f mqtt

# Publish test message
docker-compose exec mqtt mosquitto_pub -h localhost -t motor1 -m '{"test":"message"}'
```

## Success! 🎉

Your scheduling functionality now triggers hardware via MQTT! When it's time for feeding:

1. ⏰ Scheduler detects scheduled time
2. 📡 Backend publishes MQTT message to motor topic
3. 🤖 Arduino receives message and dispenses food
4. 💡 LCD displays feeding status
5. 💾 Database logs the feeding event

Perfect for your Oct 31 deadline!
