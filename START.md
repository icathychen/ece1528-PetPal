Clone the repository (they'll need Git access)
Install Docker Desktop (if not already installed)
Run the setup script: setup-local-simple.sh
./scripts/setup-local-simple.sh

Check that all services are running:
Frontend: http://localhost:3000 (same UI with dashboard and animal details)
Backend API: http://localhost:3001 (same functionality)
Database: Same schema with sample data
All Features: Pet binding, scheduling, manual feeding, logs

Command to check docker databse:

Quick Schedule Check
# Check all feeding schedules
docker-compose exec database psql -U petpal_user -d petpal_db -c "SELECT * FROM feeding_schedules ORDER BY created_at DESC;"
docker-compose exec database psql -U petpal_user -d petpal_db -c "SELECT * FROM animals"

Option 2: See Schedules with Animal Names
docker-compose exec database psql -U petpal_user -d petpal_db -c "
SELECT 
    fs.id,
    a.name as animal_name,
    a.animal_type,
    fs.container_id,
    fs.schedule_time,
    fs.food_amount,
    fs.is_active,
    fs.created_at
FROM feeding_schedules fs
JOIN animals a ON fs.animal_id = a.id
ORDER BY fs.created_at DESC;
"

Option 3: Interactive Database Session
# Connect to database interactively
docker-compose exec database psql -U petpal_user -d petpal_db

# Then run queries:
\dt                                    # List all tables
SELECT * FROM feeding_schedules;       # See all schedules
SELECT * FROM animals;                 # See all animals
\q                                     # Exit