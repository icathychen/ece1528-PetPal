# Weight Sensor 控制功能说明

## ⭐ 新增功能

### 1. Weight Sensor 启用/禁用控制

系统现在可以通过 MQTT 消息控制重量传感器的启用和禁用状态。

#### MQTT Topics

- **weightSensor1Control**: 控制重量传感器 1
- **weightSensor2Control**: 控制重量传感器 2

#### 消息格式

- `"enable"` - 启用传感器
- `"disable"` - 禁用传感器

#### 使用示例

```bash
# 启用重量传感器 1
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1Control -m "enable"

# 禁用重量传感器 1
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1Control -m "disable"

# 启用重量传感器 2
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor2Control -m "enable"

# 禁用重量传感器 2
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor2Control -m "disable"
```

---

## 🔄 自动控制流程

### Pet Binding 工作流程

1. **用户点击 "Start Weight Detection"**
   - ✅ 清除后端缓存的旧重量数据
   - ✅ 发送 MQTT 消息: `weightSensor1Control <- "enable"`
   - ✅ Weight 输入框背景变为蓝色（启用状态）
   - ✅ 开始每 500ms 轮询一次重量数据
   - ⚠️ **Weight 输入框此时可编辑**，但会被传感器数据覆盖

2. **重量传感器发送数据**
   - 硬件发送: `weightSensor1 <- "3.5"`
   - 后端接收并缓存数据
   - 前端轮询获取并显示: `📊 Current weight: 3.50kg`
   - Weight 输入框自动更新为 3.5

3. **用户点击 "Stop Detection"**
   - ✅ 停止轮询
   - ✅ 发送 MQTT 消息: `weightSensor1Control <- "disable"`
   - ✅ 保持当前检测到的重量值
   - ✅ Weight 输入框背景变回白色
   - ✅ **Weight 输入框可继续编辑**以微调数值

4. **用户点击 "Cancel"**
   - ✅ 停止轮询
   - ✅ 发送 MQTT 消息: `weightSensor1Control <- "disable"`
   - ✅ 清除后端缓存数据
   - ✅ Weight 输入框重置为 0
   - ✅ 禁用 Weight 输入框（需重新开始检测才能输入）

5. **检测超时（60秒）**
   - ⏱️ 自动停止轮询
   - ✅ 自动发送 MQTT 消息: `weightSensor1Control <- "disable"`
   - ⚠️ 显示超时警告
   - ✅ 保持最后检测到的重量值

---

## 🎯 Weight 输入框的启用规则

### 规则说明

