# PetPal Local Development with Docker

## Overview
This guide helps you set up and run the PetPal smart feeding system locally using Docker. This approach provides a consistent development environment that closely matches production.

## Prerequisites

### 1. Install Docker
```bash
# macOS (using Homebrew)
brew install docker docker-compose

# Or download Docker Desktop from https://docker.com/products/docker-desktop
```

### 2. Verify Docker Installation
```bash
docker --version
docker-compose --version

# Start Docker Desktop if using the GUI version
```

## Quick Start (5 minutes setup)

### 1. Clone and Navigate to Project
```bash
cd /Users/cathychen/Developer/ece1528-PetPal
```

### 2. Start the Database Only (Recommended first step)
```bash
# Start just the database to test schema
docker-compose up database -d

# Check if database is running
docker-compose ps

# Check database logs
docker-compose logs database
```

### 3. Test Database Connection
```bash
# Connect to database using psql in Docker
docker-compose exec database psql -U petpal_user -d petpal_db

# Or connect from your local machine (if you have psql installed)
psql -h localhost -U petpal_user -d petpal_db

# Test queries
\dt                                    # List tables
SELECT * FROM animals;                 # Check sample data
SELECT * FROM current_feeding_status;  # Check views
\q                                     # Exit
```

### 4. Start All Services
```bash
# Start all services (database, backend, frontend, etc.)
docker-compose up -d

# Check all services are running
docker-compose ps

# View logs for all services
docker-compose logs -f
```

### 5. Access Your Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Database**: localhost:5432
- **PgAdmin** (Database GUI): http://localhost:8080
- **MQTT Broker**: localhost:1883

## Development Workflow

### Working with the Database

#### View Database in PgAdmin
1. Go to http://localhost:8080
2. Login with:
   - Email: `admin@petpal.com`
   - Password: `admin123`
3. Add server connection:
   - Host: `database` (or `localhost` if connecting from outside Docker)
   - Port: `5432`
   - Database: `petpal_db`
   - Username: `petpal_user`
   - Password: `petpal_secure_password`

#### Run SQL Commands
```bash
# Execute SQL file in running database
docker-compose exec database psql -U petpal_user -d petpal_db -f /docker-entrypoint-initdb.d/1-schema.sql

# Run individual commands
docker-compose exec database psql -U petpal_user -d petpal_db -c "SELECT COUNT(*) FROM animals;"

# Connect interactively
docker-compose exec database psql -U petpal_user -d petpal_db
```

#### Backup and Restore Database
```bash
# Create backup
docker-compose exec database pg_dump -U petpal_user -d petpal_db > backup.sql

# Restore backup
docker-compose exec -T database psql -U petpal_user -d petpal_db < backup.sql
```

### Backend Development

#### View Backend Logs
```bash
# Follow backend logs
docker-compose logs -f backend

# View last 100 lines
docker-compose logs --tail=100 backend
```

#### Install New NPM Packages
```bash
# Install packages in running container
docker-compose exec backend npm install package-name

# Or rebuild container after updating package.json
docker-compose build backend
docker-compose up -d backend
```

#### Debug Backend
```bash
# Access backend container shell
docker-compose exec backend sh

# Check environment variables
docker-compose exec backend env

# Test database connection from backend
docker-compose exec backend npm run test:db
```

### Frontend Development

#### Hot Reload
The frontend container is configured for hot reload. Changes to files in `./frontend/src/` will automatically refresh the browser.

#### View Frontend Logs
```bash
docker-compose logs -f frontend
```

#### Install New Packages
```bash
# Install new React packages
docker-compose exec frontend npm install package-name

# Rebuild if needed
docker-compose build frontend
docker-compose up -d frontend
```

## Project Structure Setup

### 1. Create Basic Project Structure
```bash
# Create necessary directories
mkdir -p backend/src/{functions,models,services,utils}
mkdir -p frontend/src/{components,pages,services}
mkdir -p database/init
mkdir -p docker/mosquitto
mkdir -p scripts
```

