const express = require('express');
const { dbService } = require('../services/database');
const { publishMotor1, publishMotor2, publishLCD, publishWeightSensorControl, getLatestWeight, clearWeightSensor } = require('../services/mqtt');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const animalSchema = Joi.object({
  name: Joi.string().required().max(100),
  animal_type: Joi.string().required().max(50),
  weight: Joi.number().positive().required(),
  food_portion: Joi.number().positive().required(),
  food_level: Joi.number().min(0).required(),
  container_id: Joi.number().integer().positive().required()
});

const scheduleSchema = Joi.object({
  animal_id: Joi.number().integer().positive().required(),
  container_id: Joi.number().integer().positive().required(),
  schedule_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
  food_amount: Joi.number().positive().required()
});

const manualFeedingSchema = Joi.object({
  container_id: Joi.number().integer().positive().required(),
  food_amount: Joi.number().positive().required()
});

// ##### 1. Pet Binding #####

// POST /api/pets/bind - Create new pet record (Pet Binding)
router.post('/pets/bind', async (req, res) => {
  try {
    // Validate input
    const { error, value } = animalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.details[0].message 
      });
    }

    // Check if container is already in use
    const existingAnimal = await dbService.getAnimalByContainerId(value.container_id);
    if (existingAnimal) {
      return res.status(409).json({ 
        success: false, 
        error: `Container ${value.container_id} is already bound to ${existingAnimal.name}` 
      });
    }

    // Create new animal record
    const newAnimal = await dbService.createAnimal(value);
    
    // Simulate hardware response
    const hardwareResponse = {
      LCD: { message: "Binding complete" },
      weight: { enable: false },
      status: "binding_complete"
    };

    res.status(201).json({
      success: true,
      message: 'Pet binding completed successfully',
      animal: newAnimal,
      hardware_response: hardwareResponse
    });
  } catch (error) {
    console.error('Pet binding error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to bind pet', 
      details: error.message 
    });
  }
});

// GET /api/pets - Get all animals
router.get('/pets', async (req, res) => {
  try {
    const animals = await dbService.getAllAnimals();
    res.json({
      success: true,
      animals,
      count: animals.length
    });
  } catch (error) {
    console.error('Get animals error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve animals' 
    });
  }
});

// GET /api/pets/weight/:weight - Get animal by weight (helper function)
router.get('/pets/weight/:weight', async (req, res) => {
  try {
    const weight = parseFloat(req.params.weight);
    if (isNaN(weight)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid weight value' 
      });
    }

    const animal = await dbService.getAnimalByWeight(weight);
    if (!animal) {
      return res.status(404).json({ 
        success: false, 
        error: 'No animal found with matching weight' 
      });
    }

    res.json({
      success: true,
      animal,
      weight_detected: weight
    });
  } catch (error) {
    console.error('Get animal by weight error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to find animal by weight' 
    });
  }
});

// ##### 2. Schedule Setting #####

// POST /api/schedules - Create feeding schedule
router.post('/schedules', async (req, res) => {
  try {
    // Validate input
    const { error, value } = scheduleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.details[0].message 
      });
    }

    // Verify animal exists
    const animal = await dbService.getAnimalByContainerId(value.container_id);
    if (!animal) {
      return res.status(404).json({ 
        success: false, 
        error: `No animal found for container ${value.container_id}` 
      });
    }

    // Ensure animal_id matches
    if (animal.id !== value.animal_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Animal ID does not match container ID' 
      });
    }

    // Create schedule
    const newSchedule = await dbService.createFeedingSchedule(value);

    res.status(201).json({
      success: true,
      message: 'Feeding schedule created successfully',
      schedule: newSchedule,
      animal_name: animal.name
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create feeding schedule' 
    });
  }
});

// GET /api/schedules - Get all feeding schedules
router.get('/schedules', async (req, res) => {
  try {
    const { container_id } = req.query;
    
    let schedules;
    if (container_id) {
      schedules = await dbService.getSchedulesByContainerId(parseInt(container_id));
    } else {
      schedules = await dbService.getAllSchedules();
    }

    res.json({
      success: true,
      schedules,
      count: schedules.length
    });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve schedules' 
    });
  }
});

