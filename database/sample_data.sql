-- Sample data for testing PetPal system (Simplified Schema)
-- Run this after creating the schema

-- Clear existing data (if any)
TRUNCATE TABLE log_entries, feeding_schedules, animals RESTART IDENTITY CASCADE;

-- Insert test animals
INSERT INTO animals (name, animal_type, weight, food_portion, food_level, container_id) VALUES
('Whiskers', 'Cat', 3.10, 0.20, 2.50, 1),
('Buddy', 'Dog', 15.50, 0.50, 5.00, 2),
('Mittens', 'Cat', 2.80, 0.15, 1.20, 3),
('Rex', 'Dog', 25.30, 0.75, 3.50, 4);

-- Insert feeding schedules
INSERT INTO feeding_schedules (animal_id, container_id, schedule_time, food_amount) VALUES
-- Whiskers (Cat) - twice daily
(1, 1, '08:00:00', 0.20),
(1, 1, '18:00:00', 0.20),

-- Buddy (Dog) - twice daily  
(2, 2, '07:30:00', 0.50),
(2, 2, '17:30:00', 0.50),

-- Mittens (Cat) - three times daily
(3, 3, '07:00:00', 0.15),
(3, 3, '13:00:00', 0.15),
(3, 3, '19:00:00', 0.15),

-- Rex (Dog) - twice daily
(4, 4, '08:30:00', 0.75),
(4, 4, '18:30:00', 0.75);

-- Insert historical log entries (last 7 days)
INSERT INTO log_entries (animal_id, container_id, dispense_time, food_portion, remaining_food_level, feeding_type) VALUES
-- Today's feedings
(1, 1, CURRENT_TIMESTAMP - INTERVAL '2 hours', 0.20, 2.30, 'scheduled'),
(2, 2, CURRENT_TIMESTAMP - INTERVAL '3 hours', 0.50, 4.50, 'scheduled'),
(3, 3, CURRENT_TIMESTAMP - INTERVAL '1 hour', 0.15, 1.05, 'scheduled'),

-- Yesterday's feedings
(1, 1, CURRENT_TIMESTAMP - INTERVAL '1 day 2 hours', 0.20, 2.50, 'scheduled'),
(1, 1, CURRENT_TIMESTAMP - INTERVAL '1 day 14 hours', 0.20, 2.70, 'scheduled'),
(2, 2, CURRENT_TIMESTAMP - INTERVAL '1 day 3 hours', 0.50, 5.00, 'scheduled'),
(2, 2, CURRENT_TIMESTAMP - INTERVAL '1 day 15 hours', 0.50, 5.50, 'scheduled'),
(3, 3, CURRENT_TIMESTAMP - INTERVAL '1 day 1 hour', 0.15, 1.20, 'scheduled'),
(3, 3, CURRENT_TIMESTAMP - INTERVAL '1 day 7 hours', 0.15, 1.35, 'scheduled'),
(3, 3, CURRENT_TIMESTAMP - INTERVAL '1 day 13 hours', 0.15, 1.50, 'scheduled'),

-- Manual feedings (2-3 days ago)
(1, 1, CURRENT_TIMESTAMP - INTERVAL '2 days 10 hours', 0.10, 2.80, 'manual'),
(2, 2, CURRENT_TIMESTAMP - INTERVAL '3 days 6 hours', 0.25, 5.75, 'manual'),
(4, 4, CURRENT_TIMESTAMP - INTERVAL '2 days 2 hours', 0.75, 2.75, 'scheduled'),
(4, 4, CURRENT_TIMESTAMP - INTERVAL '3 days 1 hour', 0.50, 3.00, 'manual');

-- Display summary of inserted test data
SELECT 'Test Data Summary' as category, '' as item, '' as count
UNION ALL
SELECT '', 'Animals:', COUNT(*)::text FROM animals
UNION ALL  
SELECT '', 'Feeding Schedules:', COUNT(*)::text FROM feeding_schedules
UNION ALL
SELECT '', 'Log Entries:', COUNT(*)::text FROM log_entries
UNION ALL
SELECT '', '', ''
UNION ALL
SELECT 'Sample Feeding Schedule', '', ''
UNION ALL
SELECT '', 'Whiskers (Cat):', '8:00 AM & 6:00 PM (0.20 kg each)'
UNION ALL
SELECT '', 'Buddy (Dog):', '7:30 AM & 5:30 PM (0.50 kg each)'
UNION ALL
SELECT '', 'Mittens (Cat):', '7:00 AM, 1:00 PM & 7:00 PM (0.15 kg each)'
UNION ALL
SELECT '', 'Rex (Dog):', '8:30 AM & 6:30 PM (0.75 kg each)'
UNION ALL
SELECT '', '', ''
UNION ALL
SELECT 'Query Examples', '', ''
UNION ALL
SELECT '', 'JOIN animals & schedules:', 'SELECT a.name, fs.schedule_time FROM animals a JOIN feeding_schedules fs ON a.id = fs.animal_id WHERE a.name = ''Whiskers'';';