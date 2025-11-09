# Complete Scheduler Testing Guide (No Hardware Required)

## Overview
Test your scheduling system end-to-end by watching MQTT messages and backend logs. No Arduino needed!

---

## 🎯 Test 1: Manual Trigger (Immediate MQTT Publish)

This tests if your backend can publish MQTT messages on demand.

### Step 1: Open MQTT Subscriber Terminal
Open a new terminal and subscribe to motor topics:

```bash
cd /Users/cathychen/Developer/ece1528-PetPal
docker-compose exec mqtt mosquitto_sub -h localhost -t '#' -v
```

**What this does:** Listens to ALL MQTT topics and displays messages in real-time.

**Keep this terminal open!** You'll see MQTT messages appear here.

---

### Step 2: Open Backend Logs Terminal
Open another terminal to watch backend logs:

```bash
cd /Users/cathychen/Developer/ece1528-PetPal
docker-compose logs -f backend
```

**What this does:** Shows you what the backend is doing in real-time.

**Keep this terminal open too!**

---

### Step 3: Trigger Manual Feeding
Open a third terminal and run:

```bash
curl -X POST http://localhost:3001/api/feeding/manual \
  -H "Content-Type: application/json" \
  -d '{
    "container_id": 1,
    "food_amount": 0.25
  }'
```

### What You Should See:

**In Terminal 1 (MQTT Subscriber):**
```
motor1 {"command":"dispense","container_id":1,"food_amount":0.25,"animal_name":"Whiskers","feeding_type":"manual","timestamp":"2025-11-09T19:30:00.000Z","status":"pending"}

lcd {"text":"Feeding Whiskers - 0.25kg","timestamp":"2025-11-09T19:30:00.000Z"}
```

**In Terminal 2 (Backend Logs):**
```
📤 Published to motor1: { command: 'dispense', container_id: 1, food_amount: 0.25, ... }
📤 Published to lcd: { text: 'Feeding Whiskers - 0.25kg', ... }
✅ Manual feeding triggered successfully
```

**In Terminal 3 (curl response):**
```json
{
  "success": true,
  "message": "Manual feeding triggered successfully",
  "logEntry": {
    "id": 5,
    "animal_id": 1,
    "container_id": 1,
    "food_portion": 0.25,
    "feeding_type": "manual"
  }
}
```

### ✅ What This Proves:
- Backend can publish to MQTT ✓
- Manual trigger works ✓
- Messages reach MQTT broker ✓
- Database logs the feeding ✓

---

## 🕐 Test 2: Scheduled Trigger (Automatic MQTT Publish)

This tests if your scheduler automatically publishes MQTT messages when scheduled time arrives.

### Step 1: Check Current Time
```bash
date "+%H:%M:%S"
```

Example output: `19:45:30`

### Step 2: Calculate Schedule Time
Add 2 minutes to current time.
- Current time: `19:45:30`
- Schedule time: `19:47:00` (2 minutes later)

### Step 3: Create a Schedule
```bash
# Replace 19:47:00 with your calculated time!
curl -X POST http://localhost:3001/api/schedules \
  -H "Content-Type: application/json" \
  -d '{
    "animal_id": 1,
    "container_id": 1,
    "schedule_time": "19:47:00",
    "food_amount": 0.30
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Feeding schedule created successfully",
  "schedule": {
    "id": 10,
    "animal_id": 1,
    "container_id": 1,
    "schedule_time": "19:47:00",
    "food_amount": 0.30,
    "is_active": true
  }
}
```

### Step 4: Verify Schedule Was Created
```bash
curl http://localhost:3001/api/schedules | jq '.'
```

Look for your schedule in the list.

### Step 5: Watch and Wait
Keep your two terminals open:
- **Terminal 1**: MQTT Subscriber (mosquitto_sub)
- **Terminal 2**: Backend Logs (docker-compose logs -f backend)

### Step 6: Watch Scheduler Check Every Minute

**In Backend Logs, you'll see every minute:**
```
⏰ Checking for scheduled feedings at 19:45:00
📅 No scheduled feedings found for current time

⏰ Checking for scheduled feedings at 19:46:00
📅 No scheduled feedings found for current time

⏰ Checking for scheduled feedings at 19:47:00
🍽️ Found 1 scheduled feeding(s) to trigger
🎯 Triggering feeding for Whiskers (Container 1)
```

### What You Should See When Time Arrives:

**In Terminal 1 (MQTT Subscriber):**
```
motor1 {"command":"dispense","container_id":1,"food_amount":0.3,"animal_name":"Whiskers","feeding_type":"scheduled","timestamp":"2025-11-09T19:47:00.000Z","status":"pending"}

lcd {"text":"Feeding Whiskers - 0.3kg","timestamp":"2025-11-09T19:47:00.000Z"}
```

