// API 配置
import axios from 'axios';

const isDevelopment = process.env.REACT_APP_ENVIRONMENT === 'development' || process.env.NODE_ENV === 'development';

// 不同环境的API URL
const API_URLS = {
  development: 'http://localhost:5000',
  production: 'https://854c8e371cc0.ngrok-free.app'
};

// 自动选择API URL
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 
                            (isDevelopment ? API_URLS.development : API_URLS.production);

// 手动切换API URL的函数（可选）
export const getApiUrl = (forceProduction = false) => {
  if (forceProduction) {
    return process.env.REACT_APP_API_BASE_URL_PROD || API_URLS.production;
  }
  return API_BASE_URL;
};

// 创建带有CORS headers的axios实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  },
  timeout: 10000
});

// API 端点
export const API_ENDPOINTS = {
  // 认证相关
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  CAPTCHA: '/api/auth/captcha/email',
  
  // 对话相关
  CONVERSATIONS: '/api/conversations',
  
  // 社区相关
  COMMUNITY_POSTS: '/api/community/posts',
};

// 完整的API URL构建器
export const buildApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};
