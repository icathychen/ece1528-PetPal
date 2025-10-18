# PetPal Cloud Infrastructure Setup Guide

## Overview
This guide covers setting up cloud infrastructure for your PetPal smart feeding system, including cloud functions, API endpoints, and communication with hardware.

## Cloud Architecture Options

### Option 1: AWS Complete Setup

#### 1. AWS Lambda Functions (for backend logic)

**Step 1: Create Lambda Functions**

```bash
# Install AWS CLI
brew install awscli

# Configure AWS credentials
aws configure
```

**Create the following Lambda functions:**

1. **Pet Binding Function**
```javascript
// petBinding.js
exports.handler = async (event) => {
    const { name, containerID, weight } = JSON.parse(event.body);
    
    // Database connection code here
    // Insert into animals table
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Pet bound successfully',
            petId: newPetId
        })
    };
};
```

2. **Schedule Feeding Function**
```javascript
// scheduleFeed.js
exports.handler = async (event) => {
    const { containerID, scheduleTime, amount } = JSON.parse(event.body);
    
    // Insert into feeding_schedules table
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Schedule set successfully'
        })
    };
};
```

3. **Check and Trigger Feeding Function**
```javascript
// checkAndTriggerFeeding.js
exports.handler = async (event) => {
    const currentTime = new Date().toTimeString().slice(0,5);
    
    // Query database for scheduled feedings
    // Send message to IoT device
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Feeding check completed'
        })
    };
};
```

#### 2. AWS IoT Core (for hardware communication)

**Step 1: Set up IoT Core**

1. Go to AWS Console → IoT Core
2. Create a new Thing: `petpal-feeder-1`
3. Download certificates and keys
4. Create IoT Policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect",
        "iot:Publish",
        "iot:Subscribe",
        "iot:Receive"
      ],
      "Resource": [
        "arn:aws:iot:us-east-1:ACCOUNT-ID:client/petpal-feeder-*",
        "arn:aws:iot:us-east-1:ACCOUNT-ID:topic/petpal/*"
      ]
    }
  ]
}
```

**Step 2: MQTT Topics Structure**
```
petpal/feeder/1/command    # Send commands to hardware
petpal/feeder/1/status     # Receive status from hardware
petpal/feeder/1/weight     # Receive weight data
petpal/feeder/1/logs       # Receive feeding logs
```

#### 3. AWS EventBridge (for scheduled triggers)

**Step 1: Create Scheduled Event**

1. Go to EventBridge → Rules
2. Create rule: `petpal-feeding-check`
3. Schedule expression: `rate(1 minute)`
4. Target: Lambda function `checkAndTriggerFeeding`

#### 4. AWS API Gateway

**Step 1: Create REST API**

1. Go to API Gateway → Create API
2. Create the following endpoints:

```
POST /api/pets/bind          # Pet binding
POST /api/schedules          # Set feeding schedule
POST /api/feeding/trigger    # Manual trigger
GET  /api/logs              # View logs
GET  /api/pets              # Get pet info
```

### Option 2: Google Cloud Platform Setup

#### 1. Google Cloud Functions

**Step 1: Enable APIs**
```bash
# Install Google Cloud CLI
brew install google-cloud-sdk

# Initialize gcloud
gcloud init

# Enable required APIs
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable iot.googleapis.com
```

**Step 2: Deploy Cloud Functions**

Create `package.json`:
```json
{
  "name": "petpal-functions",
  "version": "1.0.0",
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "pg": "^8.11.0"
  }
}
```

Create functions:
```javascript
// index.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

