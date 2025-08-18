const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// 设置端口，优先使用环境变量PORT，否则使用3000
const PORT = process.env.PORT || 3000;

// 添加CORS支持
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 添加基本的中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查端点 - 这很重要，Railway会用它检查应用状态
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV || 'development'
  });
});

// 根路径健康检查
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'API OK' });
});

// 服务静态文件 - 检查build文件夹是否存在
const buildPath = path.join(__dirname, 'build');

console.log(`Starting server...`);
console.log(`Build path: ${buildPath}`);
console.log(`Build folder exists: ${fs.existsSync(buildPath)}`);
console.log(`PORT: ${PORT}`);

if (fs.existsSync(buildPath)) {
  // 服务静态文件
  app.use(express.static(buildPath, {
    maxAge: '1y',
    etag: false
  }));
  
  // 处理React Router（所有非API路由都返回index.html）
  app.get('*', (req, res) => {
    console.log(`Serving index.html for route: ${req.path}`);
    res.sendFile(path.join(buildPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).send('Error serving page');
      }
    });
  });
} else {
  // 如果build文件夹不存在，返回错误信息
  app.get('*', (req, res) => {
    const error = {
      error: 'Build folder not found. Please run "npm run build" first.',
      buildPath: buildPath,
      files: fs.readdirSync(__dirname).filter(f => !f.startsWith('.'))
    };
    console.error('Build folder missing:', error);
    res.status(500).json(error);
  });
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// 启动服务器，绑定到所有网络接口
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server successfully started!`);
  console.log(`🌐 Port: ${PORT}`);
  console.log(`📁 Build path: ${buildPath}`);
  console.log(`📦 Build folder exists: ${fs.existsSync(buildPath)}`);
  console.log(`🚀 Server is running and ready to accept connections`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;
