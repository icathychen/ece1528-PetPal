# ECE1528 Meeting Notes

## Progress Report

### Web Dashboard  
- **Main page (Cathy):**  
    The web dashboard’s main page is now fully implemented and deployed. It presents a clear overview of all registered pets, showing each pet’s details (name, photo, and assigned container), as well as a summary table of upcoming feeding times. The schedule display highlights the next feeding for each animal. Seamless navigation allows users to create new pets, switch to detailed pet views, and access the schedule settings. All navigation flows between dashboard, pet binding, scheduling, and detailed views have been thoroughly tested.
- **Pet binding page (Yilin):**  
    Pet binding feature is operational, supporting the addition of new pets and linkage with their corresponding containers. Weight will be updated based on loadcell data when weight detection is enabled, and can be manually changed. Food portion will be manually set to the desired amount.
- **Schedule setting page (Cathy):**  
    The UI for schedule configuration has been completed. Users can add/edit feeding schedules, selecting feed times, quantities, and containers. The interface includes robust validation and an intuitive calendar/time selection widget. These changes sync directly to backend services via MQTT.

### Backend: MQTT Integration  
MQTT integration is complete, connecting frontend schedules and hardware controls:
- **Pet binding (Yilin):**  
    When users add a new pet, they will first click the start weight detection, this will publish an MQTT message to the weight control topic to enable the loadcell, the weight data will then be sent to the weight topic and appear at the web page. If the user is satisfied with the weight, they will stop the detection, which will disable the loadcell by publishing to the same weight control topic.
- **Schedule setting (Cathy):**  
    When users create or update feeding schedules, the backend publishes instructions to the appropriate topic (`motor1` or `motor2`) using a standardized JSON message:
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
- **Feeding trigger (Cathy):**  
    An automated process now monitors scheduled feed times and publishes corresponding MQTT control and status messages (e.g., dispensing command, LCD updates). This process includes error handling and a manual override for immediate feeding when needed.
- **Topics and Message Formats (Cathy):**  
    All required MQTT topics have been defined with their message structures documented in JSON. Both publishers (backend or dashboard) and subscribers (hardware and web frontend) adhere to these standards to ensure clear communication across the system.  
    **Topics and message formats:**
    - `motor1`, `motor2`:
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
    - `weightEnable`:
        ```json
        {
          "enable": true
        }
        ```
    - `weightSensor1`, `weightSensor2`:
        ```json
        {
          "weight": "1.0"
        }
        ```
    - `lcd`:
        ```json
        {
          "text": "Feeding Whiskers - 0.25kg",
          "timestamp": "2025-11-09T10:30:00.000Z"
        }
        ```
    This standardization supports reliable integration between all hardware and software modules.

### Hardware Components (Kevin)  
- Motors, weight sensors, and LCD display are all individually set up and verified.
- Weight sensors reliably send measurements when enabled.
- Motors dispense the correct food portion when commanded.
- The LCD displays status messages received from the backend.

---

## Next Steps

- **Hardware/Backend Integration & System Testing (Kevin):**  
    Next, we will integrate the hardware with backend MQTT services and conduct complete end-to-end system tests. The flow will be validated from dashboard interaction all the way through to physical device behavior, including:
    - Weight sensors responding to enable/disable commands.
    - Motors dispensing food based on received MQTT instructions.
    - LCD displaying real-time backend messages.

- **Cloud Deployment and Scalability Planning (Cathy):**  
    Currently, all services run in Docker containers on local development machines, ensuring a consistent environment for building and testing. The next phase involves exploring deployment to a commercial cloud platform. This will enable users to access the dashboard and services globally via a dedicated endpoint. Our future deployment strategy will focus on scalability and reliability, utilizing cloud-native features for distributed operation, load balancing, and high availability. We will also prepare documentation for deployment and scaling best practices as we transition to production readiness.

- **Physical Assembly (Yilin):**  
    Our final stage will involve assembling the physical pet feeder, including 3D printing the dispenser component and fabricating the casing with durable materials.

---

Please let us know if you have questions or suggestions about any part of the project!