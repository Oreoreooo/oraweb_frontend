// 统一的认证工具函数

// 检查用户是否已登录
export const isAuthenticated = () => {
  return localStorage.getItem('access_token') !== null;
};

// 获取访问令牌
export const getAccessToken = () => {
  return localStorage.getItem('access_token');
};

// 获取用户信息
export const getUserInfo = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// 清除认证信息
export const clearAuth = () => {
  // 不再清除用户草稿，让用户下次登录时可以继续
  // clearAllUserDrafts();
  
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
};

// 清除认证信息（可选择是否清除草稿）
export const clearAuthWithDrafts = (clearDrafts = false) => {
  if (clearDrafts) {
    clearAllUserDrafts();
  }
  
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
};

// 统一的登录检查和跳转
export const checkAuthWithRedirect = () => {
  if (!isAuthenticated()) {
    alert('请先登录后再使用此功能');
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
    return false;
  }
  return true;
};

// 处理API错误，特别是401未授权错误
export const handleApiError = (error) => {
  if (error.response?.status === 401) {
    alert('登录已过期，请重新登录');
    clearAuth();
    setTimeout(() => {
      window.location.href = '/login';
    }, 100);
  }
  return error;
};

// 为axios请求添加认证头
export const getAuthHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// 清除用户特定的草稿
export const clearUserDraft = (userId) => {
  if (userId) {
    const draftKey = `writeStoryDraft_user_${userId}`;
    localStorage.removeItem(draftKey);
  }
};

// 清除所有用户草稿（登出时使用）
export const clearAllUserDrafts = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('writeStoryDraft_user_')) {
      localStorage.removeItem(key);
    }
  });
};
