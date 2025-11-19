# PetPal Architecture Overview

## 🐳 Why Everything is `docker-compose ...`?

### **Your Application Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│              Docker Compose Environment                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Frontend   │  │   Backend    │  │  PostgreSQL  │   │
│  │  (React)     │  │  (Node.js)   │  │  Database    │   │
│  │ Port: 3000   │  │ Port: 3001   │  │ Port: 5432   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                  │         │
│         └──────────────────┴──────────────────┘         │
│                            │                            │
│                  ┌──────────────────┐                   │
│                  │   MQTT Broker    │                   │
│                  │  (Mosquitto)     │                   │
│                  │  Port: 1883      │                   │
│                  └──────────────────┘                   │
│                            │                            │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │   Your Mac      │
                    │  (Host Machine) │
                    └─────────────────┘
```

### **Why Docker Compose?**

1. **Isolated Network**: All containers (frontend, backend, database, MQTT) run in a **private Docker network** called `petpal-network`
2. **Service Discovery**: Containers can talk to each other using **service names** instead of IP addresses:
   - Backend connects to database using `database:5432` (not `localhost:5432`)
   - Backend connects to MQTT using `mqtt:1883` (not `localhost:1883`)
3. **Consistent Environment**: Everyone on your team gets the **exact same setup**
4. **Easy Management**: One command controls everything: `docker-compose up/down`

### **Why Commands Start with `docker-compose`:**

```bash
# Running commands INSIDE the Docker environment:
docker-compose exec database psql ...     # Run psql inside database container
docker-compose exec backend npm install   # Run npm inside backend container
docker-compose exec mqtt mosquitto_sub    # Subscribe to MQTT inside mqtt container

# Why not just "psql ..." or "npm ..."?
# Because those tools are NOT installed on your Mac!
# They only exist INSIDE the Docker containers
```

---

## 📡 MQTT Publisher/Subscriber Flow - Detailed Explanation

### **Architecture Overview:**

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Environment                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │              Backend (Node.js)                     │     │
│  │                                                    │     │
│  │  ┌──────────────┐         ┌──────────────────┐     │     │
│  │  │  Scheduler   │         │  Manual Feeding  │     │     │
│  │  │   Service    │         │      API         │     │     │
│  │  └──────┬───────┘         └────────┬─────────┘     │     │
│  │         │                          │               │     │
│  │         └──────────┬───────────────┘               │     │
│  │                    │                               │     │
│  │         ┌──────────▼──────────┐                    │     │
│  │         │   MQTT Service      │                    │     │
│  │         │  (Publisher)        │                    │     │
│  │         │                     │                    │     │
│  │         │ mqtt.publish()      │                    │     │
│  │         └──────────┬──────────┘                    │     │
│  │                    │                               │     │
│  └────────────────────┼───────────────────────────────┘     │
│                       │                                     │
│                       │ TCP Connection                      │
│                       │ (inside Docker network)             │
│                       ▼                                     │
│         ┌─────────────────────────────┐                     │
│         │     MQTT Broker             │                     │
│         │    (Eclipse Mosquitto)      │                     │
│         │                             │                     │
│         │  Topics:                    │                     │
│         │  - motor1                   │                     │
│         │  - motor2                   │                     │
│         │  - lcd                      │                     │
│         │  - weightSensor1            │                     │
│         │  - weightSensor2            │                     │
│         │                             │                     │
│         │  Port: 1883 (MQTT)          │                     │
│         │  Port: 9001 (WebSocket)     │                     │
│         └─────────────┬───────────────┘                     │
│                       │                                     │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        │ Port Mapping
                        │ 1883:1883
                        │
        ┌───────────────▼──────────────┐
        │      Your Mac / Network      │
        │                              │
        │  ┌─────────────────────┐    │
        │  │  Arduino/ESP32      │    │
        │  │  (Subscriber)       │    │
        │  │                     │    │
        │  │  WiFi connects to:  │    │
        │  │  YOUR_MAC_IP:1883   │    │
        │  │                     │    │
        │  │  Subscribes to:     │    │
        │  │  - motor1           │    │
        │  │  - motor2           │    │
        │  │  - lcd              │    │
        │  └─────────────────────┘    │
        │                             │
        │  ┌─────────────────────┐    │
        │  │  Test Subscriber    │    │
        │  │  (mosquitto_sub)    │    │
        │  │                     │    │
        │  │  docker-compose     │    │
        │  │  exec mqtt          │    │
        │  │  mosquitto_sub -t # │    │
        │  └─────────────────────┘    │
        └──────────────────────────────┘
```

---

## 🔄 MQTT Message Flow - Step by Step

### **Scenario: Scheduled Feeding at 08:00 AM**

#### **Step 1: Time Check (Every Minute at :00)**
```javascript
// backend/src/services/scheduler.js
setInterval(() => {
  checkScheduledFeedings();  // Runs at 08:00:00
}, 60000);
```

#### **Step 2: Database Query**
```javascript
// Find schedules for 08:00:00
const schedules = await dbService.getCurrentSchedules();
// Returns: [{animal_id: 1, container_id: 1, food_amount: 0.15}]
```

#### **Step 3: Trigger Feeding**
```javascript
// backend/src/services/scheduler.js
for (const schedule of schedules) {
  await this.triggerFeedingForSchedule(schedule);
}
```

#### **Step 4: Publish MQTT Message**
```javascript
// backend/src/services/scheduler.js
mqttService.publishMotorTrigger({
  container_id: 1,
  food_amount: 0.15,
  animal_name: 'Whiskers',
  feeding_type: 'scheduled'
});
```

