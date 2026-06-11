import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api.js';
import Calendar from '../components/Calendar.jsx';
import BookingList from '../components/BookingList.jsx';
import BookingModal from '../components/BookingModal.jsx';
import FeedbackModal from '../components/FeedbackModal.jsx';

function Dashboard({ user }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const [selectedDate, setSelectedDate] = useState(formatDate(today));
  const [monthStats, setMonthStats] = useState([]);
  const [dayBookings, setDayBookings] = useState([]);
  const [venues, setVenues] = useState([]);
  const [staff, setStaff] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [feedbackBooking, setFeedbackBooking] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [execFilter, setExecFilter] = useState('all');
  const [reminders, setReminders] = useState([]);
  const [showReminderPanel, setShowReminderPanel] = useState(false);
  const [toast, setToast] = useState(null);

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  useEffect(() => {
    (async () => {
      try {
        const [v, s, ts] = await Promise.all([api.listVenues(), api.listStaff(), api.listTimeSlots()]);
        setVenues(v);
        setStaff(s);
        setTimeSlots(ts);
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stats = await api.getMonthlyStats(currentMonth.year, currentMonth.month);
        setMonthStats(stats);
      } catch (e) { console.error(e); }
    })();
  }, [currentMonth, refreshKey]);

  useEffect(() => {
    (async () => {
      try {
        const bookings = await api.getBookingsByDate(selectedDate);
        setDayBookings(bookings);
      } catch (e) { console.error(e); }
    })();
  }, [selectedDate, refreshKey]);

  useEffect(() => {
    const loadReminders = async () => {
      try {
        const data = await api.getUpcomingReminders(3);
        setReminders(data);
        const needFeedback = data.filter(r => r.reminder_type === 'need_feedback');
        const urgent = data.filter(r => r.reminder_type === 'urgent');
        const ongoing = data.filter(r => r.reminder_type === 'ongoing');
        if (needFeedback.length > 0 || urgent.length > 0 || ongoing.length > 0) {
          let msg = '';
          if (urgent.length > 0) msg = `🔔 ${urgent.length} 场预约即将开始！`;
          else if (ongoing.length > 0) msg = `▶️ ${ongoing.length} 场正在进行中`;
          else if (needFeedback.length > 0) msg = `⏰ ${needFeedback.length} 场预约等待反馈`;
          if (msg) {
            setToast({ message: msg, type: needFeedback.length > 0 ? 'warning' : 'info' });
            setTimeout(() => setToast(null), 4000);
          }
        }
      } catch (e) { console.error(e); }
    };
    loadReminders();
    const interval = setInterval(loadReminders, 60000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const filteredBookings = useMemo(() => {
    if (execFilter === 'all') return dayBookings;
    return dayBookings.filter(b => (b.execution_status || 'pending') === execFilter);
  }, [dayBookings, execFilter]);

  const daySummary = useMemo(() => {
    const total = filteredBookings.length;
    const visitors = filteredBookings.reduce((sum, b) => sum + (b.count_towards_today ? (b.visitor_count || 0) : 0), 0);
    const crossDay = filteredBookings.filter(b => b.is_cross_day).length;
    const needFeedback = filteredBookings.filter(b => {
      const today = new Date();
      const todayStr = formatDate(today);
      const isPassed = b.date_end < todayStr || (b.date_end === todayStr);
      const execStatus = b.execution_status || 'pending';
      return isPassed && !b.has_feedback && b.status !== 'cancelled' && ['pending', 'ongoing'].includes(execStatus);
    }).length;
    return { total, visitors, crossDay, needFeedback };
  }, [filteredBookings]);

  const canEdit = user.role !== 'auditor';
  const canFeedback = (booking) => {
    if (user.role === 'auditor') return false;
    if (user.role === 'admin') return true;
    return booking.created_by === user.id;
  };
  const isBookingEnded = (b) => {
    const now = new Date();
    const endStr = `${b.date_end}T${b.time_end}:00`;
    const endTime = new Date(endStr);
    if (isNaN(endTime.getTime())) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      return b.date_end < todayStr || (b.date_end === todayStr);
    }
    return now >= endTime;
  };

  const openCreate = () => {
    setEditingBooking(null);
    setModalOpen(true);
  };

  const openEdit = (booking) => {
    setEditingBooking(booking);
    setModalOpen(true);
  };

  const openFeedback = (booking) => {
    setFeedbackBooking(booking);
    setFeedbackModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除此预约吗？')) return;
    try {
      await api.deleteBooking(id);
      setRefreshKey(k => k + 1);
    } catch (e) { alert(e.message); }
  };

  const handleSave = () => {
    setModalOpen(false);
    setRefreshKey(k => k + 1);
  };

  const handleFeedbackSave = () => {
    setFeedbackModalOpen(false);
    setRefreshKey(k => k + 1);
    setToast({ message: '✅ 反馈保存成功', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const execFilterOptions = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待开始' },
    { value: 'ongoing', label: '进行中' },
    { value: 'completed', label: '已完成' },
    { value: 'no_show', label: '未到场' },
    { value: 'cancelled_temp', label: '临时取消' },
    { value: 'abnormal', label: '异常结束' }
  ];

  const reminderTypeLabels = {
    urgent: { text: '紧急', cls: 'reminder-urgent' },
    today: { text: '今日', cls: 'reminder-today' },
    ongoing: { text: '进行中', cls: 'reminder-ongoing' },
    upcoming: { text: '即将到来', cls: 'reminder-upcoming' },
    need_feedback: { text: '待反馈', cls: 'reminder-need-feedback' }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>执行状态筛选：</span>
          {execFilterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setExecFilter(opt.value)}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                border: execFilter === opt.value ? '1px solid #3b82f6' : '1px solid #d1d5db',
                borderRadius: '16px',
                background: execFilter === opt.value ? '#3b82f6' : 'white',
                color: execFilter === opt.value ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div
          className="reminder-trigger"
          onClick={() => setShowReminderPanel(!showReminderPanel)}
          style={{
            background: reminders.length > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' : 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          🔔 提醒
          {reminders.length > 0 && (
            <span className="reminder-badge" style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#ef4444',
              color: 'white',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              fontWeight: 600,
              minWidth: '18px',
              textAlign: 'center',
              animation: 'badge-pulse 1.5s ease-in-out infinite'
            }}>
              {reminders.length}
            </span>
          )}
        </div>
      </div>

      {showReminderPanel && (
        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-header">
            <h3>🔔 日程提醒</h3>
            <button className="btn-secondary btn-small" onClick={() => setShowReminderPanel(false)}>收起</button>
          </div>
          <div className="panel-body">
            {reminders.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🎉</div><div>近期无提醒事项</div></div>
            ) : (
              <div className="reminder-list">
                {reminders.map(r => {
                  const rtype = reminderTypeLabels[r.reminder_type] || { text: '提醒', cls: '' };
                  return (
                    <div key={r.id} className={`reminder-item ${rtype.cls}`}>
                      <div className="reminder-item-header">
                        <div>
                          <span className={`tag tag-reminder-${r.reminder_type}`} style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: 500,
                            marginRight: '8px',
                            ...(r.reminder_type === 'urgent' ? { background: '#fee2e2', color: '#991b1b' } : {}),
                            ...(r.reminder_type === 'today' ? { background: '#fef3c7', color: '#92400e' } : {}),
                            ...(r.reminder_type === 'ongoing' ? { background: '#d1fae5', color: '#065f46' } : {}),
                            ...(r.reminder_type === 'upcoming' ? { background: '#dbeafe', color: '#1e40af' } : {}),
                            ...(r.reminder_type === 'need_feedback' ? { background: '#fde68a', color: '#92400e' } : {})
                          }}>{rtype.text}</span>
                          <span className="reminder-item-title">{r.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {r.reminder_type === 'need_feedback' && canFeedback(r) && (
                            <button className="btn-primary btn-small" onClick={() => {
                              setSelectedDate(r.date_start);
                              setShowReminderPanel(false);
                              setFeedbackBooking(r);
                              setFeedbackModalOpen(true);
                            }}>去反馈</button>
                          )}
                        </div>
                      </div>
                      <div className="reminder-item-meta">
                        <span>📍 {r.venue_name}</span>
                        <span>⏰ {r.date_start} {r.time_start} ~ {r.date_end} {r.time_end}</span>
                        <span>👥 {r.visitor_count} 人</span>
                        <span>🧑‍🏫 {(r.staff_list || []).map(s => s.name).join('、') || '未指派'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="dashboard">
        <div className="panel">
          <div className="panel-header">
            <h3>📅 日历视图</h3>
          </div>
          <div className="panel-body">
            <Calendar
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              monthStats={monthStats}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>📋 {selectedDate} 预约列表 {execFilter !== 'all' && `（筛选中）`}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {canEdit && <button className="btn-primary btn-small" onClick={openCreate} style={{ width: 'auto', padding: '7px 14px' }}>+ 新建预约</button>}
            </div>
          </div>
          <div className="panel-body">
            <BookingList
              bookings={filteredBookings}
              daySummary={daySummary}
              selectedDate={selectedDate}
              onEdit={openEdit}
              onDelete={handleDelete}
              canEdit={canEdit}
              canFeedback={canFeedback}
              isBookingEnded={isBookingEnded}
              onOpenFeedback={openFeedback}
              refreshKey={refreshKey}
            />
          </div>
        </div>
      </div>

      {modalOpen && (
        <BookingModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          editingBooking={editingBooking}
          venues={venues}
          staff={staff}
          timeSlots={timeSlots}
          defaultDate={selectedDate}
          user={user}
        />
      )}

      {feedbackModalOpen && (
        <FeedbackModal
          open={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          onSave={handleFeedbackSave}
          booking={feedbackBooking}
          existingFeedback={feedbackBooking?.has_feedback ? feedbackBooking.feedback : null}
          user={user}
        />
      )}

      {toast && (
        <div className="reminder-toast">
          <div className="reminder-toast-content" style={{
            background: toast.type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                        toast.type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' :
                        'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
          }}>
            <span className="reminder-toast-icon">
              {toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⏰' : '🔔'}
            </span>
            <span>{toast.message}</span>
            <button className="reminder-toast-close" onClick={() => setToast(null)}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
