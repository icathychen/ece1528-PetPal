# ECE1528 Meeting notes

weight sensor 
-> subscribe to weightEnable topic to get enable message
-> once receive a enable: true, start measuring, publish the weight {weight: "1.0"} to the topic weightSensorx
-> Once receive enable: false, stop measuring


Motor control:
-> subscribe to motor1 and motor2 topics to get control messages
-> once receive a command: "dispense", activate the corresponding motor with the specified food_amount
-> after dispensing, publish to lcd topic a message indicating feeding is complete


LCD Display:
-> subscribe to lcd topic to get display messages
-> once receive a message, display the text on the LCD screen

# Topics json format
### Motor Control Message
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
### WeightEnable Message
```json
{
  "enable": true
}
```

### Weight1 Message
```json
{
  "weight": "1.0"
}
```

### Weight2 Message
```json
{
  "weight": "1.0"
}
```

### LCD Display Message
```json
{
  "text": "Feeding Whiskers - 0.25kg",
  "timestamp": "2025-11-09T10:30:00.000Z"
}

Progress Report:

- Project progress up to date:
    - Web dashboard for pet binding and schedule setting is functional.
        - Main page: fully functional with @Cathy
        - Pet binding page: @Yilin
        - Schedule setting page: @Cathy
    - Backend MQTT integration completed with specific topics for motor control, weight sensors, and LCD display.
        - pet binding: @Yilin
        - schedule setting: @Cathy
        - feeding trigger: @Cathy
        - Topics established: @Cathy
            - motor1, motor2
            - weightSensor1, weightSensor2
            - lcd
            - weightEnable
    - Hardware components (motors, weight sensors, LCD) are set up and tested individually. @kevin
        - Weight sensors can send weight data upon receiving enable messages.
        - Motors can dispense food based on received commands.
        - LCD can display messages received from the backend.

- Next steps:
    - Integrate hardware components with the backend MQTT service. Conduct end-to-end testing of the entire system. Make sure the flow from web dashboard to hardware works seamlessly. @kevin
        - Ensure weight sensors respond to enable/disable messages.
        - Ensure motors dispense food based on MQTT commands.
        - Ensure LCD displays messages from the backend.
    - Integration with commercial cloud and dockerization for deployment. @cathy
    - Building the actual housing for the pet feeder system. 3D printing for the dispenser and cardboard for casing @Yilin