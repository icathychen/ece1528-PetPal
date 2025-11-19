# PetBinding 重量检测测试指南

## ✅ 新功能

### 1. 手动停止重量检测（而不是自动停止）
**功能**: 重量检测现在是**连续更新模式**，不会在检测到重量后自动停止

**行为**:
- 点击 "Start Weight Detection" 后开始持续监测
- 每 500ms 更新一次重量值
- 显示实时重量读数：`📊 Current weight: X.XX kg`
- 必须手动点击 **"Stop Detection"** 按钮才会停止检测
- 60秒超时自动停止（防止忘记手动停止）

### 2. 检测完成后可以手动修改重量
**功能**: Weight 输入框**始终可编辑**

**行为**:
- 开始检测前：可以手动输入重量
- 检测过程中：
  - 输入框背景变为浅蓝色表示正在自动更新
  - 但你仍然可以随时手动修改
  - 手动修改后，下一次传感器更新会覆盖你的输入
- 停止检测后：可以微调重量值
- 提示文本会根据状态变化

---

## 🎯 新的工作流程

### 场景 1: 使用传感器检测 + 手动微调

1. **开始检测**: 点击 "Start Weight Detection"
2. **观察实时更新**: 
   ```
   📊 Current weight: 3.45kg
   📊 Current weight: 3.48kg
   📊 Current weight: 3.50kg
   ```
3. **手动停止**: 当数值稳定时，点击 "Stop Detection"
4. **微调重量**: 如果需要，手动修改为精确值（如 3.48 → 3.5）
5. **继续填写**: 填写其他信息并提交

### 场景 2: 检测过程中发现重量不对

1. **检测中**: 传感器显示 5.2kg，但你知道宠物实际是 3.5kg
2. **手动修改**: 直接在输入框中改为 3.5
3. **继续检测**: 如果传感器再次更新，会覆盖你的输入
4. **停止检测**: 点击 "Stop Detection" 保持当前值
5. **或取消**: 点击 "Cancel" 清除所有数据重新开始

### 场景 3: 完全手动输入

1. **不启动检测**: 直接在 Weight 输入框手动输入
2. **填写其他信息**: 完成表单其他字段
3. **提交**: 直接提交，无需使用传感器

---

## 🎨 UI 变化说明

### Weight Sensor Status 面板

