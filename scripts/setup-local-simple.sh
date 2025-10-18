#!/bin/bash

# PetPal Quick Setup Script - Updated for current project structure
# This script sets up the complete local development environment

set -e  # Exit on any error

echo "🐾 PetPal Local Development Setup"
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   Download from: https://docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is installed and running"

# Check if we're in the right directory
if [ ! -f "database/schema.sql" ]; then
    echo "❌ database/schema.sql not found. Please make sure you're in the project root directory."
    echo "💡 Expected to find database/schema.sql with your database schema."
    echo "📁 Current directory: $(pwd)"
    echo "📋 Available files:"
    ls -la
    exit 1
fi

echo "✅ Found database schema file"

# Check required files exist
if [ ! -f "backend/package.json" ]; then
    echo "❌ backend/package.json not found. Please check your project structure."
    exit 1
fi

if [ ! -f "frontend/package.json" ]; then
    echo "❌ frontend/package.json not found. Please check your project structure."
    exit 1
fi

echo "✅ Backend and frontend package.json files found"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << 'EOF'
# Database Configuration
DB_HOST=database
DB_PORT=5432
DB_NAME=petpal_db
DB_USER=petpal_user
DB_PASSWORD=petpal_secure_password
DATABASE_URL=postgresql://petpal_user:petpal_secure_password@database:5432/petpal_db

# Application Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# MQTT Configuration
MQTT_BROKER_URL=mqtt://mqtt:1883

# Development Settings
DEBUG=true
LOG_LEVEL=debug
EOF
    echo "✅ Created .env file"
else
    echo "✅ .env file already exists"
fi

# Stop any existing containers
echo "🧹 Stopping existing containers..."
docker-compose down || true

# Start database first
echo "🗄️  Starting PostgreSQL database..."
docker-compose up database -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
for i in {1..30}; do
    if docker-compose exec -T database pg_isready -U petpal_user -d petpal_db &>/dev/null; then
        echo "✅ Database is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Database failed to start after 30 seconds"
        echo "📋 Database logs:"
        docker-compose logs database
        exit 1
    fi
    sleep 1
done

# Test database connection
echo "🧪 Testing database connection..."
if docker-compose exec -T database psql -U petpal_user -d petpal_db -c "SELECT 'Database OK' as status;" &>/dev/null; then
    echo "✅ Database connection successful"
    
    # Show some sample data
    echo "📊 Database sample data:"
    docker-compose exec -T database psql -U petpal_user -d petpal_db -c "SELECT COUNT(*) as animal_count FROM animals;" 2>/dev/null || echo "   Tables not yet populated"
else
    echo "❌ Database connection failed"
    docker-compose logs database
    exit 1
fi

# Build and start all services
echo "🚀 Building and starting all services..."
docker-compose up --build -d

# Wait a moment for services to start
sleep 10

# Check service status
echo "📊 Checking service status..."
echo "Services running:"
docker-compose ps

# Test backend health
echo "🏥 Testing backend health..."
for i in {1..10}; do
    if curl -s http://localhost:3001/health &>/dev/null; then
        echo "✅ Backend is healthy!"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "⚠️  Backend not responding yet, but containers are running"
        echo "📋 Backend logs:"
        docker-compose logs --tail=20 backend
    fi
    sleep 2
done

echo ""
echo "🎉 PetPal setup completed!"
echo ""
echo "📱 Access your application:"
echo "   🌐 Frontend:  http://localhost:3000"
echo "   🔧 Backend:   http://localhost:3001"
echo "   📖 API Docs:  http://localhost:3001/api/pets"
echo "   🏥 Health:    http://localhost:3001/health"
echo "   🗄️  PgAdmin:   http://localhost:8080"
echo "   💾 Database:  localhost:5432"
echo ""
echo "🔑 Database credentials:"
echo "   Host:     localhost (or 'database' from containers)"
echo "   Port:     5432"
echo "   Database: petpal_db"
echo "   Username: petpal_user"
echo "   Password: petpal_secure_password"
echo ""
echo "🔧 Useful commands:"
echo "   docker-compose logs -f           # View all logs"
echo "   docker-compose logs -f backend   # View backend logs only"
echo "   docker-compose logs -f frontend  # View frontend logs only"
echo "   docker-compose exec database psql -U petpal_user -d petpal_db  # Connect to database"
echo "   docker-compose down              # Stop all services"
echo "   docker-compose up -d             # Start all services"
echo "   docker-compose restart backend   # Restart just backend"
echo ""
echo "🧪 Test your setup:"
echo "   curl http://localhost:3001/health"
echo "   curl http://localhost:3001/api/pets"
echo ""
echo "📖 Next steps:"
echo "   1. Open http://localhost:3001/health to verify backend"
echo "   2. Open http://localhost:3000 to see your React app"  
echo "   3. Open http://localhost:8080 to access PgAdmin database GUI"
echo "   4. Start developing your pet feeding features!"
echo ""
echo "📚 Documentation:"
echo "   - setup/DOCKER_LOCAL_SETUP.md - Detailed Docker guide"
echo "   - setup/DATABASE_SETUP.md - Database setup options"
echo "   - setup/CLOUD_SETUP.md - Cloud deployment guide"