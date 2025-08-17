const express = require('express');
const path = require('path');
const app = express();

// 设置端口，优先使用环境变量PORT，否则使用3000
const PORT = process.env.PORT || 3000;

// 添加基本的中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 服务静态文件 - 检查build文件夹是否存在
const buildPath = path.join(__dirname, 'build');
const fs = require('fs');

if (fs.existsSync(buildPath)) {
  // 如果build文件夹存在，服务构建后的文件
  app.use(express.static(buildPath));
  
  // 处理React Router（所有非API路由都返回index.html）
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  // 如果build文件夹不存在，返回错误信息
  app.get('*', (req, res) => {
    res.status(500).json({ 
      error: 'Build folder not found. Please run "npm run build" first.',
      buildPath: buildPath
    });
  });
}

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Build path: ${buildPath}`);
  console.log(`Build folder exists: ${fs.existsSync(buildPath)}`);
});
