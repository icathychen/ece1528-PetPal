# PetPal Project Structure Guide

## Overview
This guide helps you organize your PetPal smart feeding system project with proper folder structure, development workflow, and best practices.

## Recommended Project Structure

```
ece1528-PetPal/
├── README.md
├── .gitignore
├── .env
├── docker-compose.yml
│
├── meeting/                          # Project documentation
│   ├── oct16.md
│   └── project-timeline.md
│
├── setup/                           # Setup and deployment guides
│   ├── DATABASE_SETUP.md
│   ├── CLOUD_SETUP.md
│   ├── DOCKER_LOCAL_SETUP.md
│   ├── PROJECT_STRUCTURE.md
│   └── QUICK_START.md
│
├── database/                        # Database schemas and migrations
│   ├── schema.sql
│   ├── sample_data.sql
│   ├── pgadmin-servers.json
│   └── migrations/
│
├── backend/                         # Node.js API server
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── index.js                 # Main server file
│       ├── functions/               # API endpoint functions
│       │   ├── petBinding.js
│       │   ├── scheduleFeed.js
│       │   ├── triggerFeeding.js
│       │   └── processStatus.js
│       ├── models/                  # Database models
│       │   ├── Animal.js
│       │   ├── Schedule.js
│       │   └── LogEntry.js
│       ├── services/                # Business logic
│       │   ├── database.js
│       │   ├── mqtt.js
│       │   └── notifications.js
│       └── utils/                   # Helper functions
│           ├── validation.js
│           ├── helpers.js
│           └── test-db.js
│
├── frontend/                        # React web dashboard
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.tsx                # React entry point
│       ├── App.tsx                  # Main App component
│       ├── App.css
│       ├── index.css
│       ├── components/              # React components
│       │   ├── Dashboard/
│       │   ├── PetBinding/
│       │   ├── Scheduling/
│       │   ├── Logs/
│       │   └── common/
│       ├── pages/                   # Page components
│       ├── services/                # API calls
│       ├── hooks/                   # Custom React hooks
│       └── utils/                   # Frontend utilities
│
├── hardware/                        # Arduino/C code for hardware
│   ├── main/
│   │   ├── main.ino
│   │   ├── config.h
│   │   └── README.md
│   ├── libraries/
│   │   ├── WeightSensor/
│   │   ├── MotorControl/
│   │   ├── LCDDisplay/
│   │   └── WiFiComm/
│   └── tests/
│
├── docker/                          # Docker configuration
│   └── mosquitto/
│       └── mosquitto.conf
│
├── docs/                            # Project documentation
│   ├── api/
│   ├── hardware/
│   └── architecture.md
│
├── scripts/                         # Development and deployment scripts
│   ├── setup-local.sh
│   ├── setup-local-simple.sh
│   └── backup-db.sh
│
└── logs/                            # Application logs
```

## Step-by-Step Project Setup

### 1. Initialize the Project Structure

Let me create the basic project structure for you:

```bash
# Create main directories
mkdir -p backend/{src/{functions,models,services,utils},tests,deployment/{aws,gcp,scripts}}
mkdir -p frontend/{src/{components/{Dashboard,PetBinding,Scheduling,Logs,common},pages,services,hooks,utils,styles},tests,build}
mkdir -p hardware/{main,libraries/{WeightSensor,MotorControl,LCDDisplay,WiFiComm},tests,schematics}
mkdir -p docs/{api,hardware}
mkdir -p scripts
```

## Docker Development Environment

Your project is set up to run entirely in Docker containers:

### Services Running
1. **PostgreSQL Database** (port 5432) - Your simplified database
2. **Node.js Backend** (port 3001) - Express API server  
3. **React Frontend** (port 3000) - TypeScript React app
4. **PgAdmin** (port 8080) - Database management GUI
5. **MQTT Broker** (port 1883) - For hardware communication
6. **Redis** (port 6379) - Caching and sessions

### Quick Commands
```bash
# Start all services
./scripts/setup-local-simple.sh

# Stop all services  
docker-compose down

# Restart specific service
docker-compose restart backend

# View logs
docker-compose logs -f frontend

# Access database
docker-compose exec database psql -U petpal_user -d petpal_db
```