// ##### 3. Auto Trigger Feeding #####

// GET /api/feeding/check - Check and trigger scheduled feedings
router.get('/feeding/check', async (req, res) => {
  try {
    const currentSchedules = await dbService.getCurrentSchedules();
    
    if (currentSchedules.length === 0) {
      return res.json({
        success: true,
        message: 'No scheduled feedings at current time',
        triggered_feedings: []
      });
    }

    const triggeredFeedings = [];
    
    for (const schedule of currentSchedules) {
      // Calculate remaining food level after feeding
      const animal = await dbService.getAnimalByContainerId(schedule.container_id);
      const newFoodLevel = Math.max(0, animal.food_level - schedule.food_amount);
      
      // Create log entry
      const logEntry = await dbService.createLogEntry({
        animal_id: schedule.animal_id,
        container_id: schedule.container_id,
        food_portion: schedule.food_amount,
        remaining_food_level: newFoodLevel,
        feeding_type: 'scheduled'
      });

      // Update food level
      await dbService.updateFoodLevel(schedule.container_id, newFoodLevel);

      // Simulate hardware signal
      const hardwareSignal = {
        LCD: { message: "Ready" },
        motor: { 
          id: schedule.container_id, 
          enable: true, 
          amount: schedule.food_amount, 
          status: "not ready" 
        },
        weight: { enable: true }
      };

      triggeredFeedings.push({
        schedule_id: schedule.id,
        animal_name: schedule.animal_name,
        container_id: schedule.container_id,
        food_amount: schedule.food_amount,
        log_entry: logEntry,
        hardware_signal: hardwareSignal
      });
    }

    res.json({
      success: true,
      message: `Triggered ${triggeredFeedings.length} scheduled feeding(s)`,
      triggered_feedings: triggeredFeedings
    });
  } catch (error) {
    console.error('Auto trigger feeding error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check/trigger scheduled feedings' 
    });
  }
});

// ##### 4. Manual Trigger #####

// POST /api/feeding/manual - Trigger manual feeding
router.post('/feeding/manual', async (req, res) => {
  try {
    // Validate input
    const { error, value } = manualFeedingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.details[0].message 
      });
    }

    const { container_id, food_amount } = value;

    // Get animal for this container
    const animal = await dbService.getAnimalByContainerId(container_id);
    if (!animal) {
      return res.status(404).json({ 
        success: false, 
        error: `No animal found for container ${container_id}` 
      });
    }

    // Check if enough food available
    if (animal.food_level < food_amount) {
      return res.status(400).json({ 
        success: false, 
        error: `Insufficient food level. Available: ${animal.food_level}kg, Requested: ${food_amount}kg` 
      });
    }

    // Calculate remaining food level
    const newFoodLevel = Math.max(0, animal.food_level - food_amount);

    // Create log entry
    const logEntry = await dbService.createLogEntry({
      animal_id: animal.id,
      container_id: container_id,
      food_portion: food_amount,
      remaining_food_level: newFoodLevel,
      feeding_type: 'manual'
    });

    // Update food level
    await dbService.updateFoodLevel(container_id, newFoodLevel);

    // Simulate hardware signal
    const hardwareSignal = {
      LCD: { message: "Manual feeding" },
      motor: { 
        id: container_id, 
        enable: true, 
        amount: food_amount, 
        status: "not ready" 
      },
      weight: { enable: false }
    };

    res.status(201).json({
      success: true,
      message: 'Manual feeding triggered successfully',
      animal_name: animal.name,
      container_id: container_id,
      food_amount: food_amount,
      remaining_food_level: newFoodLevel,
      log_entry: logEntry,
      hardware_signal: hardwareSignal
    });
  } catch (error) {
    console.error('Manual trigger feeding error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to trigger manual feeding' 
    });
  }
});

// ##### 5. View Logs #####