**In Terminal 2 (Backend Logs):**
```
⏰ Checking for scheduled feedings at 19:47:00
🍽️ Found 1 scheduled feeding(s) to trigger
🎯 Triggering feeding for Whiskers (Container 1)
📤 Published to motor1: { command: 'dispense', container_id: 1, food_amount: 0.3, ... }
📤 Published to lcd: { text: 'Feeding Whiskers - 0.3kg', ... }
✅ Feeding triggered for Whiskers: 0.3kg dispensed
📡 MQTT messages published to motor1 topic
```

### ✅ What This Proves:
- Scheduler runs every minute ✓
- Scheduler queries database for schedules ✓
- Scheduler publishes MQTT at correct time ✓
- Database logs automatic feeding ✓

---

## 📊 Test 3: Verify Database Logs

After triggering feedings (manual or scheduled), check the database:

```bash
docker-compose exec -T database psql -U petpal_user -d petpal_db -c "SELECT * FROM log_entries ORDER BY dispense_time DESC LIMIT 5;"
```

**You should see:**
```
 id | animal_id | container_id |       dispense_time        | food_portion | feeding_type 
----+-----------+--------------+----------------------------+--------------+--------------
  6 |         1 |            1 | 2025-11-09 19:47:00        |         0.30 | scheduled
  5 |         1 |            1 | 2025-11-09 19:30:15        |         0.25 | manual
```

---

## 🔍 Understanding the Flow

### Manual Trigger Flow:
```
1. You send HTTP POST → http://localhost:3001/api/feeding/manual
                           ↓
2. Backend receives request → backend/src/routes/api.js
                           ↓
3. Creates log entry      → dbService.createLogEntry()
                           ↓
4. Publishes MQTT message → mqttService.publishMotorTrigger()
                           ↓
5. MQTT Broker receives   → Eclipse Mosquitto (port 1883)
                           ↓
6. You see message in     → mosquitto_sub terminal
```

### Scheduled Trigger Flow:
```
1. Scheduler runs every minute → backend/src/services/scheduler.js
                           ↓
2. Gets current time      → "19:47:00"
                           ↓
3. Queries database       → dbService.getCurrentSchedules()
                           ↓
4. Finds matching schedule → schedule_time = "19:47:00"
                           ↓
5. Creates log entry      → dbService.createLogEntry()
                           ↓
6. Publishes MQTT message → mqttService.publishMotorTrigger()
                           ↓
7. MQTT Broker receives   → Eclipse Mosquitto
                           ↓
8. You see message in     → mosquitto_sub terminal
```

---

## 🧪 Test 4: Multiple Schedules

Test with multiple pets feeding at the same time:

```bash
# Get current time
CURRENT_TIME=$(date -v+2M "+%H:%M:00")
echo "Setting schedules for: $CURRENT_TIME"

# Schedule for Whiskers (Container 1)
curl -X POST http://localhost:3001/api/schedules \
  -H "Content-Type: application/json" \
  -d "{
    \"animal_id\": 1,
    \"container_id\": 1,
    \"schedule_time\": \"$CURRENT_TIME\",
    \"food_amount\": 0.25
  }"

# Schedule for Buddy (Container 2)
curl -X POST http://localhost:3001/api/schedules \
  -H "Content-Type: application/json" \
  -d "{
    \"animal_id\": 2,
    \"container_id\": 2,
    \"schedule_time\": \"$CURRENT_TIME\",
    \"food_amount\": 0.50
  }"
```

**When time arrives, you should see TWO MQTT messages:**
```
motor1 {"command":"dispense",...,"animal_name":"Whiskers",...}
motor2 {"command":"dispense",...,"animal_name":"Buddy",...}
```

---

## 🔧 Test 5: Health Check

Verify MQTT connection status:

```bash
curl http://localhost:3001/health | jq '.mqtt'
```

**Expected Output:**
```json
{
  "isConnected": true,
  "brokerUrl": "mqtt://mqtt:1883",
  "topics": {
    "MOTOR1": "motor1",
    "MOTOR2": "motor2",
    "WEIGHT_SENSOR1": "weightSensor1",
    "WEIGHT_SENSOR2": "weightSensor2",
    "LCD": "lcd"
  }
}
```

---

## 📝 Complete Testing Checklist

### Manual Feeding Test:
- [ ] MQTT subscriber terminal is open and listening
- [ ] Backend logs terminal is open
- [ ] Send manual feeding request via curl
- [ ] See MQTT message in subscriber terminal
- [ ] See "Published to motor1" in backend logs
- [ ] Verify log entry in database

