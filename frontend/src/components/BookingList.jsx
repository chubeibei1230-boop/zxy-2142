import React, { useState } from 'react';
import { api } from '../api.js';

function BookingList({ bookings, daySummary, selectedDate, onEdit, onDelete, canEdit }) {
  const [expandedLog, setExpandedLog] = useState(null);
  const [changeLogs, setChangeLogs] = useState({});

  const showLogs = async (id) => {
    if (changeLogs[id]) {
      setExpandedLog(expandedLog === id ? null : id);
      return;
    }
    try {
      const logs = await api.getBookingChangeLogs(id);
      setChangeLogs(prev => ({ ...prev, [id]: logs }));
      setExpandedLog(id);
    } catch (e) { console.error(e); }
  };

  const statusLabel = {
    confirmed: { text: '已确认', cls: 'tag-confirmed' },
    adjusted: { text: '已调整', cls: 'tag-adjusted' },
    cancelled: { text: '已取消', cls: 'tag-cancelled' }
  };

  if (bookings.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <div>当日暂无预约</div>
      </div>
    );
  }

  return (
    <div>
      <div className="day-summary">
        <div className="summary-item">
          <span className="label">预约场次</span>
          <span className="value">{daySummary.total}</span>
        </div>
        <div className="summary-item">
          <span className="label">参观人数（起始日计）</span>
          <span className="value">{daySummary.visitors} 人</span>
        </div>
        {daySummary.crossDay > 0 && (
          <div className="summary-item">
            <span className="label">跨日任务</span>
            <span className="value">{daySummary.crossDay}</span>
          </div>
        )}
      </div>

      <div className="booking-list">
        {bookings.map(b => {
          const cardCls = [
            'booking-card',
            b.status === 'adjusted' ? 'adjusted' : '',
            b.status === 'cancelled' ? 'cancelled' : '',
            b.is_cross_day && b.is_start_day ? 'cross-start' : '',
            b.is_cross_day && !b.is_start_day ? 'cross-end' : ''
          ].filter(Boolean).join(' ');

          const staffNames = (b.staff_list || []).map(s => s.name).join('、') || '未指派';

          return (
            <div key={b.id} className={cardCls}>
              <div className="booking-header">
                <div className="booking-title">{b.title}</div>
                <div className="booking-tags">
                  {b.display_tag && <span className="tag tag-cross">{b.display_tag}</span>}
                  {statusLabel[b.status] && (
                    <span className={`tag ${statusLabel[b.status].cls}`}>{statusLabel[b.status].text}</span>
                  )}
                </div>
              </div>
              <div className="booking-meta">
                <div className="meta-item">
                  <span className="meta-label">讲解点：</span>
                  <span className="meta-value">{b.venue_name}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">人员：</span>
                  <span className="meta-value">{staffNames}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">时间：</span>
                  <span className="meta-value">
                    {b.date_start === b.date_end
                      ? `${b.time_start} - ${b.time_end}`
                      : `${b.date_start} ${b.time_start} ~ ${b.date_end} ${b.time_end}`}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">人数：</span>
                  <span className="meta-value">
                    {b.visitor_count} 人
                    {!b.count_towards_today && <span style={{ color: '#9ca3af', fontSize: '12px' }}>（已在起始日统计）</span>}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">创建人：</span>
                  <span className="meta-value">{b.creator_name}</span>
                </div>
              </div>
              {b.remark && <div className="booking-remark">📝 {b.remark}</div>}
              <div className="booking-actions">
                {canEdit && (
                  <>
                    <button className="btn-secondary btn-small" onClick={() => onEdit(b)}>编辑/调整</button>
                    <button className="btn-danger btn-small" onClick={() => onDelete(b.id)}>删除</button>
                  </>
                )}
                <button className="btn-secondary btn-small" onClick={() => showLogs(b.id)}>
                  {expandedLog === b.id ? '收起变更' : '变更记录'}
                </button>
              </div>

              {expandedLog === b.id && changeLogs[b.id] && (
                <div style={{ marginTop: '12px' }}>
                  {changeLogs[b.id].length === 0 ? (
                    <div style={{ fontSize: '13px', color: '#9ca3af' }}>暂无变更记录</div>
                  ) : (
                    changeLogs[b.id].map(log => (
                      <div key={log.id} className={`log-entry ${log.change_type}`}>
                        <div className="log-header">
                          <span className="log-type">
                            {log.change_type === 'create' ? '创建' :
                             log.change_type === 'update' ? '更新' :
                             log.change_type === 'adjust' ? '调整' :
                             log.change_type === 'delete' ? '删除' : log.change_type}
                          </span>
                          <span className="log-time">{log.created_at}</span>
                        </div>
                        <div className="log-operator">操作人：{log.operator_name}</div>
                        {log.change_reason && <div className="log-reason">原因：{log.change_reason}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BookingList;
