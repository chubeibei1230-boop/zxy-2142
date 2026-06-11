import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admin from './pages/Admin.jsx';
import Audit from './pages/Audit.jsx';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reminders, setReminders] = useState([]);
  const [showReminders, setShowReminders] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch (e) { localStorage.removeItem('user'); }
    }
  }, []);

  const loadReminders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getUpcomingReminders(3);
      setReminders(data);
      const urgent = data.filter(r => r.reminder_type === 'urgent');
      if (urgent.length > 0 && toastMsg === null) {
        setToastMsg(`⚠️ 有 ${urgent.length} 场预约即将在 2 小时内开始！`);
        setTimeout(() => setToastMsg(null), 5000);
      }
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadReminders();
      const interval = setInterval(loadReminders, 60000);
      return () => clearInterval(interval);
    }
  }, [user, loadReminders]);

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

  const urgentCount = reminders.filter(r => r.reminder_type === 'urgent').length;

  const reminderTypeLabel = {
    urgent: { text: '即将开始', cls: 'tag tag-reminder-urgent' },
    today: { text: '今日', cls: 'tag tag-reminder-today' },
    ongoing: { text: '进行中', cls: 'tag tag-reminder-ongoing' },
    upcoming: { text: '近期', cls: 'tag tag-reminder-upcoming' }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>📢 讲解预约管理系统</h1>
        <div className="header-right">
          <div className="reminder-trigger" onClick={() => setShowReminders(true)}>
            🔔 日程提醒
            {urgentCount > 0 && <span className="reminder-badge">{urgentCount}</span>}
          </div>
          <span className="user-info">
            {user.full_name}（{user.role === 'admin' ? '管理员' : user.role === 'auditor' ? '审计员' : '普通用户'}）
          </span>
          <button onClick={handleLogout}>退出登录</button>
        </div>
      </header>

      {toastMsg && (
        <div className="reminder-toast">
          <div className="reminder-toast-content">
            <span className="reminder-toast-icon">⚠️</span>
            <span>{toastMsg}</span>
            <button className="reminder-toast-close" onClick={() => setToastMsg(null)}>×</button>
          </div>
        </div>
      )}

      {showReminders && (
        <div className="modal-overlay" onClick={() => setShowReminders(false)}>
          <div className="modal reminder-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔔 日程提醒（未来 3 天）</h3>
              <button className="modal-close" onClick={() => setShowReminders(false)}>×</button>
            </div>
            <div className="modal-body">
              {reminders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✨</div>
                  <div>暂无即将开始的预约</div>
                </div>
              ) : (
                <div className="reminder-list">
                  {reminders.map(r => (
                    <div key={r.id} className={`reminder-item reminder-${r.reminder_type}`}>
                      <div className="reminder-item-header">
                        <span className="reminder-item-title">{r.title}</span>
                        <span className={reminderTypeLabel[r.reminder_type]?.cls}>
                          {reminderTypeLabel[r.reminder_type]?.text}
                        </span>
                      </div>
                      <div className="reminder-item-meta">
                        <span>📍 {r.venue_name}</span>
                        <span>👥 {r.visitor_count} 人</span>
                        <span>⏰ {r.date_start === r.date_end ? '' : r.date_start + ' '}{r.time_start} ~ {r.date_end !== r.date_start ? r.date_end + ' ' : ''}{r.time_end}</span>
                      </div>
                      {(r.staff_list || []).length > 0 && (
                        <div className="reminder-item-meta" style={{ marginTop: '4px' }}>
                          <span>🧑‍🏫 {(r.staff_list || []).map(s => s.name).join('、')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowReminders(false)}>关闭</button>
              <button className="btn-primary" style={{ width: 'auto', padding: '8px 20px' }} onClick={() => { setShowReminders(false); loadReminders(); }}>刷新</button>
            </div>
          </div>
        </div>
      )}

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
