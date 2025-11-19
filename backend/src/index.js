const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import services and routes
const { dbService } = require('./services/database');
const { feedingScheduler } = require('./services/scheduler');
const { mqttService } = require('./services/mqttService');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint with database test
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbService.healthCheck();
    const schedulerStatus = feedingScheduler.getStatus();
    const mqttStatus = mqttService.getStatus();
    
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        current_time: dbHealth.current_time,
        version: dbHealth.db_version
      },
      scheduler: schedulerStatus,
      mqtt: mqttStatus
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// API routes
app.use('/api', apiRoutes);

// === MQTT:  REST → MQTT 
// POST /api/mqtt/publish { "topic": "petpal/test", "payload": { "hello": "world" } }
app.post('/api/mqtt/publish', (req, res) => {
  const { topic, payload } = req.body || {};
  if (!topic) return res.status(400).json({ success: false, error: 'topic required' });
  try {
    mqttPublish(topic, payload ?? '');
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});
// === MQTT: end

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({ 
    message: 'PetPal API Server',
    version: '1.0.0',
    endpoints: {
      'Pet Binding': {
        'POST /api/pets/bind': 'Bind new pet to container',
        'GET /api/pets': 'List all pets',
        'GET /api/pets/weight/:weight': 'Find pet by weight'
      },
      'Schedule Setting': {
        'POST /api/schedules': 'Create feeding schedule',
        'GET /api/schedules': 'List feeding schedules',
        'GET /api/schedules?container_id=1': 'Get schedules for specific container'
      },
      'Feeding Triggers': {
        'GET /api/feeding/check': 'Check and trigger scheduled feedings',
        'POST /api/feeding/manual': 'Trigger manual feeding'
      },
      'Logs & Analytics': {
        'GET /api/logs': 'Retrieve feeding logs',
        'GET /api/logs?container_id=1': 'Get logs for specific container',
        'GET /api/logs/stats': 'Get feeding statistics'
      },
      'System': {
        'GET /health': 'Health check',
        'GET /api/scheduler/status': 'Scheduler status'
      },
      'MQTT': {
        'POST /api/mqtt/publish': 'Publish a message to MQTT (topic, payload)'
      }
    },
    features: [
      '✅ Pet Binding with weight detection',
      '✅ Schedule Setting for automated feeding',
      '✅ Auto Trigger every minute for scheduled feedings',
      '✅ Manual Trigger for on-demand feeding',
      '✅ Comprehensive feeding logs and statistics',
      '✅ MQTT bridge for web/hardware messaging'//mqtt feature
    ]
  });
});

// Scheduler status endpoint
app.get('/api/scheduler/status', (req, res) => {
  const status = feedingScheduler.getStatus();
  res.json({
    success: true,
    scheduler: status
  });
});

// Manual scheduler trigger (for testing)
app.post('/api/scheduler/trigger', async (req, res) => {
  try {
    await feedingScheduler.manualCheck();
    res.json({
      success: true,
      message: 'Manual scheduler check triggered'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to trigger manual check'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    error: 'Something went wrong!', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    message: 'Check the API documentation at the root endpoint'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  feedingScheduler.stop();
  mqttService.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  feedingScheduler.stop();
  mqttService.disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`PetPal Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/`);
  
  // Initialize MQTT connection
  try {
    mqttService.connect();
    console.log('MQTT service initialized');
  } catch (error) {
    console.error('MQTT connection failed:', error.message);
    console.log('Server running but MQTT features unavailable');
  }
  
  // Test database connection
  try {
    await dbService.healthCheck();
    console.log('Database connection verified');
    
    // Start the feeding scheduler
    feedingScheduler.start();
    console.log('Automatic feeding scheduler started');
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.log('Server running but database features unavailable');
  }
});
