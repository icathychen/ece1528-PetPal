# PetPal Database Setup Guide

## Overview
This guide will help you set up PostgreSQL database for the PetPal smart feeding system, both locally and in the cloud.

## Option 1: Local PostgreSQL Setup

### Step 1: Install PostgreSQL on macOS

```bash
# Using Homebrew (recommended)
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Or install using the official installer from postgresql.org
```

### Step 2: Create Database and User

```bash
# Connect to PostgreSQL as superuser
psql postgres

# Create database
CREATE DATABASE petpal_db;

# Create user for the application
CREATE USER petpal_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE petpal_db TO petpal_user;

# Connect to the new database
\c petpal_db;

# Grant schema privileges
GRANT ALL ON SCHEMA public TO petpal_user;

# Exit psql
\q
```

### Step 3: Test Connection

```bash
# Test connection with new user
psql -h localhost -U petpal_user -d petpal_db

# If successful, you should see the petpal_db prompt
```

## Option 2: Cloud Database Setup

### AWS RDS PostgreSQL

#### Step 1: Create AWS Account
1. Go to [AWS Console](https://aws.amazon.com/console/)
2. Sign up for an account (free tier available)
3. Verify your account

#### Step 2: Create RDS Instance

1. **Navigate to RDS**:
   - Go to AWS Console → Services → RDS

2. **Create Database**:
   - Click "Create database"
   - Choose "Standard create"
   - Engine: PostgreSQL
   - Version: PostgreSQL 15.x (latest stable)

3. **Instance Configuration**:
   - Templates: Free tier (for development)
   - DB instance identifier: `petpal-database`
   - Master username: `petpal_admin`
   - Master password: `create_secure_password`

4. **Instance Specifications**:
   - DB instance class: db.t3.micro (free tier)
   - Storage: 20 GB (free tier)
   - Storage autoscaling: Enable

5. **Connectivity**:
   - VPC: Default VPC
   - Public access: Yes (for development)
   - VPC security group: Create new
   - Database port: 5432

6. **Additional Configuration**:
   - Initial database name: `petpal_db`
   - Enable automated backups
   - Backup retention: 7 days

#### Step 3: Configure Security Group

1. Go to EC2 → Security Groups
2. Find the RDS security group created
3. Add inbound rule:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Your IP address (for development)

#### Step 4: Get Connection Details

After creation (takes 10-15 minutes):
1. Go to RDS → Databases
2. Click your instance
3. Note the endpoint URL
4. Connection string format:
   ```
   postgresql://petpal_admin:your_password@your-endpoint.region.rds.amazonaws.com:5432/petpal_db
   ```

### Google Cloud SQL PostgreSQL

#### Step 1: Setup Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "petpal-project"
3. Enable Cloud SQL Admin API

#### Step 2: Create Cloud SQL Instance

1. **Navigate to Cloud SQL**:
   - Go to Console → SQL

2. **Create Instance**:
   - Choose PostgreSQL
   - Instance ID: `petpal-postgres`
   - Password: Set secure password
   - Region: Choose closest to you
   - Zone: Any

3. **Configuration**:
   - Machine type: Shared core (1 vCPU, 0.6 GB RAM) for development
   - Storage: SSD, 10 GB
   - Enable automated backups

#### Step 3: Configure Access

1. **Add Authorized Networks**:
   - Go to your instance → Connections
   - Add your IP address under "Authorized networks"

2. **Create Database**:
   - Go to Databases tab
   - Create database: `petpal_db`

3. **Create User**:
   - Go to Users tab
   - Add user: `petpal_user`
   - Set password

#### Step 4: Connection Details

```
Host: Your instance's public IP
Port: 5432
Database: petpal_db
Username: petpal_user
Password: your_password
```

## Database Schema Setup

Once you have your database running, create the tables:

```sql
-- Connect to your database and run these commands

-- Create Animals table
CREATE TABLE animals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    animal_type VARCHAR(50) NOT NULL, -- This maps to container ID
    weight DECIMAL(5,2) NOT NULL,
    food_portion DECIMAL(5,2) NOT NULL,
    food_level DECIMAL(5,2) NOT NULL,
    container_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create feeding schedules table
CREATE TABLE feeding_schedules (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id),
    container_id INTEGER NOT NULL,
    schedule_time TIME NOT NULL,
    food_amount DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create log entries table
CREATE TABLE log_entries (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id),
    dispense_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    food_portion DECIMAL(5,2) NOT NULL,
    remaining_food_level DECIMAL(5,2) NOT NULL,
    feeding_type VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled' or 'manual'
    container_id INTEGER NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_animals_container_id ON animals(container_id);
CREATE INDEX idx_log_entries_animal_id ON log_entries(animal_id);
CREATE INDEX idx_log_entries_dispense_time ON log_entries(dispense_time);
CREATE INDEX idx_feeding_schedules_animal_id ON feeding_schedules(animal_id);
CREATE INDEX idx_feeding_schedules_time ON feeding_schedules(schedule_time);

-- Insert sample data for testing
INSERT INTO animals (name, animal_type, weight, food_portion, food_level, container_id) 
VALUES ('Whiskers', 'Cat', 3.1, 0.2, 2.5, 1);

INSERT INTO feeding_schedules (animal_id, container_id, schedule_time, food_amount)
VALUES (1, 1, '08:00:00', 0.2), (1, 1, '18:00:00', 0.2);
```

## Environment Configuration

Create a `.env` file in your project root:

```env
# Database Configuration
DB_HOST=localhost  # or your cloud database host
DB_PORT=5432
DB_NAME=petpal_db
DB_USER=petpal_user
DB_PASSWORD=your_secure_password

# For cloud databases, use the full connection string:
# DATABASE_URL=postgresql://user:password@host:port/database

# Cloud Configuration (if using cloud functions)
CLOUD_PROVIDER=aws  # or 'gcp' or 'azure'

# AWS (if using)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Google Cloud (if using)
GOOGLE_CLOUD_PROJECT_ID=petpal-project
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

## Next Steps

1. ✅ Choose your database option (local or cloud)
2. ✅ Follow the setup steps above
3. ✅ Create the database schema
4. ✅ Test connection with sample data
5. 📝 Set up your backend API to connect to the database
6. 📝 Implement the cloud functions for scheduled feeding
7. 📝 Create the React frontend

## Testing Your Setup

```bash
# Test local connection
psql -h localhost -U petpal_user -d petpal_db -c "SELECT * FROM animals;"

# Test cloud connection (replace with your details)
psql -h your-cloud-host -U petpal_user -d petpal_db -c "SELECT * FROM animals;"
```

## Troubleshooting

### Common Issues:

1. **Connection refused**: Check if PostgreSQL is running
2. **Authentication failed**: Verify username/password
3. **Database doesn't exist**: Make sure you created the database
4. **Permission denied**: Check user privileges

### Useful Commands:

```bash
# Check PostgreSQL status (local)
brew services list | grep postgresql

# Restart PostgreSQL (local)
brew services restart postgresql@15

# View PostgreSQL logs (local)
tail -f /usr/local/var/log/postgresql@15.log
```