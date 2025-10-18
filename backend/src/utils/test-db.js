const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('📅 Current database time:', result.rows[0].current_time);
    
    // Test our tables
    const animals = await client.query('SELECT COUNT(*) FROM animals');
    console.log('🐾 Animals in database:', animals.rows[0].count);
    
    const schedules = await client.query('SELECT COUNT(*) FROM feeding_schedules');
    console.log('⏰ Feeding schedules:', schedules.rows[0].count);
    
    const logs = await client.query('SELECT COUNT(*) FROM log_entries');
    console.log('📝 Log entries:', logs.rows[0].count);
    
    // Test view
    const status = await client.query('SELECT * FROM current_feeding_status LIMIT 3');
    console.log('📊 Current feeding status (sample):');
    status.rows.forEach(row => {
      console.log(`   - ${row.pet_name}: ${row.system_status} (Food: ${row.food_level}kg)`);
    });
    
    client.release();
    console.log('✅ Database test completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('💡 Make sure the database container is running: docker-compose up database -d');
    process.exit(1);
  }
}

testConnection();