// GET /api/logs - Retrieve feeding logs
router.get('/logs', async (req, res) => {
  try {
    const { container_id, limit = 50 } = req.query;
    
    let logs;
    if (container_id) {
      logs = await dbService.getLogsByContainerId(parseInt(container_id), parseInt(limit));
    } else {
      logs = await dbService.getLogEntries(parseInt(limit));
    }

    // Add formatted timestamps and additional info
    const formattedLogs = logs.map(log => ({
      ...log,
      dispense_time_formatted: new Date(log.dispense_time).toLocaleString(),
      food_portion_formatted: `${log.food_portion} kg`,
      remaining_food_level_formatted: `${log.remaining_food_level} kg`
    }));

    res.json({
      success: true,
      logs: formattedLogs,
      count: formattedLogs.length,
      filter: container_id ? `Container ${container_id}` : 'All containers'
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve feeding logs' 
    });
  }
});

// GET /api/logs/stats - Get feeding statistics
router.get('/logs/stats', async (req, res) => {
  try {
    const logs = await dbService.getLogEntries(1000); // Get more logs for stats
    
    const stats = {
      total_feedings: logs.length,
      scheduled_feedings: logs.filter(log => log.feeding_type === 'scheduled').length,
      manual_feedings: logs.filter(log => log.feeding_type === 'manual').length,
      total_food_dispensed: logs.reduce((sum, log) => sum + parseFloat(log.food_portion), 0).toFixed(2),
      last_feeding: logs.length > 0 ? logs[0].dispense_time : null,
      active_containers: [...new Set(logs.map(log => log.container_id))].length
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve feeding statistics' 
    });
  }
});

// ##### 6. MQTT Hardware Control #####

// GET /api/mqtt/weight/:sensorId - Get latest weight sensor reading
router.get('/mqtt/weight/:sensorId', (req, res) => {
  try {
    const sensorId = parseInt(req.params.sensorId);
    if (sensorId !== 1 && sensorId !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sensor ID. Must be 1 or 2'
      });
    }

    const weight = getLatestWeight(sensorId);
    
    res.json({
      success: true,
      sensor_id: sensorId,
      weight: weight,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get weight sensor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get weight sensor data'
    });
  }
});

// DELETE /api/mqtt/weight/:sensorId - Clear weight sensor data
router.delete('/mqtt/weight/:sensorId', (req, res) => {
  try {
    const sensorId = parseInt(req.params.sensorId);
    if (sensorId !== 1 && sensorId !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sensor ID. Must be 1 or 2'
      });
    }

    clearWeightSensor(sensorId);
    
    res.json({
      success: true,
      message: `Weight sensor ${sensorId} data cleared`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clear weight sensor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear weight sensor data'
    });
  }
});

// POST /api/mqtt/weight-sensor-control - Control weight sensor (enable/disable)
router.post('/mqtt/weight-sensor-control', (req, res) => {
  try {
    const { sensorId, enable } = req.body;
    
    if (sensorId !== 1 && sensorId !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sensor ID. Must be 1 or 2'
      });
    }

    if (typeof enable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Invalid enable value. Must be true or false'
      });
    }

    publishWeightSensorControl(sensorId, enable);
    
    res.json({
      success: true,
      message: `Weight sensor ${sensorId} ${enable ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Weight sensor control error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control weight sensor'
    });
  }
});

// POST /api/mqtt/motor1 - Control Motor 1
router.post('/mqtt/motor1', (req, res) => {
  try {
    const { command } = req.body;
    if (!command || !['start', 'stop'].includes(command)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid command. Must be "start" or "stop"'
      });
    }

    publishMotor1(command);
    
    res.json({
      success: true,
      message: `Motor 1 command sent: ${command}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Motor 1 control error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control Motor 1'
    });
  }
});

// POST /api/mqtt/motor2 - Control Motor 2
router.post('/mqtt/motor2', (req, res) => {
  try {
    const { command } = req.body;
    if (!command || !['start', 'stop'].includes(command)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid command. Must be "start" or "stop"'
      });
    }

    publishMotor2(command);
    
    res.json({
      success: true,
      message: `Motor 2 command sent: ${command}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Motor 2 control error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to control Motor 2'
    });
  }
});

// POST /api/mqtt/lcd - Send message to LCD
router.post('/mqtt/lcd', (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid message. Must be a string'
      });
    }

    publishLCD(message);
    
    res.json({
      success: true,
      message: 'LCD message sent',
      content: message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('LCD control error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send LCD message'
    });
  }
});

module.exports = router;
module.exports = router;