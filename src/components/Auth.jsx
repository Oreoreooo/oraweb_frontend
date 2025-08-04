import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Auth.css';

const Auth = ({ mode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    captcha: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaSent, setCaptchaSent] = useState(false);

  // 根据mode参数设置初始状态
  useEffect(() => {
    setIsLogin(mode === 'login');
  }, [mode]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSendCaptcha = async () => {
    if (!formData.email) {
      setError('Please enter your email first');
      return;
    }
    
    try {
      setLoading(true);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/auth/captcha/email?email=${formData.email}`);
      if (response.data.code === 200) {
        setCaptchaSent(true);
        setError('');
        alert('Verification code sent to your email!');
      }
    } catch (err) {
      setError('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let response;
      
      if (isLogin) {
        // Login request
        response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
          email: formData.email,
          password: formData.password
        });
      } else {
        // Register request
        response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
          email: formData.email,
          password: formData.password,
          username: formData.username,
          captcha: formData.captcha
        });
      }

      if (response.data.success) {
        if (isLogin) {
          // Store token and user info
          localStorage.setItem('access_token', response.data.token || response.data.access_token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          // 登录成功后跳转到首页或之前的页面
          window.location.href = '/';
        } else {
          // Registration successful, store tokens and redirect
          localStorage.setItem('access_token', response.data.access_token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          // 注册成功后跳转到首页
          window.location.href = '/';
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleInputChange}
                required
              />
            </div>
          )}

          <div className="form-group">
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleInputChange}
              required
            />
          </div>

          {!isLogin && (
            <>
              <div className="form-group captcha-group">
                <input
                  type="text"
                  name="captcha"
                  placeholder="Verification Code"
                  value={formData.captcha}
                  onChange={handleInputChange}
                  required
                />
                <button 
                  type="button" 
                  onClick={handleSendCaptcha}
                  disabled={loading || !formData.email}
                  className="captcha-btn"
                >
                  {captchaSent ? 'Resend' : 'Send Code'}
                </button>
              </div>
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="auth-switch">
          <span>
            {isLogin ? "Haven't an account? " : "Already have an account? "}
            <a 
              href={isLogin ? '/register' : '/login'}
              className="switch-btn"
            >
              {isLogin ? 'Register' : 'Login'}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;