#### **Step 5: MQTT Service Formats Message**
```javascript
// backend/src/services/mqttService.js
publishMotorTrigger(feedingData) {
  const topic = `motor${feedingData.container_id}`;  // "motor1"
  
  const message = {
    command: 'dispense',
    container_id: feedingData.container_id,
    food_amount: feedingData.food_amount,
    animal_name: feedingData.animal_name,
    feeding_type: feedingData.feeding_type,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  // Publish to MQTT broker
  this.client.publish(topic, JSON.stringify(message));
  console.log(`Published to ${topic}:`, message);
}
```

#### **Step 6: MQTT Broker Receives & Distributes**
```
MQTT Broker (Mosquitto):
  - Receives message on topic "motor1"
  - Stores message temporarily
  - Forwards to ALL subscribers of "motor1" topic
```

#### **Step 7: Arduino Receives Message**
```cpp
// hardware/arduino_motor_controller.ino
void callback(char* topic, byte* payload, unsigned int length) {
  // Parse JSON
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, payload, length);
  
  String command = doc["command"];           // "dispense"
  float amount = doc["food_amount"];         // 0.15
  String animal = doc["animal_name"];        // "Whiskers"
  
  // Dispense food
  if (command == "dispense") {
    dispenserMotor(amount);  // Rotate motor to dispense 0.15kg
  }
}
```

---

## 🌐 Is Everything Within Docker?

### **YES and NO - Here's the breakdown:**

#### **✅ INSIDE Docker (Private Network):**
1. **Frontend → Backend**: `http://backend:3001` (React calls API)
2. **Backend → Database**: `postgresql://database:5432` (SQL queries)
3. **Backend → MQTT Broker**: `mqtt://mqtt:1883` (Publish messages)
4. **Backend ↔ Backend Services**: Scheduler, MQTT service, DB service all communicate

#### **❌ OUTSIDE Docker (Accessible from Your Mac):**
1. **Frontend**: `http://localhost:3000` (You open in browser)
2. **Backend API**: `http://localhost:3001` (You can curl from terminal)
3. **MQTT Broker**: `mqtt://YOUR_MAC_IP:1883` (Arduino connects here)
4. **Database**: `postgresql://localhost:5432` (You can connect with psql)

### **Port Mapping (Bridge Between Docker & Host):**
```yaml
# docker-compose.yml
services:
  mqtt:
    ports:
      - "1883:1883"  # Host:Container
      #   ↑      ↑
      #   │      └─ MQTT port INSIDE Docker
      #   └──────── MQTT port on YOUR MAC
```

When Arduino connects to `YOUR_MAC_IP:1883`, Docker **forwards** the connection to the MQTT broker container.

---

## 📊 Full Message Flow Example:

```
1. USER clicks "Feed Now" button on Frontend (Browser)
   ↓
2. Frontend sends HTTP POST to Backend
   fetch('http://localhost:3001/api/feeding/manual', ...)
   ↓
3. Backend API receives request
   app.post('/api/feeding/manual', ...)
   ↓
4. Backend calls MQTT Service
   mqttService.publishMotorTrigger({...})
   ↓
5. MQTT Service publishes to Broker (INSIDE Docker)
   this.client.publish('motor1', message)
   ↓
6. MQTT Broker receives & stores message
   Topic: motor1
   Payload: {"command":"dispense",...}
   ↓
7. Broker forwards to ALL subscribers
   ↓
   ├─→ Arduino (connected via WiFi to YOUR_MAC_IP:1883)
   │   └─→ Parses JSON → Dispenses food
   │
   └─→ Test subscriber (docker-compose exec mqtt mosquitto_sub)
       └─→ Prints message to terminal
```

---

## 🎯 Key Takeaways:

1. **Docker Compose** creates an **isolated network** where all services talk to each other
2. **Port mapping** (`1883:1883`) makes services accessible from **outside Docker**
3. **MQTT Broker** acts as a **message bus** - backend publishes, hardware subscribes
4. **Everything is event-driven**: Time triggers → Scheduler → MQTT → Hardware action
5. **Your Arduino connects from OUTSIDE Docker** but communicates with the broker **inside Docker** via port mapping

---

## 📁 Project Structure Reference

```
ece1528-PetPal/
├── backend/
│   └── src/
│       ├── services/
│       │   ├── mqttService.js      # MQTT publisher
│       │   ├── scheduler.js        # Automatic feeding scheduler
│       │   └── database.js         # Database queries
│       ├── routes/
│       │   └── api.js              # REST API endpoints
│       └── index.js                # Server entry point
├── hardware/
│   └── arduino_motor_controller.ino # Arduino MQTT subscriber
├── docker-compose.yml               # Docker services configuration
└── docker/
    └── mosquitto/
        └── mosquitto.conf          # MQTT broker configuration
```

---

## 🔧 Common Commands Reference

```bash
# Start all services
docker-compose up -d

# View backend logs
docker-compose logs -f backend

# Subscribe to MQTT messages (testing)
docker-compose exec mqtt mosquitto_sub -h localhost -t '#' -v

# Execute SQL queries
docker-compose exec database psql -U petpal_user -d petpal_db

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down
```

---

## 🚀 Data Flow Summary

```
Time Trigger (Scheduler)
    ↓
Database Query (Find schedules)
    ↓
MQTT Publish (Send command)
    ↓
MQTT Broker (Route message)
    ↓
Arduino Subscribe (Receive command)
    ↓
Motor Control (Dispense food)
    ↓
Database Log (Record feeding)
```

This architecture ensures:
- ✅ Reliable communication between software and hardware
- ✅ Scalable system (add more containers easily)
- ✅ Testable components (can test without real hardware)
- ✅ Maintainable codebase (services are isolated)
