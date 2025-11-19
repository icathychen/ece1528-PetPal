#!/bin/bash
# Reset PetPal Database
# This script stops the containers, removes the database volume, and restarts everything

echo "🔄 Resetting PetPal Database..."
echo "================================"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null
then
    echo "❌ docker-compose not found. Please install Docker Compose."
    exit 1
fi

# Stop all containers
echo "⏹️  Stopping containers..."
docker-compose down

# Remove the database volume
echo "🗑️  Removing database volume..."
docker volume rm ece1528-petpal_postgres_data 2>/dev/null || echo "   Volume already removed or doesn't exist"

# Start containers again
echo "🚀 Starting containers with fresh database..."
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to initialize..."
sleep 10

# Check database health
echo "🏥 Checking database health..."
docker-compose exec -T database pg_isready -U petpal_user -d petpal_db

if [ $? -eq 0 ]; then
    echo "✅ Database reset complete!"
    echo ""
    echo "📊 Database contents:"
    docker-compose exec -T database psql -U petpal_user -d petpal_db -c "SELECT name, animal_type, weight, container_id FROM animals;"
    echo ""
    echo "🔄 Restarting backend to pick up changes..."
    docker-compose restart backend
    echo ""
    echo "✅ All done! You can now test with:"
    echo "   mosquitto_sub -h localhost -t motor1 -v"
    echo "   curl -X POST http://localhost:3001/api/feeding/feed -H 'Content-Type: application/json' -d '{\"container_id\":1,\"food_amount\":0.1}'"
else
    echo "❌ Database health check failed. Please check logs with: docker-compose logs database"
    exit 1
fi