#### 状态 1: Standby (待机)
- 背景: 灰色 (#f5f5f5)
- 按钮: "Start Weight Detection" (蓝色)
- 文本: "Standby Mode"

#### 状态 2: Detecting (持续检测中)
- 背景: 紫色 (#f3e5f5)
- 显示: 
  - 旋转进度圈
  - **实时重量读数**: "Reading: X.XXkg" (蓝色加粗)
- 按钮:
  - **"Stop Detection"** (绿色) - 保持当前值并停止
  - "Cancel" (红色边框) - 清除所有数据
- 文本: "Pet Binding Mode Active"

### Weight 输入框

#### 正常状态
- 背景: 白色
- 提示: "Enter manually or use weight detection"
- **可编辑**: ✅

#### 检测中状态
- 背景: 浅蓝色 (#e3f2fd) - 表示正在自动更新
- 提示: "Auto-updating from sensor (you can manually edit anytime)"
- **可编辑**: ✅ 始终可编辑！

#### 停止后状态
- 背景: 白色
- 提示: "Enter manually or use weight detection"
- **可编辑**: ✅

---

## 🧪 测试步骤

### 测试 1: 连续监测模式

1. **开始检测**:
   ```
   点击 "Start Weight Detection"
   ```

2. **发送第一个重量**:
   ```powershell
   docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.2"
   ```
   - 观察: 输入框显示 3.2，状态显示 "Reading: 3.20kg"

3. **发送第二个重量** (模拟重量变化):
   ```powershell
   docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.5"
   ```
   - 观察: 输入框自动更新为 3.5，状态更新为 "Reading: 3.50kg"

4. **发送第三个重量**:
   ```powershell
   docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.48"
   ```
   - 观察: 继续更新为 3.48

5. **手动停止**:
   ```
   点击 "Stop Detection" 按钮
   ```
   - 观察: 
     - 进度圈消失
     - 背景变回白色
     - 重量保持在 3.48
     - 提示信息: "Weight reading stopped at: 3.48kg. You can manually adjust if needed."

### 测试 2: 检测过程中手动修改

1. **开始检测并发送重量**:
   ```powershell
   docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "5.0"
   ```
   - 输入框显示: 5.0

2. **手动修改重量**:
   - 在输入框中直接改为 3.5
   - 观察: 输入框立即变为 3.5

3. **再次发送传感器数据**:
   ```powershell
   docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "5.2"
   ```
   - 观察: 输入框被覆盖为 5.2（传感器数据优先）

4. **停止检测**:
   - 点击 "Stop Detection"

5. **再次手动修改**:
   - 改为 3.5
   - 观察: 这次不会被覆盖了

### 测试 3: 停止后微调

1. **完成一次检测** (按测试1流程)
   - 最终重量: 3.48kg

2. **手动微调**:
   - 点击输入框
   - 改为 3.5
   - 观察: 成功修改，不会被覆盖

3. **填写其他信息并提交**

### 测试 4: 完全手动输入（不用传感器）

1. **不启动检测**
2. **直接在 Weight 输入框输入**: 4.2
3. **填写其他字段**: Name, Animal Type, 等
4. **提交表单**: 应该成功

---

## 🔍 后端日志验证

查看后端日志确认 MQTT 消息被正确处理:

```powershell
docker compose logs -f backend | Select-String "mqtt"
```

应该看到:
```
[mqtt] connected: mqtt://mqtt:1883
[mqtt] subscribed petpal/#
[mqtt] subscribed to weightSensor1
[mqtt] weightSensor1 -> 3.5
[mqtt] Weight Sensor 1 updated: 3.5
[mqtt] Weight Sensor 1 data cleared
[mqtt] weightSensor1 -> 4.2
[mqtt] Weight Sensor 1 updated: 4.2
```

---

## 📡 API 端点测试

### 获取当前重量
```powershell
# PowerShell
Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Get

# 或使用 curl
curl http://localhost:3001/api/mqtt/weight/1
```

**预期响应**:
```json
{
  "success": true,
  "sensor_id": 1,
  "weight": 3.5,
  "timestamp": "2025-11-09T20:30:00.000Z"
}
```

### 清除重量数据
```powershell
# PowerShell
Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Delete

# 或使用 curl
curl -X DELETE http://localhost:3001/api/mqtt/weight/1
```

**预期响应**:
```json
{
  "success": true,
  "message": "Weight sensor 1 data cleared",
  "timestamp": "2025-11-09T20:31:00.000Z"
}
```

### 再次获取重量（应为 null）
```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Get
```

**预期响应**:
```json
{
  "success": true,
  "sensor_id": 1,
  "weight": null,
  "timestamp": "2025-11-09T20:32:00.000Z"
}
```

---

## 🎨 UI 功能说明

### Weight Sensor Status 面板

#### 状态 1: Standby (待机)
- 背景: 灰色 (#f5f5f5)
- 按钮: "Start Weight Detection" (蓝色)
- 文本: "Standby Mode"

#### 状态 2: Detecting (检测中)
- 背景: 紫色 (#f3e5f5)
- 显示: 旋转进度圈 + "Waiting for weight..."
- 按钮: "Cancel" (红色边框)
- 文本: "Pet Binding Mode Active"

#### 状态 3: Detected (已检测)
- 背景: 紫色 (#f3e5f5)
- 显示: 绿色 Chip "Weight Detected!" + "Reset" 按钮
- 文本: "Pet Binding Mode Active"

---

## ⚠️ 常见问题排查

### 问题 1: MQTT Console 连接失败
**解决**:
```powershell
# 检查 MQTT broker 是否运行
docker compose ps mqtt

# 查看 MQTT 日志
docker compose logs mqtt

# 确保端口 9001 开放
netstat -an | findstr 9001
```

### 问题 2: 看不到 MQTT 消息
**检查**:
1. MQTT Console 是否已连接 (状态显示 "connected")
2. 是否已订阅 `#` 或 `weightSensor1`
3. 发布的 topic 是否正确 (注意大小写)

### 问题 3: 重量一直检测不到
**排查**:
1. 检查后端日志是否收到 MQTT 消息:
   ```powershell
   docker compose logs -f backend | Select-String "weightSensor1"
   ```
2. 发送的重量值必须 > 0
3. 确保 payload 是数字字符串，如 "3.5" 而不是 {"weight": 3.5}

### 问题 4: Cancel 后重新检测还是旧值
**解决**:
1. 确保点击了 Cancel 或 Reset 按钮
2. 查看后端日志确认清除操作:
   ```
   [mqtt] Weight Sensor 1 data cleared
   ```
3. 如果还有问题，手动清除:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Delete
   ```

---

## 🚀 快速测试脚本

```powershell
# 完整测试脚本
cd D:\1528iot\ece1528-PetPal

# 1. 启动服务
docker compose up -d

# 2. 等待服务就绪
Start-Sleep -Seconds 10

# 3. 清除旧的重量数据
Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Delete

# 4. 发送测试重量 1
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "3.5"
Start-Sleep -Seconds 2

# 5. 检查重量是否被记录
Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Get

# 6. 清除重量数据
Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Delete

# 7. 发送测试重量 2
docker exec -it petpal-mqtt mosquitto_pub -h localhost -t weightSensor1 -m "4.2"
Start-Sleep -Seconds 2

# 8. 再次检查
Invoke-RestMethod -Uri http://localhost:3001/api/mqtt/weight/1 -Method Get
```

---

## 📝 新增的功能总结

### 后端新增
1. ✅ `DELETE /api/mqtt/weight/:sensorId` - 清除重量传感器数据
2. ✅ `clearWeightSensor()` 函数 - 后端服务层清除函数

### 前端新增
1. ✅ `cancelWeightDetection()` 函数 - 取消检测并清除数据
2. ✅ "Cancel" 按钮 - 在检测过程中取消
3. ✅ "Reset" 按钮 - 在检测完成后重置
4. ✅ `clearWeightSensor()` API 调用 - 前端 API 服务
5. ✅ MQTT Console 默认订阅 `#` - 可看到所有消息
6. ✅ MQTT Console 默认发布 topic 改为 `weightSensor1`

---

最后更新: 2025-11-09
