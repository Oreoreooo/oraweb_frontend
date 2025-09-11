// 简化的环境配置
console.log('🚀 Loading environment configuration...');

// 从URL参数获取API地址
const urlParams = new URLSearchParams(window.location.search);
const apiUrlFromParam = urlParams.get('api_url');

// 从localStorage获取
const apiUrlFromStorage = localStorage.getItem('CUSTOM_API_URL');

// 选择API URL
let apiBaseUrl = apiUrlFromParam || apiUrlFromStorage || 'https://dc1406c09ca8.ngrok-free.app';

console.log('🔍 API URL sources:');
console.log('  - From URL param:', apiUrlFromParam);
console.log('  - From localStorage:', apiUrlFromStorage);
console.log('  - Final choice:', apiBaseUrl);

// 设置全局配置
window._env_ = {
  REACT_APP_API_BASE_URL: apiBaseUrl,
  REACT_APP_ENVIRONMENT: 'production'
};

// 如果是通过URL参数设置的，保存到localStorage
if (apiUrlFromParam) {
  localStorage.setItem('CUSTOM_API_URL', apiUrlFromParam);
  console.log('💾 Saved API URL to localStorage:', apiUrlFromParam);
}

console.log('✅ Environment config loaded:', window._env_);
