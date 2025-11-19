const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'database',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'petpal_db',
  user: process.env.DB_USER || 'petpal_user',
  password: process.env.DB_PASSWORD || 'petpal_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Helper function to execute queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`Query executed in ${duration}ms: ${text.substring(0, 50)}...`);
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Database service functions
const dbService = {
  // Pet Binding Functions
  async createAnimal(animalData) {
    const { name, animal_type, weight, food_portion, food_level, container_id } = animalData;
    const queryText = `
      INSERT INTO animals (name, animal_type, weight, food_portion, food_level, container_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const result = await query(queryText, [name, animal_type, weight, food_portion, food_level, container_id]);
    return result.rows[0];
  },

  async getAnimalByContainerId(container_id) {
    const queryText = 'SELECT * FROM animals WHERE container_id = $1';
    const result = await query(queryText, [container_id]);
    return result.rows[0];
  },

  async getAllAnimals() {
    const queryText = 'SELECT * FROM animals ORDER BY created_at DESC';
    const result = await query(queryText);
    return result.rows;
  },

  // Schedule Setting Functions
  async createFeedingSchedule(scheduleData) {
    const { animal_id, container_id, schedule_time, food_amount } = scheduleData;
    const queryText = `
      INSERT INTO feeding_schedules (animal_id, container_id, schedule_time, food_amount)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await query(queryText, [animal_id, container_id, schedule_time, food_amount]);
    return result.rows[0];
  },

  async getSchedulesByContainerId(container_id) {
    const queryText = `
      SELECT fs.*, a.name as animal_name, a.animal_type 
      FROM feeding_schedules fs 
      JOIN animals a ON fs.animal_id = a.id 
      WHERE fs.container_id = $1 AND fs.is_active = true
      ORDER BY fs.schedule_time;
    `;
    const result = await query(queryText, [container_id]);
    return result.rows;
  },

  async getAllSchedules() {
    const queryText = `
      SELECT fs.*, a.name as animal_name, a.animal_type 
      FROM feeding_schedules fs 
      JOIN animals a ON fs.animal_id = a.id 
      WHERE fs.is_active = true
      ORDER BY fs.container_id, fs.schedule_time;
    `;
    const result = await query(queryText);
    return result.rows;
  },

  // Feeding Trigger Functions
  async getCurrentSchedules() { 
    const queryText = `
      SELECT fs.*, a.name as animal_name, a.animal_type, a.weight
      FROM feeding_schedules fs 
      JOIN animals a ON fs.animal_id = a.id 
      WHERE fs.is_active = true 
      AND fs.schedule_time = CURRENT_TIME::time(0)
      ORDER BY fs.container_id;
    `;
    const result = await query(queryText);
    return result.rows;
  },

  async createLogEntry(logData) {
    const { animal_id, container_id, food_portion, remaining_food_level, feeding_type = 'scheduled' } = logData;
    const queryText = `
      INSERT INTO log_entries (animal_id, container_id, food_portion, remaining_food_level, feeding_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await query(queryText, [animal_id, container_id, food_portion, remaining_food_level, feeding_type]);
    return result.rows[0];
  },

  async updateFoodLevel(container_id, new_food_level) {
    const queryText = `
      UPDATE animals 
      SET food_level = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE container_id = $1 
      RETURNING *;
    `;
    const result = await query(queryText, [container_id, new_food_level]);
    return result.rows[0];
  },

  // Log Retrieval Functions
  async getLogEntries(limit = 50) {
    const queryText = `
      SELECT le.*, a.name as animal_name, a.animal_type 
      FROM log_entries le 
      LEFT JOIN animals a ON le.animal_id = a.id 
      ORDER BY le.dispense_time DESC 
      LIMIT $1;
    `;
    const result = await query(queryText, [limit]);
    return result.rows;
  },

  async getLogsByContainerId(container_id, limit = 20) {
    const queryText = `
      SELECT le.*, a.name as animal_name, a.animal_type 
      FROM log_entries le 
      LEFT JOIN animals a ON le.animal_id = a.id 
      WHERE le.container_id = $1 
      ORDER BY le.dispense_time DESC 
      LIMIT $2;
    `;
    const result = await query(queryText, [container_id, limit]);
    return result.rows;
  },

  async getAnimalByWeight(weight, tolerance = 0.5) {
    const queryText = `
      SELECT * FROM animals 
      WHERE ABS(weight - $1) <= $2 
      ORDER BY ABS(weight - $1) 
      LIMIT 1;
    `;
    const result = await query(queryText, [weight, tolerance]);
    return result.rows[0];
  },

  // Health check
  async healthCheck() {
    const queryText = 'SELECT NOW() as current_time, version() as db_version';
    const result = await query(queryText);
    return result.rows[0];
  }
};

module.exports = { dbService, pool };