# PetPal MQTT Topics 使用指南

## 📡 MQTT Topics 列表

### 1. Motor 1 (电机1)
- **Topic**: `motor1`
- **用途**: 控制第一个喂食电机
- **消息格式**: `start` 或 `stop`
- **示例**:
  ```
  mosquitto_pub -h localhost -p 1883 -t motor1 -m "start"
  mosquitto_pub -h localhost -p 1883 -t motor1 -m "stop"
  ```

### 2. Motor 2 (电机2)
- **Topic**: `motor2`
- **用途**: 控制第二个喂食电机
- **消息格式**: `start` 或 `stop`
- **示例**:
  ```
  mosquitto_pub -h localhost -p 1883 -t motor2 -m "start"
  mosquitto_pub -h localhost -p 1883 -t motor2 -m "stop"
  ```

### 3. Weight Sensor 1 (重量传感器1)
- **Topic**: `weightSensor1`
- **用途**: 发送宠物重量数据
- **消息格式**: 数字（单位：千克）
- **示例**:
  ```
  mosquitto_pub -h localhost -p 1883 -t weightSensor1 -m "3.5"
  mosquitto_pub -h localhost -p 1883 -t weightSensor1 -m "4.2"
  ```
- **前端集成**: Pet Binding 页面会自动读取此传感器数据并填充到重量输入框

### 4. Weight Sensor 2 (重量传感器2)
- **Topic**: `weightSensor2`
- **用途**: 发送容器重量或其他重量数据
- **消息格式**: 数字（单位：千克）
- **示例**:
  ```
  mosquitto_pub -h localhost -p 1883 -t weightSensor2 -m "2.8"
  ```

### 5. LCD Display (LCD显示屏)
- **Topic**: `lcd`
- **用途**: 发送要显示在LCD屏幕上的消息
- **消息格式**: 文本字符串
- **示例**:
  ```
  mosquitto_pub -h localhost -p 1883 -t lcd -m "Hello Pet!"
  mosquitto_pub -h localhost -p 1883 -t lcd -m "Feeding time!"
  ```

---

## 🔧 后端 API 端点

### 1. 获取重量传感器数据
```http
GET /api/mqtt/weight/1
GET /api/mqtt/weight/2
```

**响应示例**:
```json
{
  "success": true,
  "sensor_id": 1,
  "weight": 3.5,
  "timestamp": "2025-10-26T05:30:00.000Z"
}
```

### 2. 控制电机1
```http
POST /api/mqtt/motor1
Content-Type: application/json

{
  "command": "start"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Motor 1 command sent: start",
  "timestamp": "2025-10-26T05:30:00.000Z"
}
```

### 3. 控制电机2
```http
POST /api/mqtt/motor2
Content-Type: application/json

{
  "command": "stop"
}
```

### 4. 发送LCD消息
```http
POST /api/mqtt/lcd
Content-Type: application/json

{
  "message": "Welcome!"
}
```

---

## 🧪 测试步骤

### 测试 Weight Sensor 1 自动填充功能

1. **启动所有服务**:
   ```powershell
   cd D:\1528iot\ece1528-PetPal
   docker compose up -d
   ```

2. **打开前端页面**:
   - 访问 http://localhost:3000
   - 导航到 Pet Binding 页面

3. **点击 "Start Weight Detection" 按钮**

4. **发送模拟重量数据** (在另一个终端):
   ```powershell
   docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.5"
   ```

5. **观察前端**:
   - 重量输入框应该自动填充为 3.5
   - 显示 "✅ Weight detected: 3.5kg"

### 使用 MQTT Web Console 测试

1. **访问 MQTT Console**: 点击前端右上角的 "MQTT Console" 按钮

2. **连接到 MQTT Broker**:
   - URL: `ws://localhost:9001`
   - 点击 "Connect"

3. **订阅所有 topics**:
   - Topic: `#` (通配符，订阅所有)
   - 点击 "Subscribe"

4. **发布测试消息**:
   - Motor 1: Topic `motor1`, Payload `start`
   - LCD: Topic `lcd`, Payload `"Hello Pet!"`
   - Weight: Topic `weightSensor1`, Payload `4.2`

### 使用 Postman 或 curl 测试 API

```bash
# 获取 Weight Sensor 1 数据
curl http://localhost:3001/api/mqtt/weight/1

# 控制 Motor 1
curl -X POST http://localhost:3001/api/mqtt/motor1 \
  -H "Content-Type: application/json" \
  -d '{"command":"start"}'

# 发送 LCD 消息
curl -X POST http://localhost:3001/api/mqtt/lcd \
  -H "Content-Type: application/json" \
  -d '{"message":"Feeding complete!"}'
```

---

## 📝 代码修改摘要

### 后端修改

1. **`backend/src/services/mqtt.js`**:
   - 添加了 TOPICS 常量定义
   - 订阅 weightSensor1 和 weightSensor2
   - 存储最新的重量传感器读数
   - 添加 `publishMotor1()`, `publishMotor2()`, `publishLCD()` 函数
   - 添加 `getLatestWeight()` 函数获取最新重量

2. **`backend/src/routes/api.js`**:
   - 添加 `GET /api/mqtt/weight/:sensorId` - 获取重量传感器数据
   - 添加 `POST /api/mqtt/motor1` - 控制电机1
   - 添加 `POST /api/mqtt/motor2` - 控制电机2
   - 添加 `POST /api/mqtt/lcd` - 发送LCD消息

### 前端修改

1. **`frontend/src/services/apiService.ts`**:
   - 添加 `getWeightSensor(sensorId)` 方法
   - 添加 `controlMotor1(command)` 方法
   - 添加 `controlMotor2(command)` 方法
   - 添加 `sendLCDMessage(message)` 方法

2. **`frontend/src/pages/PetBinding.tsx`**:
   - 修改 `startWeightDetection()` 函数，使用真实的 API 轮询
   - 每 500ms 轮询一次 weightSensor1
   - 检测到重量后自动填充到表单
   - 30秒超时保护

---

## 🚀 快速启动命令

```powershell
# 启动所有服务
docker compose up -d

# 查看后端日志（观察 MQTT 消息）
docker compose logs -f backend

# 查看 MQTT broker 日志
docker compose logs -f mqtt

# 发送测试重量数据
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.5"

# 控制电机
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t motor1 -m "start"

# 发送LCD消息
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t lcd -m "Welcome!"
```

---

## 🔍 调试提示

1. **查看 MQTT 消息流**:
   ```powershell
   docker exec -it petpal-mqtt mosquitto_sub -h localhost -t "#" -v
   ```

2. **检查后端是否接收到 MQTT 消息**:
   ```powershell
   docker compose logs -f backend | findstr mqtt
   ```

3. **测试 API 端点**:
   ```powershell
   # PowerShell
   Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Get
   ```

---

最后更新: 2025-10-26