| 场景 | Weight 输入框状态 | 背景颜色 | 说明 |
|------|------------------|---------|------|
| 初始状态（未开始检测） | ❌ 禁用 | 白色 | 必须先点击 "Start Weight Detection" |
| 检测进行中 | ✅ 启用 | 蓝色 (#e3f2fd) | 可手动编辑，但会被传感器数据覆盖 |
| 停止检测后（有重量值） | ✅ 启用 | 白色 | 可自由编辑重量值 |
| 取消检测后 | ❌ 禁用 | 白色 | 重量已清零，需重新开始检测 |

### Helper Text 提示

- **初始状态**: "Click 'Start Weight Detection' first to enable"
- **检测中**: "Auto-updating from sensor (you can manually edit anytime)"
- **停止后**: "Weight detected. You can manually adjust if needed"

---

## 🔧 REST API

### 控制 Weight Sensor 启用/禁用

```http
POST /api/mqtt/weight-sensor-control
Content-Type: application/json

{
  "sensorId": 1,
  "enable": true
}
```

**请求参数**:
- `sensorId`: 1 或 2
- `enable`: true (启用) 或 false (禁用)

**响应示例**:
```json
{
  "success": true,
  "message": "Weight sensor 1 enabled",
  "timestamp": "2025-11-09T10:30:00.000Z"
}
```

**前端调用**:
```typescript
// 启用传感器 1
await apiService.controlWeightSensor(1, true);

// 禁用传感器 1
await apiService.controlWeightSensor(1, false);
```

---

## 📝 完整测试流程

### 测试场景 1: 正常检测流程

```bash
# 步骤 1: 用户在前端点击 "Start Weight Detection"
# 系统自动发送: weightSensor1Control <- "enable"
# 系统自动清除: DELETE /api/mqtt/weight/1

# 步骤 2: 硬件发送重量数据
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.5"

# 观察前端: Weight 输入框显示 3.5，背景是蓝色

# 步骤 3: 硬件更新重量
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.7"

# 观察前端: Weight 输入框自动更新为 3.7

# 步骤 4: 用户点击 "Stop Detection"
# 系统自动发送: weightSensor1Control <- "disable"
# Weight 保持为 3.7，背景变白，仍可编辑
```

### 测试场景 2: 检测中手动修改

```bash
# 步骤 1: 开始检测
# 前端: 点击 "Start Weight Detection"

# 步骤 2: 传感器发送错误数据
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "10.0"

# 观察: 输入框显示 10.0

# 步骤 3: 用户手动修改
# 前端: 在 Weight 输入框中改为 3.5

# 步骤 4: 传感器再次发送数据
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.8"

# 观察: 输入框被覆盖为 3.8（因为还在检测中）

# 步骤 5: 停止检测
# 前端: 点击 "Stop Detection"

# 步骤 6: 再次手动修改
# 前端: 改为 3.5
# 观察: 这次不会被覆盖了
```

### 测试场景 3: 取消后重新检测

```bash
# 步骤 1: 第一次检测
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "5.0"

# 步骤 2: 取消
# 前端: 点击 "Cancel"
# 系统自动: weightSensor1Control <- "disable"
# 系统自动: DELETE /api/mqtt/weight/1
# Weight 重置为 0

# 步骤 3: 重新开始检测
# 前端: 点击 "Start Weight Detection"
# 系统自动: weightSensor1Control <- "enable"
# 系统自动: 清除旧数据

# 步骤 4: 发送新的重量
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.2"

# 观察: 显示新重量 3.2，不会显示旧的 5.0
```

---

## 🏗️ 技术实现细节

### 后端 (backend/src/services/mqtt.js)

```javascript
function publishWeightSensorControl(sensorId, enable) {
  const topic = sensorId === 1 ? 'weightSensor1Control' : 'weightSensor2Control';
  const command = enable ? 'enable' : 'disable';
  publish(topic, command);
  console.log(`[mqtt] Published to ${topic}: ${command}`);
}
```

### 后端 API (backend/src/routes/api.js)

```javascript
router.post('/mqtt/weight-sensor-control', (req, res) => {
  const { sensorId, enable } = req.body;
  publishWeightSensorControl(sensorId, enable);
  res.json({ success: true, message: `Weight sensor ${sensorId} ${enable ? 'enabled' : 'disabled'}` });
});
```

### 前端 API (frontend/src/services/apiService.ts)

```typescript
async controlWeightSensor(sensorId: number, enable: boolean) {
  return this.request('/api/mqtt/weight-sensor-control', {
    method: 'POST',
    body: JSON.stringify({ sensorId, enable }),
  });
}
```

### 前端逻辑 (frontend/src/pages/PetBinding.tsx)

```typescript
const startWeightDetection = async () => {
  // 1. 清除旧数据
  await apiService.clearWeightSensor(1);
  
  // 2. 启用传感器
  await apiService.controlWeightSensor(1, true);
  
  // 3. 开始轮询
  setBindingMode(true);
  // ...
};

const stopWeightDetection = async () => {
  // 1. 停止轮询
  clearInterval(pollIntervalRef);
  
  // 2. 禁用传感器
  await apiService.controlWeightSensor(1, false);
  
  // 3. 保持重量值
  setBindingMode(false);
};
```

---

## 📊 状态图

```
┌─────────────────┐
│  Initial State  │
│  Weight = 0     │
│  Disabled       │
└────────┬────────┘
         │
         │ Click "Start Weight Detection"
         │ → Clear old data
         │ → Enable sensor (MQTT)
         ▼
┌─────────────────┐
│   Detecting     │
│  Weight = auto  │
│  Enabled (blue) │
│  Editable*      │
└────┬───┬───┬────┘
     │   │   │
     │   │   └─ Timeout (60s)
     │   │      → Disable sensor
     │   │      → Keep weight
     │   │
     │   └─ Click "Stop"
     │      → Disable sensor
     │      → Keep weight
     │      → Editable
     │
     └─ Click "Cancel"
        → Disable sensor
        → Clear weight
        → Disabled
        ▼
   ┌─────────────────┐
   │ Stopped/Finished│
   │ Weight = detected│
   │ Enabled (white) │
   │ Editable        │
   └─────────────────┘

* 注意: 检测中虽然可编辑，但会被传感器数据覆盖
```

---

## ✅ 功能优势

1. **节能**: 不需要时自动禁用传感器
2. **数据清洁**: 每次开始检测前清除旧数据，避免混淆
3. **用户控制**: 灵活的手动启停控制
4. **防止误操作**: 初始状态下 Weight 输入框禁用，必须先开始检测
5. **视觉反馈**: 蓝色背景清晰表明检测进行中
6. **灵活编辑**: 停止后可以微调重量值
