const { dbService } = require('./database');
const { mqttService } = require('./mqttService');

class FeedingScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 60000; // Check every minute (60 seconds)
  }

  start() {
    if (this.isRunning) {
      console.log('Feeding scheduler is already running');
      return;
    }

    console.log('Starting feeding scheduler - checking every minute for scheduled feedings');
    this.isRunning = true;
    
    // Run immediately on start
    this.checkScheduledFeedings();
    
    // Calculate time until next minute (:00 seconds)
    const now = new Date();
    const secondsUntilNextMinute = 60 - now.getSeconds();
    const msUntilNextMinute = secondsUntilNextMinute * 1000 - now.getMilliseconds();
    
    console.log(`Syncing scheduler to next minute (:00 seconds) in ${secondsUntilNextMinute} seconds`);
    
    // Wait until the next :00 second, then start checking every minute
    setTimeout(() => {
      // First aligned check at :00
      this.checkScheduledFeedings();
      
      // Then check every minute at :00
      this.intervalId = setInterval(() => {
        this.checkScheduledFeedings();
      }, this.checkInterval);
      
      console.log('Scheduler synced - now checking every minute at :00 seconds');
    }, msUntilNextMinute);
  }

  stop() {
    if (!this.isRunning) {
      console.log('Feeding scheduler is not running');
      return;
    }

    console.log('Stopping feeding scheduler');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkScheduledFeedings() {
    try {
      const currentTime = new Date().toTimeString().slice(0, 8); // HH:MM:SS format
      console.log(`Checking for scheduled feedings at ${currentTime}`);
      
      const currentSchedules = await dbService.getCurrentSchedules();
      
      if (currentSchedules.length === 0) {
        console.log('No scheduled feedings found for current time');
        return;
      }

      console.log(`🍽️ Found ${currentSchedules.length} scheduled feeding(s) to trigger`);

      for (const schedule of currentSchedules) {
        await this.triggerFeedingForSchedule(schedule);
      }
    } catch (error) {
      console.error('Error checking scheduled feedings:', error);
    }
  }

  async triggerFeedingForSchedule(schedule) {
    try {
      console.log(`Triggering feeding for ${schedule.animal_name} (Container ${schedule.container_id})`);
      
      // Get current animal data
      const animal = await dbService.getAnimalByContainerId(schedule.container_id);
      if (!animal) {
        console.error(`Animal not found for container ${schedule.container_id}`);
        return;
      }

      // Check if enough food available
      if (animal.food_level < schedule.food_amount) {
        console.warn(`Insufficient food for ${schedule.animal_name}. Available: ${animal.food_level}kg, Needed: ${schedule.food_amount}kg`);
        
        // Still log the attempt but with 0 dispensed
        await dbService.createLogEntry({
          animal_id: schedule.animal_id,
          container_id: schedule.container_id,
          food_portion: 0,
          remaining_food_level: animal.food_level,
          feeding_type: 'scheduled'
        });
        return;
      }

      // Calculate new food level
      const newFoodLevel = Math.max(0, animal.food_level - schedule.food_amount);

      // Create log entry
      const logEntry = await dbService.createLogEntry({
        animal_id: schedule.animal_id,
        container_id: schedule.container_id,
        food_portion: schedule.food_amount,
        remaining_food_level: newFoodLevel,
        feeding_type: 'scheduled'
      });

      // Update food level
      await dbService.updateFoodLevel(schedule.container_id, newFoodLevel);

      // SEND MQTT MESSAGE TO HARDWARE MOTOR
      try {
        // Publish motor trigger message
        await mqttService.publishMotorTrigger({
          container_id: schedule.container_id,
          food_amount: schedule.food_amount,
          animal_name: schedule.animal_name,
          feeding_type: 'scheduled'
        });

        // Publish LCD message
        await mqttService.publishLCDMessage(
          `Feeding ${schedule.animal_name} - ${schedule.food_amount}kg`
        );

        console.log(`Feeding triggered for ${schedule.animal_name}: ${schedule.food_amount}kg dispensed`);
        console.log(`MQTT messages published to motor${schedule.container_id} topic`);

      } catch (mqttError) {
        console.error('Failed to publish MQTT message:', mqttError.message);
        console.log('Feeding logged in database but hardware not triggered');
      }

    } catch (error) {
      console.error(`Error triggering feeding for schedule ${schedule.id}:`, error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      nextCheck: this.isRunning ? new Date(Date.now() + this.checkInterval).toISOString() : null
    };
  }

  // Method to manually trigger a check (useful for testing)
  async manualCheck() {
    console.log('Manual feeding check triggered');
    await this.checkScheduledFeedings();
  }
}

// Create singleton instance
const feedingScheduler = new FeedingScheduler();

module.exports = { feedingScheduler };