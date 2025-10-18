-- PetPal Database Schema - Simplified Version
-- PostgreSQL database schema for the smart pet feeding system

-- Drop tables if they exist (for clean reinstallation)
DROP TABLE IF EXISTS log_entries CASCADE;
DROP TABLE IF EXISTS feeding_schedules CASCADE;
DROP TABLE IF EXISTS animals CASCADE;

-- Create Animals table
CREATE TABLE animals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    animal_type VARCHAR(50) NOT NULL, -- Cat, Dog, etc.
    weight DECIMAL(5,2) NOT NULL CHECK (weight > 0),
    food_portion DECIMAL(5,2) NOT NULL CHECK (food_portion > 0), -- Default portion per feeding
    food_level DECIMAL(5,2) NOT NULL CHECK (food_level >= 0), -- Current food level in container
    container_id INTEGER NOT NULL UNIQUE, -- Each animal has a unique container
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create feeding schedules table (simplified)
CREATE TABLE feeding_schedules (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    container_id INTEGER NOT NULL,
    schedule_time TIME NOT NULL, -- Time to feed (e.g., '08:00:00')
    food_amount DECIMAL(5,2) NOT NULL CHECK (food_amount > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create log entries table for feeding history
CREATE TABLE log_entries (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
    container_id INTEGER NOT NULL,
    dispense_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    food_portion DECIMAL(5,2) NOT NULL CHECK (food_portion >= 0),
    remaining_food_level DECIMAL(5,2) NOT NULL CHECK (remaining_food_level >= 0),
    feeding_type VARCHAR(20) DEFAULT 'scheduled' CHECK (feeding_type IN ('scheduled', 'manual'))
);

-- Create indexes for better performance
CREATE INDEX idx_animals_container_id ON animals(container_id);
CREATE INDEX idx_feeding_schedules_animal_id ON feeding_schedules(animal_id);
CREATE INDEX idx_feeding_schedules_container_id ON feeding_schedules(container_id);
CREATE INDEX idx_feeding_schedules_time ON feeding_schedules(schedule_time);
CREATE INDEX idx_feeding_schedules_active ON feeding_schedules(is_active);
CREATE INDEX idx_log_entries_animal_id ON log_entries(animal_id);
CREATE INDEX idx_log_entries_container_id ON log_entries(container_id);
CREATE INDEX idx_log_entries_dispense_time ON log_entries(dispense_time);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_animals_updated_at 
    BEFORE UPDATE ON animals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO animals (name, animal_type, weight, food_portion, food_level, container_id) VALUES
('Whiskers', 'Cat', 3.10, 0.20, 2.50, 1),
('Buddy', 'Dog', 15.50, 0.50, 5.00, 2);

INSERT INTO feeding_schedules (animal_id, container_id, schedule_time, food_amount) VALUES
(1, 1, '08:00:00', 0.20),
(1, 1, '18:00:00', 0.20),
(2, 2, '07:30:00', 0.50),
(2, 2, '17:30:00', 0.50);

-- Insert some sample log entries
INSERT INTO log_entries (animal_id, container_id, food_portion, remaining_food_level, feeding_type) VALUES
(1, 1, 0.20, 2.30, 'scheduled'),
(1, 1, 0.20, 2.10, 'scheduled'),
(2, 2, 0.50, 4.50, 'scheduled'),
(2, 2, 0.25, 4.25, 'manual');

-- Grant permissions to the application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO petpal_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO petpal_user;

-- Display summary of created objects
SELECT 'Database Setup Complete!' as status
UNION ALL
SELECT '=========================' as status
UNION ALL
SELECT CONCAT('Animals: ', COUNT(*)) as status FROM animals
UNION ALL
SELECT CONCAT('Feeding Schedules: ', COUNT(*)) as status FROM feeding_schedules
UNION ALL
SELECT CONCAT('Log Entries: ', COUNT(*)) as status FROM log_entries;