### 2. Create Backend Package.json
```bash
# Create backend/package.json
cat > backend/package.json << 'EOF'
{
  "name": "petpal-backend",
  "version": "1.0.0",
  "description": "PetPal Backend API",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "test:db": "node src/utils/test-db.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.0",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.7.0"
  }
}
EOF
```

### 3. Create Frontend (React App)
```bash
# Navigate to frontend directory and create React app
cd frontend
npx create-react-app . --template typescript
cd ..
```

### 4. Create Basic Backend Server
```bash
# Create backend/src/index.js
cat > backend/src/index.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected' // TODO: Add actual DB health check
  });
});

// API routes
app.get('/api/pets', (req, res) => {
  res.json({ message: 'PetPal API is running!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PetPal Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
EOF
```

### 5. Create Database Connection Test
```bash
# Create backend/src/utils/test-db.js
cat > backend/src/utils/test-db.js << 'EOF'
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log('📅 Current time:', result.rows[0].now);
    
    // Test our tables
    const animals = await client.query('SELECT COUNT(*) FROM animals');
    console.log('🐾 Animals in database:', animals.rows[0].count);
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();
EOF
```

## Docker Commands Reference

### Service Management
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d database

# Stop all services
docker-compose down

# Stop and remove volumes (CAUTION: deletes data)
docker-compose down -v

# Restart a service
docker-compose restart backend

# View running services
docker-compose ps

# View logs
docker-compose logs -f [service-name]
```

### Container Management
```bash
# Execute command in running container
docker-compose exec database psql -U petpal_user -d petpal_db

# Access container shell
docker-compose exec backend sh

# View container resource usage
docker stats

# Remove stopped containers
docker container prune

# Remove unused images
docker image prune
```

### Building and Updates
```bash
# Rebuild all images
docker-compose build

# Rebuild specific service
docker-compose build backend

# Pull latest images
docker-compose pull

# Force recreate containers
docker-compose up -d --force-recreate
```

## Environment Variables

### Create .env File
```bash
# Create .env in project root
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

## Testing Your Setup

### 1. Test Database
```bash
# Check database is accessible
docker-compose exec database psql -U petpal_user -d petpal_db -c "SELECT 'Database OK' as status;"
```

### 2. Test Backend API
```bash
# Test health endpoint
curl http://localhost:3001/health

# Test API endpoint
curl http://localhost:3001/api/pets
```

### 3. Test Frontend
```bash
# Check frontend is serving
curl http://localhost:3000

# Or open in browser: http://localhost:3000
```

### 4. Test Database Connection from Backend
```bash
docker-compose exec backend npm run test:db
```

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check if database is running
docker-compose ps database

# Check database logs
docker-compose logs database

# Restart database
docker-compose restart database

# Check network connectivity
docker-compose exec backend ping database
```

#### Port Conflicts
```bash
# If ports 3000, 3001, or 5432 are in use:
# 1. Stop conflicting services
lsof -ti:3000 | xargs kill -9  # Stop process on port 3000

# 2. Or modify ports in docker-compose.yml
# Change "3000:3000" to "3001:3000" for frontend
```

#### Container Build Issues
```bash
# Clear Docker cache and rebuild
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

#### File Permission Issues (on Linux/WSL)
```bash
# Fix ownership
sudo chown -R $USER:$USER .

# Or run Docker as non-root user
sudo usermod -aG docker $USER
```

### Useful Debugging Commands
```bash
# View all Docker networks
docker network ls

# Inspect the petpal network
docker network inspect ece1528-petpal_petpal-network

# View container details
docker-compose exec database env

# Check disk usage
docker system df

# View resource usage
docker stats
```

## Next Steps

1. ✅ **Start with Database**: Run `docker-compose up database -d`
2. ✅ **Test Connection**: Use psql or PgAdmin to verify database
3. 📝 **Create Backend**: Build basic Express.js API
4. 📝 **Create Frontend**: Set up React components
5. 📝 **Add API Endpoints**: Implement pet binding, scheduling, etc.
6. 📝 **Test Integration**: Connect frontend to backend to database
7. 📝 **Add Hardware Communication**: MQTT for IoT devices

Your local development environment is now ready! The database will persist data between restarts, and you can easily migrate to cloud later by updating connection strings.