# ECE1528 Project Timeline

## Project Overview
Smart pet feeding system with weight sensors, automatic dispensing, and web dashboard control.

## Part Breakdown

### Hardware Components

#### Weight Sensor 1 (Food Weight)
- **Function**: Monitor food level in container
- **Logic**: Weight food → send to cloud
- **Alert**: If food weight < 1kg → notify user to add food

#### Weight Sensor 2 (Pet Weight)
- **Function**: Detect and identify pet
- **Process**: 
  1. Weight cat → send weight data to cloud
  2. Cloud determines animal type
  3. Send data to stepper motor control (counter++, steps)

#### LCD Display
- **Function**: Show real-time feeding status and time
- **Data Source**: Get status from cloud
- **Status Types**:
  - Pet Binding
  - Dispensing
  - Finished
  - Food empty
  - Weight detected!

#### Stepper Motor Control
- **Function**: Dispense controlled amount of food
- **Process**:
  1. Get enable & amount from cloud
  2. Dispense food based on counter
  3. On finish → update LCD display + send completion signal to cloud

### Software Components

#### Web Dashboard

##### 1. Pet Binding
- **Process**:
  1. Enable weight sensor → LCD displays "Pet Binding" state
  2. Auto-populate weight (3.1kg)
  3. Manual entry: Pet name, Container ID
  4. Submit → disable weight sensor, LCD shows "Binding complete"
  5. Create pet record in database

**Flow**: Binding → enable weight detect, finish → disable weight detect

##### 2. Schedule Setting
- **Function**: User sets feeding time and food amount
- **Implementation**: 
  - Container 1: `SetSchedule(containerID, scheduleTime, amount)` → write to database
  - Container 2: `SetSchedule(containerID, scheduleTime, amount)` → write to database

##### 3. Trigger Feeding
- **Auto Trigger**: `Check_and_trigger_feeding` (cloud function)
  - Runs every minute (or defined interval)
  - Queries database for schedules matching current time
  - Sends "feed" signal to hardware
  - **Args**: `[LCD:"Ready", Motor{id: 1, enable: true, amount: 1, status: not ready}, weight: enable: true]`

##### 4. Manual Trigger
- **Function**: `TriggerManualFeeding` → send signal to hardware

##### 5. View Logs
- **Function**: `RetrieveLogs`
- **Helper**: `GetAnimalByWeight(weight)` → animalType

## Cloud Database Schema

### Tables

#### Animal Table
| Field | Type | Description |
|-------|------|-------------|
| Name | String | Pet name |
| animalType | String | Container ID |
| Weight | Float | Pet weight |
| Food portion | Float | Food amount per feeding |
| Food level | Float | Current food level |

#### Log Entry Table
| Field | Type | Description |
|-------|------|-------------|
| Dispense time | DateTime | When feeding occurred |
| Food portion | Float | Amount dispensed |
| Remain food level | Float | Food level after dispensing |

## Message Protocol

### Message Format
```json
{
  "LCD": {"message": "string"},
  "motor": {"id": 1, "enable": true, "amount": 1, "status": "string"},
  "weight": {"enable": true}
}
```

### Example Messages
- **Feeding Complete**: `[LCD: {"message": "Finished"}, motor: {id: 1, enable: true, amount: 1, status: int}, weight: {enable: true}]`

## System Logic

### Weight Detection Rules
- **Binding phase**: enable weight detect → finish → disable weight detect
- **Feeding time**: enable weight detect
- **Out of feeding time**: disable weight detect

## Technology Stack

- **Frontend**: ReactJS
- **Backend**: C
- **Database**: PostgreSQL

## Task Assignments

### Hardware Tasks
- [ ] Weight sensor implementation @kevin
- [ ] Motor control system @kevin

### Software Tasks
- [ ] Cloud database setup @cathy
- [ ] React frontend setup @cathy
- [ ] Set schedule functionality
- [ ] Trigger feeding system
- [ ] Pet binding feature @Yilin

---

*Meeting Date: October 16, 2025*