exports.petBinding = async (req, res) => {
  const { name, containerID, weight } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO animals (name, animal_type, weight, food_portion, food_level, container_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, 'Cat', weight, 0.2, 2.5, containerID]
    );
    
    res.json({ success: true, petId: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setSchedule = async (req, res) => {
  const { containerID, scheduleTime, amount } = req.body;
  
  try {
    await pool.query(
      'INSERT INTO feeding_schedules (container_id, schedule_time, food_amount) VALUES ($1, $2, $3)',
      [containerID, scheduleTime, amount]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

Deploy functions:
```bash
gcloud functions deploy petBinding \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=your_connection_string

gcloud functions deploy setSchedule \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=your_connection_string
```

#### 2. Google Cloud IoT Core (Deprecated - use Pub/Sub instead)

**Alternative: Use Google Cloud Pub/Sub**

```bash
# Create topics
gcloud pubsub topics create petpal-commands
gcloud pubsub topics create petpal-status
gcloud pubsub topics create petpal-weight-data

# Create subscriptions
gcloud pubsub subscriptions create petpal-commands-sub --topic=petpal-commands
gcloud pubsub subscriptions create petpal-status-sub --topic=petpal-status
```

## Hardware Communication Protocol

### Message Structure

**Command to Hardware:**
```json
{
  "timestamp": "2024-10-18T10:30:00Z",
  "command": "feed",
  "LCD": {
    "message": "Feeding time!",
    "display_duration": 5000
  },
  "motor": {
    "id": 1,
    "enable": true,
    "amount": 0.2,
    "speed": 100
  },
  "weight": {
    "enable": true,
    "sensor_id": 2
  }
}
```

**Status from Hardware:**
```json
{
  "timestamp": "2024-10-18T10:30:15Z",
  "container_id": 1,
  "status": "feeding_complete",
  "food_dispensed": 0.2,
  "remaining_food": 2.3,
  "pet_weight": 3.1,
  "sensor_readings": {
    "food_weight": 2.3,
    "pet_detected": true
  }
}
```

## Cloud Function Implementation Examples

### 1. Scheduled Feeding Check (runs every minute)

```javascript
// scheduledFeedingCheck.js
const { Pool } = require('pg');
const { PubSub } = require('@google-cloud/pubsub');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const pubsub = new PubSub();

exports.checkScheduledFeeding = async (req, res) => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  try {
    // Get scheduled feedings for current time
    const schedules = await pool.query(`
      SELECT fs.*, a.name as pet_name, a.container_id
      FROM feeding_schedules fs
      JOIN animals a ON fs.animal_id = a.id
      WHERE fs.schedule_time = $1 AND fs.is_active = true
    `, [currentTime]);
    
    for (const schedule of schedules.rows) {
      // Send feeding command to hardware
      const command = {
        timestamp: now.toISOString(),
        command: "feed",
        container_id: schedule.container_id,
        LCD: {
          message: `Feeding ${schedule.pet_name}`,
          display_duration: 5000
        },
        motor: {
          id: 1,
          enable: true,
          amount: schedule.food_amount,
          speed: 100
        },
        weight: {
          enable: true,
          sensor_id: 2
        }
      };
      
      // Publish to Pub/Sub (or send via IoT)
      await pubsub.topic('petpal-commands').publish(Buffer.from(JSON.stringify(command)));
      
      console.log(`Feeding command sent for ${schedule.pet_name}`);
    }
    
    res.json({ 
      success: true, 
      feedings_triggered: schedules.rows.length 
    });
    
  } catch (error) {
    console.error('Error checking scheduled feedings:', error);
    res.status(500).json({ error: error.message });
  }
};
```

### 2. Process Hardware Status Updates

```javascript
// processHardwareStatus.js
exports.processStatus = async (req, res) => {
  const statusData = req.body;
  
  try {
    if (statusData.status === 'feeding_complete') {
      // Log the feeding event
      await pool.query(`
        INSERT INTO log_entries (animal_id, food_portion, remaining_food_level, container_id, feeding_type)
        VALUES (
          (SELECT id FROM animals WHERE container_id = $1 LIMIT 1),
          $2, $3, $1, 'scheduled'
        )
      `, [statusData.container_id, statusData.food_dispensed, statusData.remaining_food]);
      
      // Update food level in animals table
      await pool.query(`
        UPDATE animals 
        SET food_level = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE container_id = $2
      `, [statusData.remaining_food, statusData.container_id]);
      
      // Check if food is low (< 1kg)
      if (statusData.remaining_food < 1.0) {
        // Send notification (implement your notification service)
        console.log(`Low food alert for container ${statusData.container_id}`);
      }
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error processing status:', error);
    res.status(500).json({ error: error.message });
  }
};
```

## Deployment Scripts

### AWS Deployment Script

```bash
#!/bin/bash
# deploy-aws.sh

echo "Deploying PetPal to AWS..."

# Package Lambda functions
zip -r petpal-functions.zip *.js node_modules/

# Deploy Lambda functions
aws lambda create-function \
  --function-name petpal-pet-binding \
  --runtime nodejs18.x \
  --handler index.petBinding \
  --zip-file fileb://petpal-functions.zip \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role

aws lambda create-function \
  --function-name petpal-schedule-feeding \
  --runtime nodejs18.x \
  --handler index.setSchedule \
  --zip-file fileb://petpal-functions.zip \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role

# Create EventBridge rule for scheduled checks
aws events put-rule \
  --name petpal-feeding-check \
  --schedule-expression "rate(1 minute)"

echo "AWS deployment complete!"
```

### Google Cloud Deployment Script

```bash
#!/bin/bash
# deploy-gcp.sh

echo "Deploying PetPal to Google Cloud..."

# Deploy Cloud Functions
gcloud functions deploy petBinding \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=$DATABASE_URL

gcloud functions deploy setSchedule \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=$DATABASE_URL

gcloud functions deploy checkScheduledFeeding \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=$DATABASE_URL

# Set up Cloud Scheduler for periodic feeding checks
gcloud scheduler jobs create http petpal-feeding-check \
  --schedule="* * * * *" \
  --uri=https://us-central1-PROJECT_ID.cloudfunctions.net/checkScheduledFeeding \
  --http-method=POST

echo "Google Cloud deployment complete!"
```

## Testing Your Cloud Setup

### 1. Test Database Connection

```bash
# Test with curl
curl -X POST https://your-cloud-function-url/petBinding \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Cat", "containerID": 1, "weight": 3.1}'
```

### 2. Test Scheduled Feeding

```bash
# Manually trigger the scheduled feeding check
curl -X POST https://your-cloud-function-url/checkScheduledFeeding
```

### 3. Monitor Logs

**AWS:**
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/petpal"
```

**Google Cloud:**
```bash
gcloud logging read "resource.type=cloud_function" --limit 50
```

## Next Steps

1. ✅ Choose your cloud provider (AWS or Google Cloud)
2. ✅ Set up cloud functions for backend logic
3. ✅ Configure IoT communication for hardware
4. ✅ Set up scheduled triggers for automatic feeding
5. 📝 Implement hardware-side communication
6. 📝 Create React frontend with API integration
7. 📝 Test end-to-end system integration

## Cost Considerations

### AWS Free Tier:
- Lambda: 1M requests/month
- RDS: 750 hours/month (db.t3.micro)
- IoT Core: 2.25M messages/month

### Google Cloud Free Tier:
- Cloud Functions: 2M invocations/month
- Cloud SQL: Free tier instance
- Pub/Sub: 10GB/month

Both should be sufficient for development and testing!