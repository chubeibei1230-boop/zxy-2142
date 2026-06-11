import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api.js';
import Calendar from '../components/Calendar.jsx';
import BookingList from '../components/BookingList.jsx';
import BookingModal from '../components/BookingModal.jsx';

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
  const [editingBooking, setEditingBooking] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const daySummary = useMemo(() => {
    const total = dayBookings.length;
    const visitors = dayBookings.reduce((sum, b) => sum + (b.count_towards_today ? (b.visitor_count || 0) : 0), 0);
    const crossDay = dayBookings.filter(b => b.is_cross_day).length;
    return { total, visitors, crossDay };
  }, [dayBookings]);

  const canEdit = user.role !== 'auditor';

  const openCreate = () => {
    setEditingBooking(null);
    setModalOpen(true);
  };

  const openEdit = (booking) => {
    setEditingBooking(booking);
    setModalOpen(true);
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

  return (
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
          <h3>📋 {selectedDate} 预约列表</h3>
          {canEdit && <button className="btn-primary btn-small" onClick={openCreate} style={{ width: 'auto', padding: '7px 14px' }}>+ 新建预约</button>}
        </div>
        <div className="panel-body">
          <BookingList
            bookings={dayBookings}
            daySummary={daySummary}
            selectedDate={selectedDate}
            onEdit={openEdit}
            onDelete={handleDelete}
            canEdit={canEdit}
            refreshKey={refreshKey}
          />
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
        />
      )}
    </div>
  );
}

export default Dashboard;
