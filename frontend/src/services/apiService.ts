const API_BASE_URL = 'http://localhost:3001';

// API service for PetPal backend communication
class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  // Generic HTTP request method
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // ##### 1. Pet Binding APIs #####
  
  async bindPet(petData: {
    name: string;
    animal_type: string;
    weight: number;
    food_portion: number;
    food_level: number;
    container_id: number;
  }) {
    return this.request('/api/pets/bind', {
      method: 'POST',
      body: JSON.stringify(petData),
    });
  }

  async getAllPets() {
    return this.request('/api/pets');
  }

  async findPetByWeight(weight: number) {
    return this.request(`/api/pets/weight/${weight}`);
  }

  // ##### 2. Schedule Setting APIs #####
  
  async createSchedule(scheduleData: {
    animal_id: number;
    container_id: number;
    schedule_time: string;
    food_amount: number;
  }) {
    return this.request('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  }

  async getAllSchedules(container_id?: number) {
    const queryParam = container_id ? `?container_id=${container_id}` : '';
    return this.request(`/api/schedules${queryParam}`);
  }

  // ##### 3. Feeding Trigger APIs #####
  
  async checkScheduledFeedings() {
    return this.request('/api/feeding/check');
  }

  async triggerManualFeeding(feedingData: {
    container_id: number;
    food_amount: number;
  }) {
    return this.request('/api/feeding/manual', {
      method: 'POST',
      body: JSON.stringify(feedingData),
    });
  }

  // ##### 4. Logs APIs #####
  
  async getFeedingLogs(container_id?: number, limit?: number) {
    const params = new URLSearchParams();
    if (container_id) params.append('container_id', container_id.toString());
    if (limit) params.append('limit', limit.toString());
    
    const queryString = params.toString();
    return this.request(`/api/logs${queryString ? `?${queryString}` : ''}`);
  }

  async getFeedingStats() {
    return this.request('/api/logs/stats');
  }

  // ##### 5. System APIs #####
  
  async getHealthStatus() {
    return this.request('/health');
  }

  async getSchedulerStatus() {
    return this.request('/api/scheduler/status');
  }

  async triggerSchedulerCheck() {
    return this.request('/api/scheduler/trigger', {
      method: 'POST',
    });
  }

  // ##### 6. MQTT Hardware Control APIs #####
  
  async getWeightSensor(sensorId: number) {
    return this.request(`/api/mqtt/weight/${sensorId}`);
  }

  async clearWeightSensor(sensorId: number) {
    return this.request(`/api/mqtt/weight/${sensorId}`, {
      method: 'DELETE',
    });
  }

  async controlMotor1(command: 'start' | 'stop') {
    return this.request('/api/mqtt/motor1', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  }

  async controlMotor2(command: 'start' | 'stop') {
    return this.request('/api/mqtt/motor2', {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  }

  async sendLCDMessage(message: string) {
    return this.request('/api/mqtt/lcd', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async controlWeightSensor(sensorId: number, enable: boolean) {
    return this.request('/api/mqtt/weight-sensor-control', {
      method: 'POST',
      body: JSON.stringify({ sensorId, enable }),
    });
  }

  async sendWeightEnable(enable: boolean) {
    return this.request('/api/mqtt/weight-enable', {
      method: 'POST',
      body: JSON.stringify({ enable }),
    });
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Type definitions for API responses
export interface Animal {
  id: number;
  name: string;
  animal_type: string;
  weight: number;
  food_portion: number;
  food_level: number;
  container_id: number;
  created_at: string;
  updated_at: string;
}

export interface FeedingSchedule {
  id: number;
  animal_id: number;
  container_id: number;
  schedule_time: string;
  food_amount: number;
  is_active: boolean;
  created_at: string;
  animal_name?: string;
  animal_type?: string;
}

export interface LogEntry {
  id: number;
  animal_id: number | null;
  container_id: number;
  dispense_time: string;
  food_portion: number;
  remaining_food_level: number;
  feeding_type: 'scheduled' | 'manual';
  animal_name?: string;
  animal_type?: string;
  dispense_time_formatted?: string;
  food_portion_formatted?: string;
  remaining_food_level_formatted?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface HardwareSignal {
  LCD: { message: string };
  motor: {
    id: number;
    enable: boolean;
    amount: number;
    status: string;
  };
  weight: { enable: boolean };
}