import React, { useState, useEffect } from 'react';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';
import Audit from './pages/Audit.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch (e) { localStorage.removeItem('user'); }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const tabs = [
    { key: 'dashboard', label: '日程预约' },
    { key: 'admin', label: '管理维护', roles: ['admin'] },
    { key: 'audit', label: '审计日志', roles: ['admin', 'auditor'] }
  ];

  const visibleTabs = tabs.filter(t => !t.roles || t.roles.includes(user.role));
  if (!visibleTabs.find(t => t.key === activeTab)) {
    setActiveTab(visibleTabs[0]?.key || 'dashboard');
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>📢 讲解预约管理系统</h1>
        <div className="header-right">
          <span className="user-info">
            {user.full_name}（{user.role === 'admin' ? '管理员' : user.role === 'auditor' ? '审计员' : '普通用户'}）
          </span>
          <button onClick={handleLogout}>退出登录</button>
        </div>
      </header>

      {visibleTabs.length > 1 && (
        <nav className="nav-tabs">
          {visibleTabs.map(tab => (
            <div
              key={tab.key}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </div>
          ))}
        </nav>
      )}

      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard user={user} />}
        {activeTab === 'admin' && user.role === 'admin' && <Admin />}
        {activeTab === 'audit' && ['admin', 'auditor'].includes(user.role) && <Audit user={user} />}
      </main>
    </div>
  );
}

export default App;
