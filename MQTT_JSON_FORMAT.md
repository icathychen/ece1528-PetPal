# MQTT JSON 格式消息使用指南

## 📡 新增功能：统一硬件控制消息

PetPal 系统现在支持通过单一 MQTT topic 发送 JSON 格式的综合控制消息，包含 LCD、Motor 和 Weight Sensor 的控制信息。

---

## 🎯 Topic

**Topic**: `hardwareControl`

**消息格式**: JSON

---

## 📋 消息结构

```json
{
  "LCD": {
    "message": "string"
  },
  "motor": {
    "id": 1 或 2,
    "enable": true 或 false,
    "amount": 数字 (克),
    "status": "string" (可选)
  },
  "weight": {
    "enable": true 或 false
  },
  "timestamp": "ISO 8601 时间戳"
}
```

### 字段说明

#### LCD 对象
- `message` (string): 要在 LCD 显示屏上显示的消息

#### motor 对象
- `id` (number): 电机 ID，1 或 2
- `enable` (boolean): 是否启用电机
- `amount` (number): 喂食量（克）
- `status` (string, 可选): 电机状态，如 "ready", "dispensing", "standby", "error"

#### weight 对象
- `enable` (boolean): 是否启用重量传感器

#### timestamp
- 自动生成的 ISO 8601 格式时间戳

---

## 🔧 REST API 端点

### POST `/api/mqtt/hardware-control`

发送统一的硬件控制消息。

**请求体**:
```json
{
  "LCD": {
    "message": "Pet Binding"
  },
  "motor": {
    "id": 1,
    "enable": true,
    "amount": 100,
    "status": "ready"
  },
  "weight": {
    "enable": true
  }
}
```

**响应**:
```json
{
  "success": true,
  "message": "Hardware control message sent",
  "data": {
    "LCD": { "message": "Pet Binding" },
    "motor": { "id": 1, "enable": true, "amount": 100, "status": "ready" },
    "weight": { "enable": true },
    "timestamp": "2025-11-10T12:30:45.123Z"
  }
}
```

---

## 📝 使用场景

### 1. Pet Binding 开始

**场景**: 用户点击 "Start Weight Detection" 开始宠物绑定

**消息**:
```json
{
  "LCD": {
    "message": "Pet Binding"
  },
  "motor": {
    "id": 1,
    "enable": false,
    "amount": 0,
    "status": "standby"
  },
  "weight": {
    "enable": true
  }
}
```

**说明**:
- LCD 显示 "Pet Binding" 提示用户
- 电机处于待机状态
- 启用重量传感器开始检测

---

### 2. Pet Binding 完成

**场景**: 用户点击 "Stop Detection" 停止检测

**消息**:
```json
{
  "LCD": {
    "message": "Binding Complete"
  },
  "motor": {
    "id": 1,
    "enable": false,
    "amount": 0,
    "status": "standby"
  },
  "weight": {
    "enable": false
  }
}
```

**说明**:
- LCD 显示 "Binding Complete" 确认完成
- 电机保持待机状态
- 禁用重量传感器停止检测

---

### 3. Pet Binding 取消

**场景**: 用户点击 "Cancel" 取消绑定

**消息**:
```json
{
  "LCD": {
    "message": "Binding Cancelled"
  },
  "motor": {
    "id": 1,
    "enable": false,
    "amount": 0,
    "status": "standby"
  },
  "weight": {
    "enable": false
  }
}
```

**说明**:
- LCD 显示 "Binding Cancelled" 提示用户
- 电机保持待机状态
- 禁用重量传感器

---

### 4. Pet Binding 超时

**场景**: 60 秒检测超时自动停止

**消息**:
```json
{
  "LCD": {
    "message": "Detection Timeout"
  },
  "motor": {
    "id": 1,
    "enable": false,
    "amount": 0,
    "status": "standby"
  },
  "weight": {
    "enable": false
  }
}
```

**说明**:
- LCD 显示 "Detection Timeout" 警告用户
- 自动禁用重量传感器

---

### 5. 定时喂食准备

**场景**: 到达设定的喂食时间

**消息**:
```json
{
  "LCD": {
    "message": "Feeding Time"
  },
  "motor": {
    "id": 1,
    "enable": true,
    "amount": 150,
    "status": "ready"
  },
  "weight": {
    "enable": true
  }
}
```

**说明**:
- LCD 显示 "Feeding Time" 提示喂食开始
- 启用电机准备出粮 150g
- 启用重量传感器检测宠物

---

### 6. 喂食进行中

**场景**: 电机正在出粮

**消息**:
```json
{
  "LCD": {
    "message": "Dispensing..."
  },
  "motor": {
    "id": 1,
    "enable": true,
    "amount": 150,
    "status": "dispensing"
  },
  "weight": {
    "enable": true
  }
}
```

**说明**:
- LCD 显示 "Dispensing..." 动态提示
- 电机状态为 "dispensing"
- 保持重量传感器启用

---

### 7. 喂食完成

**场景**: 出粮完成

**消息**:
```json
{
  "LCD": {
    "message": "Feeding Complete"
  },
  "motor": {
    "id": 1,
    "enable": false,
    "amount": 0,
    "status": "complete"
  },
  "weight": {
    "enable": false
  }
}
```

**说明**:
- LCD 显示 "Feeding Complete" 确认完成
- 停止电机
- 禁用重量传感器

---

### 8. 食物不足警告

**场景**: Weight Sensor 1 检测到食物重量 < 1kg

**消息**:
```json
{
  "LCD": {
    "message": "Food Low!"
  },
  "motor": {
    "id": 1,
    "enable": false,
    "amount": 0,
    "status": "error"
  },
  "weight": {
    "enable": true
  }
}
```

