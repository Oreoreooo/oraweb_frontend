import React, { useState, useEffect } from 'react';
import './Layout.css';
import { isAuthenticated, getUserInfo, clearAuth } from '../utils/auth';

const Layout = ({ children }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        // 检查本地存储中的用户信息
        if (isAuthenticated()) {
            const userData = getUserInfo();
            if (userData) {
                setUser(userData);
            }
        }
    }, []);

    const handleLogout = () => {
        clearAuth();
        setUser(null);
        // 跳转到首页
        window.location.href = '/';
    };

    const handleLogin = () => {
        window.location.href = '/login';
    };

    const handleRegister = () => {
        window.location.href = '/register';
    };

    return (
        <div className="layout">
            {/* 顶部导航条 */}
            <header className="navbar">
                <div className="navbar-container">
                    {/* Logo / 产品名称 */}
                    <div className="navbar-brand">
                        <h1>Ora</h1>
                    </div>

                    {/* 导航菜单 */}
                    <nav className="navbar-nav">
                        <ul className="nav-list">
                            <li className="nav-item">
                                <a href="/" className="nav-link">Home</a>
                            </li>
                            <li className="nav-item">
                                <a href="/memories" className="nav-link">Memories</a>
                            </li>
                            <li className="nav-item">
                                <a href="/diary" className="nav-link">My Diary</a>
                            </li>
                            <li className="nav-item">
                                <a href="/community" className="nav-link">Community</a>
                            </li>
                        </ul>
                    </nav>

                    {/* 用户认证区域 */}
                    <div className="navbar-auth">
                        {user ? (
                            <div className="user-menu">
                                <span className="welcome-text">Hi, {user.name || user.username}</span>
                                <button 
                                    className="logout-btn"
                                    onClick={handleLogout}
                                >
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <div className="auth-buttons">
                                <button 
                                    className="login-btn"
                                    onClick={handleLogin}
                                >
                                    Login
                                </button>
                                <button 
                                    className="register-btn"
                                    onClick={handleRegister}
                                >
                                    Sign Up
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* 主要内容区域 */}
            <main className="main-content">
                {children}
            </main>

            {/* 页脚 */}
            {/* <footer className="footer">
                <div className="footer-container">
                    <p>&copy; 2025 Ora. All rights reserved.</p>
                </div>
            </footer> */}
        </div>
    );
};

export default Layout;
