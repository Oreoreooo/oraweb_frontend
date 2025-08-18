// API 配置
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://2eb9715e7328.ngrok-free.app';

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
