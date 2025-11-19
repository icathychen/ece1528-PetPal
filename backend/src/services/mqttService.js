const mqtt = require('mqtt');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.topics = {
      MOTOR1: 'motor1',
      MOTOR2: 'motor2',
      WEIGHT_SENSOR1: 'weightSensor1',
      WEIGHT_SENSOR2: 'weightSensor2',
      LCD: 'lcd',
      WEIGHT_ENABLE: 'weightEnable'
    };
    // Store latest weight sensor readings
    this.latestWeightSensor1 = null;
    this.latestWeightSensor2 = null;
  }

  /**
   * Connect to MQTT broker
   */
  connect() {
    const brokerUrl = process.env.MQTT_BROKER_URL || process.env.MQTT_URL || 'mqtt://mqtt:1883';
    
    console.log(`Connecting to MQTT broker at ${brokerUrl}...`);
    
    this.client = mqtt.connect(brokerUrl, {
      clientId: `petpal_backend_${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    });

    this.client.on('connect', () => {
      console.log('Connected to MQTT broker');
      this.isConnected = true;
      
      // Subscribe to weight sensors for tracking latest values
      this.client.subscribe(this.topics.WEIGHT_SENSOR1, (err) => {
        if (!err) console.log('[mqtt] subscribed to', this.topics.WEIGHT_SENSOR1);
      });
      this.client.subscribe(this.topics.WEIGHT_SENSOR2, (err) => {
        if (!err) console.log('[mqtt] subscribed to', this.topics.WEIGHT_SENSOR2);
      });
      // Subscribe to all petpal topics
      this.client.subscribe('petpal/#', (err) => {
        if (!err) console.log('[mqtt] subscribed petpal/#');
      });
    });

    this.client.on('message', (topic, message) => {
      const payload = message.toString();
      console.log(`[mqtt] ${topic} -> ${payload}`);
      
      // Store weight sensor readings - expecting JSON format: {"weight": "1.0"}
      if (topic === this.topics.WEIGHT_SENSOR1) {
        try {
          const data = JSON.parse(payload);
          if (data.weight !== undefined) {
            this.latestWeightSensor1 = parseFloat(data.weight);
            console.log('[mqtt] Weight Sensor 1 updated:', this.latestWeightSensor1);
          }
        } catch (e) {
          // Fallback: try parsing as plain number for backward compatibility
          try {
            this.latestWeightSensor1 = parseFloat(payload);
            console.log('[mqtt] Weight Sensor 1 updated (plain):', this.latestWeightSensor1);
          } catch (e2) {
            console.error('[mqtt] Failed to parse weight sensor 1 data:', e);
          }
        }
      } else if (topic === this.topics.WEIGHT_SENSOR2) {
        try {
          const data = JSON.parse(payload);
          if (data.weight !== undefined) {
            this.latestWeightSensor2 = parseFloat(data.weight);
            console.log('[mqtt] Weight Sensor 2 updated:', this.latestWeightSensor2);
          }
        } catch (e) {
          // Fallback: try parsing as plain number for backward compatibility
          try {
            this.latestWeightSensor2 = parseFloat(payload);
            console.log('[mqtt] Weight Sensor 2 updated (plain):', this.latestWeightSensor2);
          } catch (e2) {
            console.error('[mqtt] Failed to parse weight sensor 2 data:', e);
          }
        }
      }
    });

    this.client.on('error', (error) => {
      console.error('MQTT connection error:', error.message);
      this.isConnected = false;
    });

    this.client.on('offline', () => {
      console.log('MQTT client is offline');
      this.isConnected = false;
    });

    this.client.on('reconnect', () => {
      console.log('Reconnecting to MQTT broker...');
    });

    this.client.on('close', () => {
      console.log('MQTT connection closed');
      this.isConnected = false;
    });

    return this.client;
  }

  /**
   * Publish motor control message for feeding
   * @param {Object} feedingData - Feeding information
   * @param {number} feedingData.container_id - Container/Motor ID (1 or 2)
   * @param {number} feedingData.food_amount - Amount of food to dispense (kg)
   * @param {string} feedingData.animal_name - Name of the pet
   * @param {string} feedingData.feeding_type - 'scheduled' or 'manual'
   */
  publishMotorTrigger(feedingData) {
    const { container_id, food_amount, animal_name, animal_weight, feeding_type = 'scheduled' } = feedingData;

    // Determine which motor topic to use
    const motorTopic = container_id === 1 ? this.topics.MOTOR1 : this.topics.MOTOR2;

    // Create motor control message
    const motorMessage = {
      command: 'dispense',
      container_id: container_id,
      food_amount: food_amount,
      animal_name: animal_name,
      animal_weight: animal_weight,
      feeding_type: feeding_type,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    return this.publish(motorTopic, motorMessage);
  }

  /**
   * Publish LCD display message
   * Handles both simple strings and structured message objects
   * @param {string|Object} message - Message to display on LCD (string or object)
   * @param {boolean} wrapInObject - If true and message is a string, wraps it in object with timestamp (default: true)
   * @returns {Promise} - Resolves when message is published
   */
  publishLCDMessage(message, wrapInObject = true) {
    // If message is already an object, use it directly
    if (typeof message === 'object' && message !== null) {
      return this.publish(this.topics.LCD, message);
    }
    
    // If wrapInObject is true, wrap the string in an object with timestamp
    if (wrapInObject) {
      const lcdMessage = {
        text: message,
        timestamp: new Date().toISOString()
      };
      return this.publish(this.topics.LCD, lcdMessage);
    }
    
    // Otherwise publish as simple string
    return this.publish(this.topics.LCD, message);
  }

  /**
   * Publish LCD display message (simple string format, for backward compatibility)
   * @param {string|Object} message - Message to display on LCD
   * @returns {Promise} - Resolves when message is published
   */
  publishLCD(message) {
    // For backward compatibility, publishLCD sends simple strings without wrapping
    return this.publishLCDMessage(message, false);
  }

  /**
   * Publish motor1 control command (simple format)
   * @param {string} command - 'start' or 'stop'
   */
  publishMotor1(command) {
    this.publish(this.topics.MOTOR1, command);
    console.log(`[mqtt] Published to ${this.topics.MOTOR1}: ${command}`);
  }

  /**
   * Publish motor2 control command (simple format)
   * @param {string} command - 'start' or 'stop'
   */
  publishMotor2(command) {
    this.publish(this.topics.MOTOR2, command);
    console.log(`[mqtt] Published to ${this.topics.MOTOR2}: ${command}`);
  }

  /**
   * Publish weight sensor control
   * @param {number} sensorId - Sensor ID (1 or 2)
   * @param {boolean} enable - true to enable, false to disable
   */
  publishWeightSensorControl(sensorId, enable) {
    const topic = sensorId === 1 ? 'weightSensor1Control' : 'weightSensor2Control';
    const command = enable ? 'enable' : 'disable';
    this.publish(topic, command);
    console.log(`[mqtt] Published to ${topic}: ${command}`);
  }

  /**
   * Publish weight enable control message in JSON format
   * @param {boolean} enable - true to enable, false to disable
   * @returns {Object} - The message object sent
   */
  publishWeightEnable(enable) {
    const message = {
      enable: enable
    };
    
    this.publish(this.topics.WEIGHT_ENABLE, message);
    console.log(`[mqtt] Published to ${this.topics.WEIGHT_ENABLE}:`, JSON.stringify(message));
    return message;
  }

  /**
   * Get latest weight from weight sensor
   * @param {number} sensorId - Sensor ID (1 or 2), defaults to 1
   * @returns {number|null} - Latest weight value or null if not available
   */
  getLatestWeight(sensorId = 1) {
    return sensorId === 1 ? this.latestWeightSensor1 : this.latestWeightSensor2;
  }

  /**
   * Clear weight sensor data
   * @param {number} sensorId - Sensor ID (1 or 2), defaults to 1
   */
  clearWeightSensor(sensorId = 1) {
    if (sensorId === 1) {
      this.latestWeightSensor1 = null;
      console.log('[mqtt] Weight Sensor 1 data cleared');
    } else {
      this.latestWeightSensor2 = null;
      console.log('[mqtt] Weight Sensor 2 data cleared');
    }
  }

  /**
   * Request weight measurement from weight sensor
   * @param {number} sensor_id - Sensor ID (1 for pet weight, 2 for food level)
   */
  publishWeightRequest(sensor_id = 1) {
    const topic = sensor_id === 1 ? this.topics.WEIGHT_SENSOR1 : this.topics.WEIGHT_SENSOR2;
    const message = {
      command: 'measure',
      timestamp: new Date().toISOString()
    };

    return this.publish(topic, message);
  }

  /**
   * Generic publish method
   * @param {string} topic - MQTT topic
   * @param {Object|string} message - Message object or string to publish
   * @param {Object} opts - MQTT publish options (qos, retain, etc.)
   */
  publish(topic, message, opts = { qos: 1 }) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        console.warn('MQTT not connected, skipping publish to', topic);
        return reject(new Error('MQTT client not connected'));
      }

      const payload = typeof message === 'string' ? message : JSON.stringify(message);
      
      this.client.publish(topic, payload, opts, (error) => {
        if (error) {
          console.error(`Failed to publish to ${topic}:`, error.message);
          reject(error);
        } else {
          console.log(`Published to ${topic}:`, message);
          resolve();
        }
      });
    });
  }

  /**
   * Subscribe to a topic (for receiving hardware responses)
   * @param {string} topic - Topic to subscribe to
   * @param {Function} callback - Callback function when message received
   */
  subscribe(topic, callback) {
    if (!this.isConnected) {
      console.warn('MQTT not connected, cannot subscribe to', topic);
      return;
    }

    this.client.subscribe(topic, (error) => {
      if (error) {
        console.error(`Failed to subscribe to ${topic}:`, error.message);
      } else {
        console.log(`Subscribed to ${topic}`);
      }
    });

    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        try {
          const parsedMessage = JSON.parse(message.toString());
          callback(parsedMessage);
        } catch (error) {
          console.error('Failed to parse MQTT message:', error.message);
        }
      }
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      console.log('Disconnected from MQTT broker');
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://mqtt:1883',
      topics: this.topics
    };
  }
}

// Create singleton instance
const mqttService = new MQTTService();

// Export both the service instance and individual methods for backward compatibility
module.exports = { 
  mqttService,
  // Export methods for compatibility with old mqtt.js usage
  client: mqttService.client,
  publish: (topic, payload, opts) => mqttService.publish(topic, payload, opts),
  publishMotor1: (command) => mqttService.publishMotor1(command),
  publishMotor2: (command) => mqttService.publishMotor2(command),
  publishLCD: (message) => mqttService.publishLCD(message),
  publishWeightSensorControl: (sensorId, enable) => mqttService.publishWeightSensorControl(sensorId, enable),
  publishWeightEnable: (enable) => mqttService.publishWeightEnable(enable),
  getLatestWeight: (sensorId) => mqttService.getLatestWeight(sensorId),
  clearWeightSensor: (sensorId) => mqttService.clearWeightSensor(sensorId),
  TOPICS: mqttService.topics
};
