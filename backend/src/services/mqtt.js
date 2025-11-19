// Minimal MQTT client for Node backend
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://mqtt:1883';
const client = mqtt.connect(MQTT_URL);

// Topic definitions
const TOPICS = {
  MOTOR1: 'motor1',
  MOTOR2: 'motor2',
  WEIGHT_SENSOR1: 'weightSensor1',
  WEIGHT_SENSOR2: 'weightSensor2',
  LCD: 'lcd',
  WEIGHT_ENABLE: 'weightEnable'  // JSON: {enable: true/false}
};

// Store latest weight sensor readings
let latestWeightSensor1 = null;
let latestWeightSensor2 = null;

client.on('connect', () => {
  console.log('[mqtt] connected:', MQTT_URL);
  client.subscribe('petpal/#', (err) => {
    if (!err) console.log('[mqtt] subscribed petpal/#');
  });
  // Subscribe to weight sensors
  client.subscribe(TOPICS.WEIGHT_SENSOR1, (err) => {
    if (!err) console.log('[mqtt] subscribed to', TOPICS.WEIGHT_SENSOR1);
  });
  client.subscribe(TOPICS.WEIGHT_SENSOR2, (err) => {
    if (!err) console.log('[mqtt] subscribed to', TOPICS.WEIGHT_SENSOR2);
  });
});

client.on('message', (topic, message) => {
  const payload = message.toString();
  console.log(`[mqtt] ${topic} -> ${payload}`);
  
  // Store weight sensor readings - expecting JSON format: {"weight": "1.0"}
  if (topic === TOPICS.WEIGHT_SENSOR1) {
    try {
      const data = JSON.parse(payload);
      if (data.weight !== undefined) {
        latestWeightSensor1 = parseFloat(data.weight);
        console.log('[mqtt] Weight Sensor 1 updated:', latestWeightSensor1);
      }
    } catch (e) {
      // Fallback: try parsing as plain number for backward compatibility
      try {
        latestWeightSensor1 = parseFloat(payload);
        console.log('[mqtt] Weight Sensor 1 updated (plain):', latestWeightSensor1);
      } catch (e2) {
        console.error('[mqtt] Failed to parse weight sensor 1 data:', e);
      }
    }
  } else if (topic === TOPICS.WEIGHT_SENSOR2) {
    try {
      const data = JSON.parse(payload);
      if (data.weight !== undefined) {
        latestWeightSensor2 = parseFloat(data.weight);
        console.log('[mqtt] Weight Sensor 2 updated:', latestWeightSensor2);
      }
    } catch (e) {
      // Fallback: try parsing as plain number for backward compatibility
      try {
        latestWeightSensor2 = parseFloat(payload);
        console.log('[mqtt] Weight Sensor 2 updated (plain):', latestWeightSensor2);
      } catch (e2) {
        console.error('[mqtt] Failed to parse weight sensor 2 data:', e);
      }
    }
  }
});

client.on('error', (e) => console.error('[mqtt] error', e));

function publish(topic, payload, opts = { qos: 0, retain: false }) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  client.publish(topic, body, opts);
}

// Publish functions for each topic
function publishMotor1(command) {
  // command: 'start' or 'stop'
  publish(TOPICS.MOTOR1, command);
  console.log(`[mqtt] Published to ${TOPICS.MOTOR1}: ${command}`);
}

function publishMotor2(command) {
  // command: 'start' or 'stop'
  publish(TOPICS.MOTOR2, command);
  console.log(`[mqtt] Published to ${TOPICS.MOTOR2}: ${command}`);
}

function publishLCD(message) {
  // message: string to display on LCD
  publish(TOPICS.LCD, message);
  console.log(`[mqtt] Published to ${TOPICS.LCD}: ${message}`);
}

function publishWeightSensorControl(sensorId, enable) {
  // sensorId: 1 or 2, enable: true or false
  const topic = sensorId === 1 ? 'weightSensor1Control' : 'weightSensor2Control';
  const command = enable ? 'enable' : 'disable';
  publish(topic, command);
  console.log(`[mqtt] Published to ${topic}: ${command}`);
}

/**
 * Publish weight enable control message in JSON format
 * @param {boolean} enable - true to enable, false to disable
 * 
 * Example:
 * publishWeightEnable(true)  // {"enable": true}
 */
function publishWeightEnable(enable) {
  const message = {
    enable: enable
  };
  
  publish(TOPICS.WEIGHT_ENABLE, message);
  console.log(`[mqtt] Published to ${TOPICS.WEIGHT_ENABLE}:`, JSON.stringify(message));
  return message;
}

function getLatestWeight(sensorId = 1) {
  return sensorId === 1 ? latestWeightSensor1 : latestWeightSensor2;
}

function clearWeightSensor(sensorId = 1) {
  if (sensorId === 1) {
    latestWeightSensor1 = null;
    console.log('[mqtt] Weight Sensor 1 data cleared');
  } else {
    latestWeightSensor2 = null;
    console.log('[mqtt] Weight Sensor 2 data cleared');
  }
}

module.exports = { 
  client, 
  publish,
  publishMotor1,
  publishMotor2,
  publishLCD,
  publishWeightSensorControl,
  publishWeightEnable,
  getLatestWeight,
  clearWeightSensor,
  TOPICS
};
