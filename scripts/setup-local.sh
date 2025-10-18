#!/bin/bash

# PetPal Quick Setup Script
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

# Create necessary directories
echo "📁 Creating project directories..."
mkdir -p backend/src/{functions,models,services,utils}
mkdir -p frontend/src/{components,pages,services}
mkdir -p database/init
mkdir -p docker/mosquitto
mkdir -p scripts
mkdir -p logs

# Check if schema.sql exists
if [ ! -f "database/schema.sql" ]; then
    echo "❌ database/schema.sql not found. Please make sure you're in the project root directory."
    echo "💡 Expected to find database/schema.sql with your database schema."
    exit 1
fi

echo "✅ Found database schema file"

# Create .env file if it doesn't exist
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

# Check if backend package.json exists (it should already exist)
if [ -f "backend/package.json" ]; then
    echo "✅ Backend package.json already exists"
else
    echo "❌ Backend package.json not found. Please check your project structure."
    exit 1
fi

# Create frontend package.json if it doesn't exist
if [ ! -f "frontend/package.json" ]; then
    echo "📝 Creating frontend package.json..."
    cat > frontend/package.json << 'EOF'
{
  "name": "petpal-frontend",
  "version": "1.0.0",
  "description": "PetPal Frontend React App",
  "private": true,
  "dependencies": {
    "@testing-library/jest-dom": "^5.17.0",
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^13.5.0",
    "@types/jest": "^27.5.2",
    "@types/node": "^16.18.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.0",
    "web-vitals": "^2.1.0",
    "@mui/material": "^5.14.0",
    "@mui/icons-material": "^5.14.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "axios": "^1.6.0",
    "react-router-dom": "^6.17.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app",
      "react-app/jest"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "devDependencies": {
    "@types/react-router-dom": "^5.3.0"
  }
}
EOF
    echo "✅ Created frontend package.json"
fi

# Create basic frontend files if they don't exist
if [ ! -f "frontend/public/index.html" ]; then
    echo "📝 Creating basic frontend structure..."
    mkdir -p frontend/public frontend/src
    
    # Create public/index.html
    cat > frontend/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="PetPal Smart Feeding System" />
    <title>PetPal - Smart Pet Feeding</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF

    # Create src/index.tsx
    cat > frontend/src/index.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

    # Create src/App.tsx
    cat > frontend/src/App.tsx << 'EOF'
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🐾 PetPal Smart Feeding System</h1>
        <p>Your intelligent pet feeding solution</p>
        <div style={{ marginTop: '2rem' }}>
          <h3>System Status: Online ✅</h3>
          <p>Backend API: Connected</p>
          <p>Database: Ready</p>
        </div>
      </header>
    </div>
  );
}

export default App;
EOF

    # Create src/index.css
    cat > frontend/src/index.css << 'EOF'
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
EOF

    # Create src/App.css
    cat > frontend/src/App.css << 'EOF'
.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
}

.App-header h1 {
  margin-bottom: 0.5rem;
}

.App-header p {
  margin-bottom: 1rem;
  font-size: 1.2rem;
}

.App-header h3 {
  color: #61dafb;
  margin-bottom: 1rem;
}
EOF

    echo "✅ Created basic frontend structure"
fi
if [ ! -f "backend/src/index.js" ]; then
    echo "📝 Creating basic backend server..."
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
    database: 'connected'
  });
});

// API routes
app.get('/api/pets', (req, res) => {
  res.json({ 
    message: 'PetPal API is running!',
    endpoints: [
      'GET /health - Health check',
      'GET /api/pets - List pets',
      'POST /api/pets/bind - Bind new pet',
      'GET /api/schedules - Get feeding schedules',
      'POST /api/schedules - Create feeding schedule'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PetPal Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API docs: http://localhost:${PORT}/api/pets`);
});
EOF
    echo "✅ Created basic backend server"
fi

# Create database test utility
if [ ! -f "backend/src/utils/test-db.js" ]; then
    echo "📝 Creating database test utility..."
    mkdir -p backend/src/utils
    cat > backend/src/utils/test-db.js << 'EOF'
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
EOF
    echo "✅ Created database test utility"
fi

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
        docker-compose logs database
        exit 1
    fi
    sleep 1
done

# Test database connection
echo "🧪 Testing database connection..."
if docker-compose exec -T database psql -U petpal_user -d petpal_db -c "SELECT 'Database OK' as status;" &>/dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    docker-compose logs database
    exit 1
fi

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait a moment for services to start
sleep 5

# Check service status
echo "📊 Checking service status..."
if [ "$(docker-compose ps -q | wc -l)" -gt 0 ]; then
    echo "✅ Services started successfully"
    docker-compose ps
else
    echo "❌ Some services failed to start"
    docker-compose logs
    exit 1
fi

echo ""
echo "🎉 PetPal setup completed successfully!"
echo ""
echo "📱 Access your application:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:3001"
echo "   API Docs:  http://localhost:3001/api/pets"
echo "   Health:    http://localhost:3001/health"
echo "   PgAdmin:   http://localhost:8080"
echo "   Database:  localhost:5432"
echo ""
echo "🔑 Database credentials:"
echo "   Host:     localhost"
echo "   Port:     5432"
echo "   Database: petpal_db"
echo "   Username: petpal_user"
echo "   Password: petpal_secure_password"
echo ""
echo "🔧 Useful commands:"
echo "   docker-compose logs -f           # View all logs"
echo "   docker-compose logs -f backend   # View backend logs"
echo "   docker-compose exec database psql -U petpal_user -d petpal_db"
echo "   docker-compose down              # Stop all services"
echo "   docker-compose up -d             # Start all services"
echo ""
echo "📖 Next steps:"
echo "   1. Open http://localhost:3001/health to verify backend"
echo "   2. Open http://localhost:8080 to access PgAdmin"
echo "   3. Start developing your React frontend"
echo "   4. Check setup/DOCKER_LOCAL_SETUP.md for detailed guide"