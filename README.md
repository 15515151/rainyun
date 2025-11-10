# Curl命令解析抢券工具

自动解析curl命令并执行高频轮询抢券的Node.js脚本。无需手动配置，直接从curl命令获取所有信息！

## ✨ 特点

- ✅ 自动解析curl命令（支持Windows和Linux格式）
- ✅ 无需手动配置headers和cookies
- ✅ 高频轮询（默认50ms，可自定义）
- ✅ 自动解压缩响应（gzip/deflate/brotli）
- ✅ 智能错误处理和重试
- ✅ 实时统计信息
- ✅ 彩色日志输出

## 🚀 快速开始

### 方法1：使用默认配置文件

1. **获取curl命令**
   - 在浏览器中按 F12 打开开发者工具
   - 切换到 Network（网络）标签
   - 找到抢券请求，右键 → Copy → Copy as cURL (cmd)

2. **保存curl命令**
   ```bash
   # 将复制的curl命令粘贴到 curl.txt 文件中
   ```

3. **运行脚本**
   ```bash
   node curl-grabber.js
   ```

### 方法2：指定curl文件路径

```bash
node curl-grabber.js my-curl.txt
```

## 📋 curl.txt 文件示例

### Windows格式（从Chrome复制为cURL (cmd)）

```bash
curl ^"https://api.v2.rainyun.com/user/reward/items^" ^
  -H ^"accept: application/json^" ^
  -H ^"content-type: application/json^" ^
  -b ^"cookie=value^" ^
  -H ^"x-csrf-token: your-token^" ^
  --data-raw ^"^{^\^"item_id^\^":1145^}^"
```

### Linux/Mac格式（从Chrome复制为cURL (bash)）

```bash
curl 'https://api.v2.rainyun.com/user/reward/items' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -b 'cookie=value' \
  -H 'x-csrf-token: your-token' \
  --data-raw '{"item_id":1145}'
```

## ⚙️ 配置选项

在 `curl-grabber.js` 文件顶部修改配置：

```javascript
const config = {
  interval: 50,      // 轮询间隔(毫秒)
  maxAttempts: 0,    // 最大尝试次数，0表示无限制
  curlFile: 'curl.txt' // curl命令文件路径
};
```

## 📊 输出说明

运行时会显示：
- 🚀 启动信息（URL、方法、优惠券ID、轮询间隔）
- 📈 每次尝试的时间戳和状态码
- 🎉 成功信息（绿色）
- ⚠️  警告信息（黄色）
- ❌ 错误信息（红色）

结束时显示统计：
- 总尝试次数
- 成功/失败/错误次数
- 运行时长
- 平均请求速度（次/秒）

## 🔍 如何获取最新的curl命令

### Chrome浏览器

1. 打开雨云网站并登录
2. 按 `F12` 打开开发者工具
3. 切换到 `Network` 标签
4. 执行一次领券操作（会失败也没关系）
5. 在Network中找到对 `api.v2.rainyun.com/user/reward/items` 的POST请求
6. 右键点击该请求 → `Copy` → `Copy as cURL (cmd)` (Windows) 或 `Copy as cURL (bash)` (Mac/Linux)
7. 粘贴到 `curl.txt` 文件

### Edge浏览器

步骤与Chrome相同

### Firefox浏览器

1. 按 `F12` 打开开发者工具
2. 切换到 `网络` 标签
3. 执行一次领券操作
4. 找到相应请求，右键 → `复制` → `复制为cURL`
5. 粘贴到 `curl.txt` 文件


## ❓ 常见问题

### 1. 提示"登录凭证已过期"

Cookie和Token有时效性，需要：
1. 重新从浏览器获取最新的curl命令
2. 更新 `curl.txt` 文件
3. 重新运行脚本

### 2. 无法读取curl.txt文件

检查：
- 文件是否存在于当前目录
- 文件名是否正确
- 或使用：`node curl-grabber.js <完整文件路径>`

### 3. 解析curl命令失败

确保：
- curl命令完整，包含所有必要的headers
- 文件编码为UTF-8
- Windows格式的curl命令正确保存了 `^` 转义符

### 4. 请求频率会不会被封？

建议间隔设置为 50-100ms。脚本已包含：
- 智能错误处理
- 登录状态检测
- 自动停止机制

## 🎯 使用技巧

### 1. 在优惠券开抢前准备

```bash
# 提前几分钟启动脚本，等待活动开始
node curl-grabber.js
```

脚本会持续监控，一旦活动开始立即抢券。

### 2. 修改轮询速度

```javascript
// 在 curl-grabber.js 中修改
const config = {
  interval: 100,  // 改为100ms，更温和
};
```

### 3. 同时抢多个优惠券

1. 复制多个curl命令到不同文件（如 `curl1.txt`, `curl2.txt`）
2. 在不同终端窗口运行：
   ```bash
   node curl-grabber.js curl1.txt
   node curl-grabber.js curl2.txt
   ```

### 4. 测试curl命令是否有效

设置最大尝试次数为1：
```javascript
const config = {
  maxAttempts: 1,  // 只尝试1次，用于测试
};
```

## ⚠️  注意事项

1. **遵守服务条款**：请合理使用，遵守雨云服务条款
2. **请求频率**：不要设置过高的请求频率，避免对服务器造成压力
3. **隐私安全**：curl.txt 包含你的登录凭证，不要分享给他人
4. **及时更新**：Cookie会过期，建议每次使用前更新curl命令
5. **仅供学习**：此脚本仅供学习交流使用

## 🆚 与原版的对比

| 特性 | curl-grabber.js | grab-coupon.js |
|------|-----------------|----------------|
| 配置方式 | 粘贴curl命令 | 手动配置 |
| 更新凭证 | 替换整个curl.txt | 逐个更新headers |
| 易用性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 灵活性 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 推荐场景 | 日常快速使用 | 需要精确控制 |

## 📄 License

MIT

---

## 🎉 开始使用

```bash
# 1. 从浏览器复制curl命令
# 2. 粘贴到 curl.txt
# 3. 运行
node curl-grabber.js
```

就这么简单！
