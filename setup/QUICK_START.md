# PetPal Quick Start Guide

## 🚀 Get Your Development Environment Running in 5 Minutes

This guide will get your complete PetPal development environment up and running with Docker containers.

## Prerequisites

### 1. Install Docker Desktop
```bash
# Check if Docker is installed
docker --version

# If not installed, download from:
# https://docker.com/products/docker-desktop
```

### 2. Start Docker Desktop
- Open Docker Desktop application
- Wait for it to fully start (Docker icon in menu bar should be green)

### 3. Verify Docker is Running
```bash
docker info
# Should show Docker system information without errors
```

## Quick Setup (Automated)

### Option A: One-Command Setup
```bash
# Navigate to project directory
cd /Users/cathychen/Developer/ece1528-PetPal

# Run automated setup script
./scripts/setup-local-simple.sh
```

This script will:
- ✅ Check Docker installation
- ✅ Validate project structure
- ✅ Create environment configuration
- ✅ Start PostgreSQL database
- ✅ Load database schema and sample data
- ✅ Build and start all containers
- ✅ Test connections and show access URLs

## Manual Setup (Step by Step)

### Step 1: Project Structure Check
```bash
# Make sure you're in the right directory
pwd
# Should show: /Users/cathychen/Developer/ece1528-PetPal

# Check required files exist
ls -la database/schema.sql backend/package.json frontend/package.json
```

### Step 2: Environment Configuration
```bash
# Check if .env file exists
ls -la .env

# If missing, the setup script will create it, or create manually:
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
```

### Step 3: Start Database First
```bash
# Start PostgreSQL database container
docker-compose up database -d

# Wait for database to be ready (check logs)
docker-compose logs -f database

# Test database connection
docker-compose exec database psql -U petpal_user -d petpal_db -c "SELECT 'Database Ready!' as status;"
```

### Step 4: Start All Services
```bash
# Build and start all containers
docker-compose up --build -d

# Check all services are running
docker-compose ps
```

### Step 5: Verify Everything is Working
```bash
# Test backend health
curl http://localhost:3001/health

# Test API endpoint
curl http://localhost:3001/api/pets

# Check database sample data
docker-compose exec database psql -U petpal_user -d petpal_db -c "SELECT COUNT(*) FROM animals;"
```

## Access Your Application

### 🌐 Frontend (React App)
- **URL**: http://localhost:3000
- **Description**: Main web interface for PetPal system
- **Expected**: "🐾 PetPal Smart Feeding System" welcome page

### 🔧 Backend (API)
- **Health Check**: http://localhost:3001/health
- **API Documentation**: http://localhost:3001/api/pets
- **Base URL**: http://localhost:3001

### 🗄️ Database Management
- **PgAdmin GUI**: http://localhost:8080
- **Login**: admin@petpal.com / admin123
- **Direct Connection**: localhost:5432
- **Credentials**: petpal_user / petpal_secure_password

### 📡 Additional Services
- **MQTT Broker**: localhost:1883 (for hardware communication)
- **Redis Cache**: localhost:6379

## Verify Your Setup

### Test All Components
```bash
# 1. Test Frontend
curl -I http://localhost:3000
# Should return: HTTP/1.1 200 OK

# 2. Test Backend Health
curl http://localhost:3001/health
# Should return: {"status":"healthy","timestamp":"..."}

# 3. Test API Endpoints
curl http://localhost:3001/api/pets
# Should return: {"message":"PetPal API is running!","endpoints":[...]}

# 4. Test Database Connection
docker-compose exec database psql -U petpal_user -d petpal_db -c "SELECT name, container_id FROM animals;"
# Should show sample pet data

# 5. Check All Containers
docker-compose ps
# Should show 6 containers running: database, backend, frontend, pgadmin, mqtt, redis
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

## Development Workflow

### Making Code Changes
Your code changes will automatically sync to containers:

```bash
# Edit backend files
# File: backend/src/index.js
# Changes appear instantly in container (hot reload)

# Edit frontend files  
# File: frontend/src/App.tsx
# Browser refreshes automatically
```

### Database Operations
```bash
# Connect to database
docker-compose exec database psql -U petpal_user -d petpal_db

# View tables
\dt

# Sample queries
SELECT * FROM animals;
SELECT * FROM current_feeding_status;
SELECT * FROM daily_feeding_summary;

# Exit
\q
```

### Container Management
```bash
# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Restart specific service
docker-compose restart backend

# View resource usage
docker stats

# Clean up (removes all data!)
docker-compose down -v
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find what's using the port
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
lsof -ti:3001 | xargs kill -9  # Kill process on port 3001
lsof -ti:5432 | xargs kill -9  # Kill process on port 5432
```

#### 2. Docker Not Running
```bash
# Start Docker Desktop app
open -a Docker

# Wait for Docker to start, then retry
docker info
```

#### 3. Database Connection Issues
```bash
# Check database logs
docker-compose logs database

# Restart database
docker-compose restart database

# Test connection
docker-compose exec database pg_isready -U petpal_user -d petpal_db
```

#### 4. Container Build Errors
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Start fresh
docker-compose up --build -d
```

#### 5. Schema Changes Not Applied
```bash
# Fresh start with new schema
docker-compose down -v
./scripts/setup-local-simple.sh
```

### Getting Help
```bash
# View container details
docker-compose exec backend env  # Check environment variables
docker-compose exec database psql -U petpal_user -d petpal_db -c "\l"  # List databases

# Network connectivity
docker-compose exec backend ping database  # Test backend can reach database
docker-compose exec frontend ping backend  # Test frontend can reach backend
```

## Next Steps

### 1. Explore Your Application
- Open http://localhost:3000 to see the React frontend
- Test API endpoints at http://localhost:3001/api/pets
- Browse database with PgAdmin at http://localhost:8080

### 2. Start Development
- Modify `backend/src/index.js` to add API endpoints
- Edit `frontend/src/App.tsx` to build UI components
- Update `database/schema.sql` for schema changes

### 3. Add Features
- Pet binding functionality
- Feeding schedule management
- Real-time status monitoring
- Hardware communication via MQTT

### 4. Learn More
- Read `setup/DOCKER_LOCAL_SETUP.md` for detailed Docker info
- Check `setup/DATABASE_SETUP.md` for database options
- Review `setup/CLOUD_SETUP.md` for production deployment

## Success! 🎉

If you can access all the URLs above, your PetPal development environment is ready!

You now have:
- ✅ PostgreSQL database with your schema
- ✅ Node.js backend API
- ✅ React frontend application
- ✅ Database management tools
- ✅ MQTT broker for hardware
- ✅ Hot reload for development

Start building your smart pet feeding system! 🐾