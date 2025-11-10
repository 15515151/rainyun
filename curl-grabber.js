const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

// 配置
const config = {
  interval: 300,      // 轮询间隔(毫秒)
  maxAttempts: 0,    // 最大尝试次数，0表示无限制
  curlFile: 'curl.txt' // curl命令文件路径
};

// 统计信息
const stats = {
  attempts: 0,
  success: 0,
  failed: 0,
  errors: 0,
  startTime: null
};

// 解析curl命令
function parseCurl(curlCommand) {
  // 首先移除行尾的 ^ 和紧跟的换行符，将多行合并为一行
  curlCommand = curlCommand.replace(/\^\r?\n\s*/g, ' ');
  // 移除行尾剩余的 ^
  curlCommand = curlCommand.replace(/\^\s+/g, ' ');

  const result = {
    url: '',
    method: 'GET',
    headers: {},
    body: null
  };

  // 提取URL
  const urlMatch = curlCommand.match(/curl\s+\^?"([^"]+)"/);
  if (urlMatch) {
    result.url = urlMatch[1].replace(/\^+$/, '');
  }

  // 提取方法
  const methodMatch = curlCommand.match(/-X\s+(\w+)/i);
  if (methodMatch) {
    result.method = methodMatch[1].toUpperCase();
  }

  // 提取所有 -H 或 --header 参数
  const headerRegex = /-H\s+\^?"([^"]+)"/g;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(curlCommand)) !== null) {
    let header = headerMatch[1];
    // 移除header中的^转义
    header = header.replace(/\^(.)/g, '$1');
    // 移除末尾的^
    header = header.replace(/\^+$/, '');

    const colonIndex = header.indexOf(':');
    if (colonIndex > 0) {
      const key = header.substring(0, colonIndex).trim();
      let value = header.substring(colonIndex + 1).trim();
      // 移除value末尾的^
      value = value.replace(/\^+$/, '');
      result.headers[key.toLowerCase()] = value;
    }
  }

  // 提取 cookie (-b 或 --cookie)
  const cookieMatch = curlCommand.match(/-b\s+\^?"([^"]+)"/);
  if (cookieMatch) {
    let cookie = cookieMatch[1];
    // 移除cookie中的^转义
    cookie = cookie.replace(/\^(.)/g, '$1');
    // 移除末尾的^
    cookie = cookie.replace(/\^+$/, '');
    result.headers['cookie'] = cookie;
  }

  // 提取 body (--data-raw, --data, -d)
  const bodyMatch = curlCommand.match(/(?:--data-raw|--data|-d)\s+\^?"(.+)"$/);
  if (bodyMatch) {
    let bodyStr = bodyMatch[1];
    // 移除body中的所有^转义符，例如 ^\^" 变成 \"
    bodyStr = bodyStr.replace(/\^(.)/g, '$1');
    // 移除末尾的单独的^
    bodyStr = bodyStr.replace(/\^+$/g, '');
    // 将 \" 替换为真正的引号
    bodyStr = bodyStr.replace(/\\"/g, '"');
    result.body = bodyStr;

    // 如果有body但没有显式指定method，默认为POST
    if (!methodMatch) {
      result.method = 'POST';
    }
  }

  return result;
}

// 发送请求
function sendRequest(config) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(config.url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: config.method,
      headers: config.headers
    };

    // 如果有body，设置Content-Length
    if (config.body) {
      options.headers['content-length'] = Buffer.byteLength(config.body);
    }

    const req = https.request(options, (res) => {
      let stream = res;
      const encoding = res.headers['content-encoding'];

      // 根据 content-encoding 解压
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = '';

      stream.on('data', (chunk) => {
        data += chunk;
      });

      stream.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ statusCode: res.statusCode, headers: res.headers, data: response });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: data });
        }
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (config.body) {
      req.write(config.body);
    }

    req.end();
  });
}

