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
    };
  }

  /**
   * Connect to MQTT broker
   */
  connect() {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mqtt:1883';
    
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
    const { container_id, food_amount, animal_name, feeding_type = 'scheduled' } = feedingData;

    // Determine which motor topic to use
    const motorTopic = container_id === 1 ? this.topics.MOTOR1 : this.topics.MOTOR2;

    // Create motor control message
    const motorMessage = {
      command: 'dispense',
      container_id: container_id,
      food_amount: food_amount,
      animal_name: animal_name,
      feeding_type: feeding_type,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    return this.publish(motorTopic, motorMessage);
  }

  /**
   * Publish LCD display message
   * @param {string} message - Message to display on LCD
   */
  publishLCDMessage(message) {
    const lcdMessage = {
      text: message,
      timestamp: new Date().toISOString()
    };

    return this.publish(this.topics.LCD, lcdMessage);
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
   * @param {Object} message - Message object to publish
   */
  publish(topic, message) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        console.warn('MQTT not connected, skipping publish to', topic);
        return reject(new Error('MQTT client not connected'));
      }

      const payload = JSON.stringify(message);
      
      this.client.publish(topic, payload, { qos: 1 }, (error) => {
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

module.exports = { mqttService };