### Scheduled Feeding Test:
- [ ] Check current time
- [ ] Create schedule for 2 minutes in future
- [ ] Verify schedule created (GET /api/schedules)
- [ ] Watch backend logs showing minute checks
- [ ] See scheduler trigger at exact time
- [ ] See MQTT message published
- [ ] Verify log entry shows "scheduled" type

### Database Verification:
- [ ] Query log_entries table
- [ ] See both "manual" and "scheduled" entries
- [ ] Verify timestamps match feeding times

---

## 🎓 What Each Log Message Means

### Backend Logs Explained:

```
🔌 Connecting to MQTT broker at mqtt://mqtt:1883...
→ Backend is trying to connect to MQTT

✅ Connected to MQTT broker
→ MQTT connection successful

🚀 Starting feeding scheduler - checking every minute
→ Scheduler has started

⏰ Checking for scheduled feedings at 19:47:00
→ Scheduler is checking database (runs every 60 seconds)

📅 No scheduled feedings found for current time
→ No schedules match current time

🍽️ Found 1 scheduled feeding(s) to trigger
→ Schedule found! About to trigger feeding

🎯 Triggering feeding for Whiskers (Container 1)
→ Processing feeding for this pet

📤 Published to motor1: {...}
→ MQTT message sent successfully

✅ Feeding triggered for Whiskers: 0.3kg dispensed
→ Everything completed successfully
```

---

## 🐛 Troubleshooting

### Problem: No MQTT messages appear

**Check 1: Is MQTT subscriber running?**
```bash
docker-compose ps mqtt
```

**Check 2: Try publishing test message**
```bash
docker-compose exec mqtt mosquitto_pub -h localhost -t test -m "hello"
```

If you don't see "test hello" in your subscriber, MQTT broker has issues.

**Check 3: View MQTT broker logs**
```bash
docker-compose logs mqtt
```

### Problem: Scheduler not checking

**Symptoms:** No "Checking for scheduled feedings" logs

**Solution:** Restart backend
```bash
docker-compose restart backend
docker-compose logs -f backend
```

### Problem: Schedule not triggering

**Check 1: Is schedule active?**
```bash
curl http://localhost:3001/api/schedules | jq '.[] | select(.id == YOUR_SCHEDULE_ID)'
```

**Check 2: Check exact time format**
Schedule time must be `HH:MM:00` format (include seconds as :00)

**Check 3: Watch backend logs for the full minute**
Scheduler checks at :00 seconds of each minute.

---

## 🎉 Success Criteria

You've successfully tested your scheduler when you see:

✅ Manual feeding:
- Curl returns success
- MQTT message appears immediately
- Database log entry created

✅ Scheduled feeding:
- Backend logs show minute-by-minute checks
- At scheduled time, "Found X scheduled feeding(s)" appears
- MQTT message published automatically
- Database log entry shows "scheduled" type

✅ MQTT Integration:
- Health endpoint shows MQTT connected
- mosquitto_sub receives all messages
- Both motor and LCD topics working

---

## 🚀 Next Steps

Once you verify everything works without hardware:

1. **Add more schedules** - Test with different times
2. **Test edge cases** - What if food_level is low?
3. **Test multiple containers** - Both motor1 and motor2
4. **Frontend testing** - Use the web UI to create schedules
5. **Hardware integration** - Connect Arduino and see it respond!

---

## Quick Commands Reference

```bash
# Open MQTT subscriber
docker-compose exec mqtt mosquitto_sub -h localhost -t '#' -v

# Watch backend logs
docker-compose logs -f backend

# Manual feeding
curl -X POST http://localhost:3001/api/feeding/manual \
  -H "Content-Type: application/json" \
  -d '{"container_id":1,"food_amount":0.25}'

# Create schedule (2 minutes from now)
SCHEDULE_TIME=$(date -v+2M "+%H:%M:00")
curl -X POST http://localhost:3001/api/schedules \
  -H "Content-Type: application/json" \
  -d "{\"animal_id\":1,\"container_id\":1,\"schedule_time\":\"$SCHEDULE_TIME\",\"food_amount\":0.25}"

# Check all schedules
curl http://localhost:3001/api/schedules | jq '.'

# Check logs in database
docker-compose exec -T database psql -U petpal_user -d petpal_db \
  -c "SELECT * FROM log_entries ORDER BY dispense_time DESC LIMIT 5;"

# Health check
curl http://localhost:3001/health | jq '.mqtt'
```

Your scheduler is working perfectly if you can complete these tests! 🎯