// 处理响应
async function handleRequest(requestConfig) {
  stats.attempts++;

  try {
    const result = await sendRequest(requestConfig);
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 });

    console.log(`[${timestamp}] 第 ${stats.attempts} 次尝试 | 状态码: ${result.statusCode}`);

    if (result.statusCode === 200 && result.data.code === 200) {
      stats.success++;
      console.log('\x1b[32m%s\x1b[0m', '🎉 抢券成功！');
      console.log('响应数据:', JSON.stringify(result.data, null, 2));
      stopGrabbing(true);
    } else {
      stats.failed++;

      // 只在第一次失败或特殊情况时显示详细信息
      if (stats.attempts === 1 || result.data.code !== 30001) {
        console.log('响应:', JSON.stringify(result.data, null, 2));
      }

      // 判断是否需要停止
      if (result.data.code === 30003 || result.data.message?.includes('已领取')) {
        console.log('\x1b[33m%s\x1b[0m', '⚠️  优惠券已经领取过了');
        stopGrabbing(false);
      } else if (result.data.code === 30001) {
        if (stats.attempts === 1) {
          console.log('⏳ 优惠券暂未开始或已结束，持续监控中...');
        }
      } else if (result.data.code === 10001) {
        console.log('\x1b[31m%s\x1b[0m', '❌ 登录凭证已过期，请更新curl命令');
        stopGrabbing(false);
      }
    }
  } catch (error) {
    stats.errors++;
    console.error(`\x1b[31m请求错误:\x1b[0m`, error.message);
  }

  // 检查是否达到最大尝试次数
  if (config.maxAttempts > 0 && stats.attempts >= config.maxAttempts) {
    console.log('\x1b[33m%s\x1b[0m', `已达到最大尝试次数 ${config.maxAttempts}`);
    stopGrabbing(false);
  }
}

// 停止抢券
function stopGrabbing(success) {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  const endTime = Date.now();
  const duration = ((endTime - stats.startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(50));
  console.log('抢券统计:');
  console.log(`总尝试次数: ${stats.attempts}`);
  console.log(`成功次数: ${stats.success}`);
  console.log(`失败次数: ${stats.failed}`);
  console.log(`错误次数: ${stats.errors}`);
  console.log(`运行时长: ${duration} 秒`);
  console.log(`平均速度: ${(stats.attempts / parseFloat(duration)).toFixed(2)} 次/秒`);
  console.log('='.repeat(50));

  process.exit(success ? 0 : 1);
}

// 主函数
function main() {
  // 读取curl命令
  let curlCommand;

  // 支持从命令行参数读取curl文件路径
  const args = process.argv.slice(2);
  if (args.length > 0) {
    config.curlFile = args[0];
  }

  try {
    curlCommand = fs.readFileSync(config.curlFile, 'utf8');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `❌ 无法读取文件: ${config.curlFile}`);
    console.log('\n使用方法:');
    console.log('1. 将curl命令保存到 curl.txt 文件');
    console.log('2. 运行: node curl-grabber.js');
    console.log('或者: node curl-grabber.js <curl文件路径>');
    process.exit(1);
  }

  // 解析curl命令
  const requestConfig = parseCurl(curlCommand);

  if (!requestConfig.url) {
    console.error('\x1b[31m%s\x1b[0m', '❌ 无法解析URL');
    process.exit(1);
  }

  // 提取item_id用于显示
  let itemId = 'unknown';
  if (requestConfig.body) {
    try {
      const bodyObj = JSON.parse(requestConfig.body);
      itemId = bodyObj.item_id || 'unknown';
    } catch (e) {
      // ignore
    }
  }

  console.log('\x1b[36m%s\x1b[0m', '='.repeat(50));
  console.log('\x1b[36m%s\x1b[0m', '🚀 开始抢券...');
  console.log('\x1b[36m%s\x1b[0m', `URL: ${requestConfig.url}`);
  console.log('\x1b[36m%s\x1b[0m', `Method: ${requestConfig.method}`);
  console.log('\x1b[36m%s\x1b[0m', `优惠券ID: ${itemId}`);
  if (requestConfig.body) {
    console.log('\x1b[36m%s\x1b[0m', `Body: ${requestConfig.body}`);
  }
  console.log('\x1b[36m%s\x1b[0m', `轮询间隔: ${config.interval}ms`);
  console.log('\x1b[36m%s\x1b[0m', `最大尝试: ${config.maxAttempts > 0 ? config.maxAttempts + '次' : '无限制'}`);
  console.log('\x1b[36m%s\x1b[0m', '按 Ctrl+C 可随时停止');
  console.log('\x1b[36m%s\x1b[0m', '='.repeat(50) + '\n');

  stats.startTime = Date.now();

  // 立即执行第一次
  handleRequest(requestConfig);

  // 设置定时器
  intervalId = setInterval(() => handleRequest(requestConfig), config.interval);
}

// 处理 Ctrl+C
let intervalId = null;
process.on('SIGINT', () => {
  console.log('\n\n收到停止信号...');
  stopGrabbing(false);
});

// 启动程序
main();
