# PetPal Quick Setup Script for Windows PowerShell
# This script sets up the complete local development environment

$ErrorActionPreference = "Stop"

Write-Host "🐾 PetPal Local Development Setup" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

# Check if Docker is installed
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    Write-Host "   Download from: https://docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is installed and running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if we're in the right directory
if (!(Test-Path "database\schema.sql")) {
    Write-Host "❌ database/schema.sql not found. Please make sure you're in the project root directory." -ForegroundColor Red
    Write-Host "💡 Expected to find database/schema.sql with your database schema." -ForegroundColor Yellow
    Write-Host "📁 Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "📋 Available files:" -ForegroundColor Yellow
    Get-ChildItem
    exit 1
}

Write-Host "✅ Found database schema file" -ForegroundColor Green

# Check required files exist
if (!(Test-Path "backend\package.json")) {
    Write-Host "❌ backend/package.json not found. Please check your project structure." -ForegroundColor Red
    exit 1
}

if (!(Test-Path "frontend\package.json")) {
    Write-Host "❌ frontend/package.json not found. Please check your project structure." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Backend and frontend package.json files found" -ForegroundColor Green

# Check/Create .env file
if (!(Test-Path ".env")) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    @"
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
"@ | Set-Content -Path ".env" -Encoding UTF8
    Write-Host "✅ Created .env file" -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Stop existing containers
Write-Host "🧹 Stopping existing containers..." -ForegroundColor Yellow
docker compose down

# Start database
Write-Host "🗄️  Starting PostgreSQL database..." -ForegroundColor Yellow
docker compose up database -d

# Wait for database
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
$attempts = 30
while ($attempts -gt 0) {
    if (docker compose exec -T database pg_isready -U petpal_user -d petpal_db 2>$null) {
        Write-Host "✅ Database is ready!" -ForegroundColor Green
        break
    }
    $attempts--
    if ($attempts -eq 0) {
        Write-Host "❌ Database failed to start after 30 seconds" -ForegroundColor Red
        Write-Host "📋 Database logs:" -ForegroundColor Yellow
        docker compose logs database
        exit 1
    }
    Start-Sleep -Seconds 1
}

# Test database connection
Write-Host "🧪 Testing database connection..." -ForegroundColor Yellow
try {
    docker compose exec -T database psql -U petpal_user -d petpal_db -c "SELECT 'Database OK' as status;" | Out-Null
    Write-Host "✅ Database connection successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Database connection failed" -ForegroundColor Red
    docker compose logs database
    exit 1
}

# Build and start services
Write-Host "🚀 Building and starting all services..." -ForegroundColor Yellow
docker compose up --build -d

# Wait for services to start
Start-Sleep -Seconds 10

# Check service status
Write-Host "📊 Checking service status..." -ForegroundColor Yellow
docker compose ps

# Test backend health
Write-Host "🏥 Testing backend health..." -ForegroundColor Yellow
$attempts = 10
while ($attempts -gt 0) {
    try {
        Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing | Out-Null
        Write-Host "✅ Backend is healthy!" -ForegroundColor Green
        break
    } catch {
        $attempts--
        if ($attempts -eq 0) {
            Write-Host "⚠️  Backend not responding yet, but containers are running" -ForegroundColor Yellow
            Write-Host "📋 Backend logs:" -ForegroundColor Yellow
            docker compose logs --tail=20 backend
        }
        Start-Sleep -Seconds 2
    }
}

# Final instructions
Write-Host "`n🎉 PetPal setup completed!`n" -ForegroundColor Green
Write-Host "📱 Access your application:" -ForegroundColor Cyan
Write-Host "   🌐 Frontend:  http://localhost:3000"
Write-Host "   🔧 Backend:   http://localhost:3001"
Write-Host "   📖 API Docs:  http://localhost:3001/api/pets"
Write-Host "   🏥 Health:    http://localhost:3001/health"
Write-Host "   🗄️  Database:  localhost:5432`n"

Write-Host "🛠️  Development commands:" -ForegroundColor Cyan
Write-Host "   📊 View logs:        docker compose logs -f"
Write-Host "   🔄 Restart services: docker compose restart"
Write-Host "   🛑 Stop services:    docker compose down"
Write-Host "   🧹 Clean data:       docker compose down -v`n"

Write-Host "Happy coding! 🚀" -ForegroundColor Green