### Development Workflow
- **Hot Reload**: Edit files on your Mac → changes sync to containers
- **Database**: Persists between restarts via Docker volumes
- **Environment**: Consistent across all team members

## Database Schema (Simplified)

Based on your project requirements, the database consists of three main tables:

### Animals Table
| Field | Type | Description |
|-------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique animal identifier |
| name | VARCHAR(100) | Pet name |
| animal_type | VARCHAR(50) | Type of animal (Cat, Dog, etc.) |
| weight | DECIMAL(5,2) | Pet weight in kg |
| food_portion | DECIMAL(5,2) | Default food amount per feeding |
| food_level | DECIMAL(5,2) | Current food level in container |
| container_id | INTEGER UNIQUE | Physical container identifier |

### Feeding Schedules Table  
| Field | Type | Description |
|-------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique schedule identifier |
| animal_id | INTEGER | References animals(id) |
| container_id | INTEGER | Physical container identifier |
| schedule_time | TIME | When to feed (HH:MM:SS) |
| food_amount | DECIMAL(5,2) | Amount of food to dispense |
| is_active | BOOLEAN | Whether this schedule is enabled |

### Log Entries Table
| Field | Type | Description |
|-------|------|-------------|
| id | SERIAL PRIMARY KEY | Unique log identifier |
| animal_id | INTEGER | References animals(id) |
| container_id | INTEGER | Physical container identifier |
| dispense_time | TIMESTAMP | When feeding occurred |
| food_portion | DECIMAL(5,2) | Amount dispensed |
| remaining_food_level | DECIMAL(5,2) | Food level after dispensing |
| feeding_type | VARCHAR(20) | 'scheduled' or 'manual' |

### Key Relationships
- Each **animal** has a unique **container_id**
- **Feeding schedules** link to animals via **animal_id**
- **Log entries** track all feeding events
- **Container_id** connects physical hardware to database records

```json
{
  "name": "petpal-backend",
  "version": "1.0.0",
  "description": "PetPal Smart Feeding System Backend",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "jest",
    "deploy:aws": "bash deployment/scripts/deploy-aws.sh",
    "deploy:gcp": "bash deployment/scripts/deploy-gcp.sh"
  },
  "dependencies": {
    "pg": "^8.11.0",
    "aws-sdk": "^2.1490.0",
    "@google-cloud/functions-framework": "^3.0.0",
    "@google-cloud/pubsub": "^4.0.0",
    "mqtt": "^5.1.0",
    "dotenv": "^16.3.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0"
  }
}
```

### 3. Frontend Setup (React)

```bash
# Navigate to frontend directory
cd frontend

# Create React app
npx create-react-app . --template typescript

# Install additional dependencies
npm install @mui/material @emotion/react @emotion/styled
npm install @mui/icons-material
npm install axios
npm install react-router-dom
npm install @types/react-router-dom
```

Frontend package.json additions:
```json
{
  "dependencies": {
    "@mui/material": "^5.14.0",
    "@mui/icons-material": "^5.14.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "axios": "^1.6.0",
    "react-router-dom": "^6.17.0"
  }
}
```

### 4. Create Environment Configuration

Create `.env.example`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=petpal_db
DB_USER=petpal_user
DB_PASSWORD=your_secure_password
DATABASE_URL=postgresql://petpal_user:password@localhost:5432/petpal_db

# Cloud Provider (aws|gcp|azure)
CLOUD_PROVIDER=aws

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=petpal-project
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# IoT Configuration
IOT_ENDPOINT=your-iot-endpoint
MQTT_BROKER_URL=your-mqtt-broker

# Application Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Notification Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### 5. Create Development Scripts

Create `scripts/setup-dev.sh`:

```bash
#!/bin/bash
# Development environment setup script

echo "Setting up PetPal development environment..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    brew install postgresql@15
    brew services start postgresql@15
fi

# Setup database
echo "Setting up database..."
createdb petpal_db 2>/dev/null || echo "Database already exists"
psql -d petpal_db -f database/schema.sql
psql -d petpal_db -f database/sample_data.sql

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend && npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend && npm install

# Copy environment file
echo "Setting up environment variables..."
cd .. && cp .env.example .env

echo "Development setup complete!"
echo "Next steps:"
echo "1. Update .env with your actual credentials"
echo "2. Run 'npm run dev' in the backend directory"
echo "3. Run 'npm start' in the frontend directory"
```

### 6. Docker Setup (Optional)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  database:
    image: postgres:15
    environment:
      POSTGRES_DB: petpal_db
      POSTGRES_USER: petpal_user
      POSTGRES_PASSWORD: petpal_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/1-schema.sql
      - ./database/sample_data.sql:/docker-entrypoint-initdb.d/2-data.sql

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://petpal_user:petpal_password@database:5432/petpal_db
    depends_on:
      - database
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      REACT_APP_API_URL: http://localhost:3001

volumes:
  postgres_data:
```

### 7. Create Git Configuration

Create `.gitignore`:

```gitignore
# Dependencies
node_modules/
*/node_modules/

# Production builds
build/
dist/

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log
npm-debug.log*

# Database backups
*.backup
*.dump

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Hardware build files
*.hex
*.bin
*.elf

# Cloud deployment files
.aws/
.gcp/
service-account-key.json

# Test coverage
coverage/

# Temporary files
tmp/
temp/
```

## Development Workflow

### 1. Daily Development

```bash
# Start development environment
cd ece1528-PetPal

# Terminal 1: Database (if using Docker)
docker-compose up database

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend  
cd frontend && npm start

# Terminal 4: Hardware testing
cd hardware && # compile and upload to Arduino
```

### 2. Testing Workflow

```bash
# Run all tests
npm test                    # Frontend tests
cd backend && npm test      # Backend tests

# Test database connectivity
psql -d petpal_db -c "SELECT * FROM current_feeding_status;"

# Test cloud functions
curl -X POST http://localhost:3001/api/pets/bind \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Cat", "containerID": 1, "weight": 3.1}'
```

### 3. Deployment Workflow

```bash
# Deploy to cloud
npm run deploy:aws          # For AWS deployment
npm run deploy:gcp          # For Google Cloud deployment

# Backup database before deployment
bash scripts/backup-db.sh

# Run integration tests
bash scripts/test-all.sh
```

## Next Development Steps

### Phase 1: Database & Backend (Week 1-2)
1. ✅ Set up PostgreSQL database
2. ✅ Create database schema
3. 📝 Implement basic API endpoints
4. 📝 Set up cloud functions
5. 📝 Test database operations

### Phase 2: Frontend Development (Week 3-4)
1. 📝 Create React app structure
2. 📝 Implement pet binding interface
3. 📝 Create scheduling dashboard
4. 📝 Build feeding logs view
5. 📝 Add real-time status monitoring

### Phase 3: Hardware Integration (Week 5-6)
1. 📝 Implement Arduino communication
2. 📝 Set up weight sensors
3. 📝 Configure motor control
4. 📝 Program LCD display
5. 📝 Test IoT connectivity

### Phase 4: Integration & Testing (Week 7-8)
1. 📝 End-to-end testing
2. 📝 Hardware-software integration
3. 📝 Performance optimization
4. 📝 User acceptance testing
5. 📝 Documentation completion

## Team Collaboration

### Code Review Process
1. Create feature branches: `feature/pet-binding`, `feature/scheduling`
2. Submit pull requests for review
3. Require at least one approval before merging
4. Use conventional commits: `feat:`, `fix:`, `docs:`

### Task Management
- Use GitHub Issues for tracking tasks
- Label issues by component: `backend`, `frontend`, `hardware`
- Assign tasks to team members: @cathy, @yilin, @kevin

### Communication
- Weekly progress meetings
- Daily standups during integration phase
- Use project Slack/Discord for quick questions
- Document decisions in the `meeting/` folder

This structure provides a solid foundation for your PetPal project with clear separation of concerns, proper development workflow, and scalability for future enhancements!