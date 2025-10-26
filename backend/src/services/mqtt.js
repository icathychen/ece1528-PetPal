// Minimal MQTT client for Node backend
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://mqtt:1883';
const client = mqtt.connect(MQTT_URL);

client.on('connect', () => {
  console.log('[mqtt] connected:', MQTT_URL);
  client.subscribe('petpal/#', (err) => {
    if (!err) console.log('[mqtt] subscribed petpal/#');
  });
});
client.on('message', (t, m) => console.log(`[mqtt] ${t} -> ${m.toString()}`));
client.on('error', (e) => console.error('[mqtt] error', e));

function publish(topic, payload, opts = { qos: 0, retain: false }) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  client.publish(topic, body, opts);
}

module.exports = { client, publish };