**说明**:
- LCD 显示 "Food Low!" 警告
- 电机状态为 "error" 不能出粮
- 保持重量传感器启用持续监测

---

## 💻 前端 TypeScript 调用示例

```typescript
import { apiService } from './services/apiService';

// 示例 1: Pet Binding 开始
const startPetBinding = async () => {
  try {
    const response = await apiService.sendHardwareControl({
      LCD: { message: "Pet Binding" },
      motor: { id: 1, enable: false, amount: 0, status: "standby" },
      weight: { enable: true }
    });
    console.log('Hardware control sent:', response);
  } catch (error) {
    console.error('Failed to send hardware control:', error);
  }
};

// 示例 2: 开始喂食
const startFeeding = async (amount: number) => {
  try {
    await apiService.sendHardwareControl({
      LCD: { message: "Feeding Time" },
      motor: { id: 1, enable: true, amount, status: "ready" },
      weight: { enable: true }
    });
  } catch (error) {
    console.error('Failed to start feeding:', error);
  }
};

// 示例 3: 只发送部分信息
const updateLCDOnly = async () => {
  await apiService.sendHardwareControl({
    LCD: { message: "Hello Pet!" }
    // motor 和 weight 可以省略
  });
};
```

---

## 🐚 命令行测试

### 使用 mosquitto_pub 发送 JSON 消息

```bash
# Pet Binding 开始
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t hardwareControl -m '{
  "LCD": {"message": "Pet Binding"},
  "motor": {"id": 1, "enable": false, "amount": 0, "status": "standby"},
  "weight": {"enable": true}
}'

# 喂食 100g
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t hardwareControl -m '{
  "LCD": {"message": "Feeding Time"},
  "motor": {"id": 1, "enable": true, "amount": 100, "status": "ready"},
  "weight": {"enable": true}
}'

# 只更新 LCD 显示
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t hardwareControl -m '{
  "LCD": {"message": "System Ready"}
}'
```

### 使用 curl 测试 REST API

```bash
# Pet Binding 开始
curl -X POST http://localhost:3001/api/mqtt/hardware-control \
  -H "Content-Type: application/json" \
  -d '{
    "LCD": {"message": "Pet Binding"},
    "motor": {"id": 1, "enable": false, "amount": 0, "status": "standby"},
    "weight": {"enable": true}
  }'

# 喂食 150g
curl -X POST http://localhost:3001/api/mqtt/hardware-control \
  -H "Content-Type: application/json" \
  -d '{
    "LCD": {"message": "Feeding Time"},
    "motor": {"id": 1, "enable": true, "amount": 150, "status": "ready"},
    "weight": {"enable": true}
  }'
```

---

## 📊 后端日志示例

当发送硬件控制消息时，后端会输出详细的日志：

```
[mqtt] Published hardware control: {
  "LCD": {
    "message": "Pet Binding"
  },
  "motor": {
    "id": 1,
    "enable": false,
    "amount": 0,
    "status": "standby"
  },
  "weight": {
    "enable": true
  },
  "timestamp": "2025-11-10T12:30:45.123Z"
}
```

---

## 🔄 与原有 API 的兼容性

新的 JSON 格式 API 与原有的单独控制 API **完全兼容**，可以混用：

### 原有 API (仍然可用)

```javascript
// 单独控制 LCD
await apiService.sendLCDMessage("Hello");

// 单独控制电机
await apiService.controlMotor1("start");
await apiService.controlMotor2("stop");

// 单独控制重量传感器
await apiService.controlWeightSensor(1, true);
```

### 新 API (推荐使用)

```javascript
// 统一控制所有硬件
await apiService.sendHardwareControl({
  LCD: { message: "Hello" },
  motor: { id: 1, enable: true, amount: 100, status: "ready" },
  weight: { enable: true }
});
```

**建议**: 在新的功能中优先使用 JSON 格式 API，因为：
1. ✅ 一次调用控制多个硬件
2. ✅ 减少网络请求次数
3. ✅ 保证多个硬件状态同步
4. ✅ 更易于硬件端解析和处理

---

## ⚠️ 注意事项

1. **字段验证**:
   - `motor.id` 必须是 1 或 2
   - `motor.enable` 和 `weight.enable` 必须是布尔值
   - `motor.amount` 必须是非负数
   - `LCD.message` 必须是字符串

2. **可选字段**:
   - 可以只发送需要的部分，例如只发送 `LCD` 而省略 `motor` 和 `weight`
   - `motor.status` 是可选字段

3. **时间戳**:
   - `timestamp` 由后端自动生成，前端发送时无需包含

4. **JSON 格式**:
   - 必须是有效的 JSON 格式
   - 字符串必须用双引号
   - 布尔值用 `true`/`false` 而不是字符串

---

## 🎉 优势总结

✅ **统一接口**: 一个 API 调用控制所有硬件  
✅ **状态同步**: 确保 LCD、电机、传感器状态一致  
✅ **减少延迟**: 减少多次网络请求的开销  
✅ **易于扩展**: 未来添加新硬件只需扩展 JSON 结构  
✅ **完全兼容**: 与原有 API 100% 兼容，可以混用  
✅ **类型安全**: TypeScript 类型定义确保编译时检查  

---

## 📚 相关文档

- [MQTT_TOPICS_GUIDE.md](./MQTT_TOPICS_GUIDE.md) - 原有 MQTT topics 详细说明
- [WEIGHT_SENSOR_CONTROL.md](./WEIGHT_SENSOR_CONTROL.md) - 重量传感器控制说明
- [PETBINDING_TEST_GUIDE.md](./PETBINDING_TEST_GUIDE.md) - Pet Binding 测试指南
