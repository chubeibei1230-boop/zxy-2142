import React, { useMemo } from 'react';

function Calendar({ currentMonth, setCurrentMonth, selectedDate, setSelectedDate, monthStats }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const statsMap = useMemo(() => {
    const m = {};
    monthStats.forEach(s => { m[s.date] = s; });
    return m;
  }, [monthStats]);

  const calendarCells = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    const cells = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const y = month === 1 ? year - 1 : year;
      const m = month === 1 ? 12 : month - 1;
      cells.push({
        day: d,
        date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        otherMonth: true
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        otherMonth: false
      });
    }
    while (cells.length < 42) {
      const idx = cells.length - (startWeekday + daysInMonth) + 1;
      const y = month === 12 ? year + 1 : year;
      const m = month === 12 ? 1 : month + 1;
      cells.push({
        day: idx,
        date: `${y}-${String(m).padStart(2, '0')}-${String(idx).padStart(2, '0')}`,
        otherMonth: true
      });
    }
    return cells;
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(m => m.month === 1 ? { year: m.year - 1, month: 12 } : { year: m.year, month: m.month - 1 });
  };
  const nextMonth = () => {
    setCurrentMonth(m => m.month === 12 ? { year: m.year + 1, month: 1 } : { year: m.year, month: m.month + 1 });
  };

  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const monthName = `${currentMonth.year}年${currentMonth.month}月`;

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button onClick={prevMonth}>‹ 上月</button>
        <span className="month-label">{monthName}</span>
        <button onClick={nextMonth}>下月 ›</button>
      </div>

      <div className="calendar-weekdays">
        {weekdays.map(w => <div key={w}>{w}</div>)}
      </div>

      <div className="calendar-grid">
        {calendarCells.map((cell, i) => {
          const stats = statsMap[cell.date];
          const isSelected = cell.date === selectedDate;
          const isToday = cell.date === todayStr;
          const cls = [
            'calendar-cell',
            cell.otherMonth ? 'other-month' : '',
            isToday ? 'today' : '',
            isSelected ? 'selected' : ''
          ].filter(Boolean).join(' ');

          return (
            <div
              key={i}
              className={cls}
              onClick={() => setSelectedDate(cell.date)}
              title={stats ? `${cell.date}：${stats.booking_count}场，${stats.total_visitors}人` : cell.date}
            >
              <span className="cell-day">{cell.day}</span>
              {stats && stats.booking_count > 0 && (
                <div className="cell-stats">
                  <span className="count-badge">{stats.booking_count}场</span>
                  <br />
                  {stats.total_visitors}人
                  {stats.cross_day_count > 0 && <><br />跨{stats.cross_day_count}</>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="legend">
        <div className="legend-item"><span className="legend-dot" style={{ background: '#dbeafe' }}></span>今天</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#3b82f6' }}></span>已选日期</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: '#e0e7ff' }}></span>预约数</div>
      </div>
    </div>
  );
}

export default Calendar;
