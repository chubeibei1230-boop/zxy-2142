import React, { useState } from 'react';
import { api } from '../api.js';

function BookingList({ bookings, daySummary, selectedDate, onEdit, onDelete, canEdit, canFeedback, onOpenFeedback, refreshKey }) {
  const [expandedLog, setExpandedLog] = useState(null);
  const [changeLogs, setChangeLogs] = useState({});
  const [expandedFeedback, setExpandedFeedback] = useState(null);
  const [feedbackHistory, setFeedbackHistory] = useState({});

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

  const showFeedbackHistory = async (id) => {
    if (feedbackHistory[id]) {
      setExpandedFeedback(expandedFeedback === id ? null : id);
      return;
    }
    try {
      const fbs = await api.getBookingFeedbacks(id);
      setFeedbackHistory(prev => ({ ...prev, [id]: fbs }));
      setExpandedFeedback(id);
    } catch (e) { console.error(e); }
  };

  const statusLabel = {
    confirmed: { text: '已确认', cls: 'tag-confirmed' },
    adjusted: { text: '已调整', cls: 'tag-adjusted' },
    cancelled: { text: '已取消', cls: '已取消' }
  };

  const executionStatusLabel = {
    pending: { text: '待开始', cls: 'tag-exec-pending' },
    ongoing: { text: '进行中', cls: 'tag-exec-ongoing' },
    completed: { text: '已完成', cls: 'tag-exec-completed' },
    no_show: { text: '未到场', cls: 'tag-exec-noshow' },
    cancelled_temp: { text: '临时取消', cls: 'tag-exec-cancelled' },
    abnormal: { text: '异常结束', cls: 'tag-exec-abnormal' }
  };

  const isDatePassed = (b) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return b.date_end < todayStr || (b.date_end === todayStr);
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
        {daySummary.needFeedback > 0 && (
          <div className="summary-item" style={{ color: "#f59e0b" }}>
          <span className="label">待反馈</span>
          <span className="value">{daySummary.needFeedback} 场</span>
        </div>
        )}
      </div>

      <div className="booking-list">
        {bookings.map(b => {
        const execStatus = b.execution_status || 'pending';
        const needsFeedback = !b.has_feedback && isDatePassed(b) && b.status !== 'cancelled' && ['pending', 'ongoing'].includes(execStatus);
        const cardCls = [
          'booking-card',
          b.status === 'adjusted' ? 'adjusted' : '',
          b.status === 'cancelled' ? 'cancelled' : '',
          b.is_cross_day && b.is_start_day ? 'cross-start' : '',
          b.is_cross_day && !b.is_start_day ? 'cross-end' : '',
          b.has_conflict ? 'has-conflict' : '',
          needsFeedback ? 'needs-feedback' : '',
          execStatus === 'ongoing' ? 'exec-ongoing' : '',
          execStatus === 'completed' || execStatus === 'no_show' || execStatus === 'cancelled_temp' || execStatus === 'abnormal' ? 'exec-done' : ''
        ].filter(Boolean).join(' ');

        const staffNames = (b.staff_list || []).map(s => s.name).join('、') || '未指派';

        return (
          <div key={b.id} className={cardCls}>
            <div className="booking-header">
              <div className="booking-title">{b.title}</div>
              <div className="booking-tags">
                {needsFeedback && <span className="tag tag-need-feedback" style={{ background: "#fef3c7", color: "#92400e", animation: "badge-pulse 1.5s ease-in-out infinite" }}>⏰ 待反馈</span>}
                {b.has_conflict && <span className="tag tag-conflict">⚠️ 冲突</span>}
                {b.display_tag && <span className="tag tag-cross">{b.display_tag}</span>}
                {statusLabel[b.status] && (
                  <span className={`tag ${statusLabel[b.status].cls}`}>{statusLabel[b.status].text}</span>
                )}
                {executionStatusLabel[execStatus] && (
                  <span className={`tag ${executionStatusLabel[execStatus].cls}`}>
                    {executionStatusLabel[execStatus].text}
                  </span>
                )}
              </div>
            </div>
            {b.has_conflict && (b.conflicts || []).length > 0 && (
              <div className="conflict-warning-bar">
                <div className="conflict-warning-title">⚠️ 资源冲突详情：</div>
                {(b.conflicts || []).map((c, i) => (
                  <div key={i} className="conflict-warning-item">
                    <span className={`conflict-type-tag tag-${c.conflict_type}`}>
                      {c.conflict_type === 'venue' ? '讲解点冲突' : '讲解员冲突'}
                    </span>
                    <span>预约「{c.booking_title}」</span>
                    <span>📍 {c.venue_name}</span>
                    <span>⏰ {c.date_start === c.date_end ? `${c.date_start} ${c.time_start}-${c.time_end}` : `${c.date_start} ${c.time_start} ~ ${c.date_end} ${c.time_end}`}</span>
                    {c.conflict_type === 'staff' && c.staff_name && <span>🧑‍🏫 {c.staff_name}</span>}
                  </div>
                ))}
              </div>
            )}
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

            {b.feedback && (
              <div className="feedback-summary-bar">
                <div className="feedback-summary-title">📋 执行反馈</div>
                <div className="feedback-summary-grid">
                  <div><span style={{color:'#6b7280'}}>执行结果：</span><strong>{executionStatusLabel[b.feedback.execution_result]?.text || b.feedback.execution_result}</strong></div>
                  <div><span style={{color:'#6b7280'}}>实际到场：</span>{b.feedback.actual_attendance} 人</div>
                  <div><span style={{color:'#6b7280'}}>实际人员：</span>{b.feedback.actual_staff || '-'}</div>
                  <div><span style={{color:'#6b7280'}}>提交人：</span>{b.feedback.creator_name}</div>
                </div>
                {b.feedback.feedback_note && <div style={{ marginTop: '6px', fontSize: '13px' }}><span style={{ color: '#6b7280' }}>备注：</span>{b.feedback.feedback_note}</div>}
                {b.feedback.version > 1 && <div style={{ marginTop: '4px', fontSize: '12px', color: '#9ca3af' }}>v{b.feedback.version} · 最后修改：{b.feedback.updater_name || b.feedback.creator_name} @ {b.feedback.updated_at || b.feedback.created_at}</div>}
              </div>
            )}

            {b.remark && <div className="booking-remark">📝 {b.remark}</div>}

            <div className="booking-actions">
              {canEdit && (
                <>
                  <button className="btn-secondary btn-small" onClick={() => onEdit(b)}>编辑/调整</button>
                  <button className="btn-danger btn-small" onClick={() => onDelete(b.id)}>删除</button>
                </>
              )}
              {canFeedback && isDatePassed(b) && b.status !== 'cancelled' && (
                <button
                  className={b.has_feedback ? 'btn-secondary btn-small' : 'btn-primary btn-small'}
                  onClick={() => onOpenFeedback(b)}
                >
                  {b.has_feedback ? '修改反馈' : '提交反馈'}
                </button>
              )}
              <button className="btn-secondary btn-small" onClick={() => showLogs(b.id)}>
                {expandedLog === b.id ? '收起变更' : '变更记录'}
              </button>
              {b.has_feedback && (
                <button className="btn-secondary btn-small" onClick={() => showFeedbackHistory(b.id)}>
                  {expandedFeedback === b.id ? '收起反馈' : '反馈记录'}
                </button>
              )}
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
                           log.change_type === 'delete' ? '删除' :
                           log.change_type === 'feedback_create' ? '提交反馈' :
                           log.change_type === 'feedback_update' ? '修改反馈' : log.change_type}
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

            {expandedFeedback === b.id && feedbackHistory[b.id] && (
              <div style={{ marginTop: '12px' }}>
                {feedbackHistory[b.id].length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#9ca3af' }}>暂无反馈记录</div>
                ) : (
                  feedbackHistory[b.id].map((fb, idx) => (
                    <div key={fb.id || idx} className="log-entry feedback-history">
                      <div className="log-header">
                        <span className="log-type">v{fb.version} - {executionStatusLabel[fb.execution_result]?.text || fb.execution_result}</span>
                        <span className="log-time">{fb.updated_at || fb.created_at}</span>
                      </div>
                      <div className="log-operator">提交人：{fb.creator_name}{fb.updater_name && fb.updater_name !== fb.creator_name && ` → 修改：${fb.updater_name}`}</div>
                      <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '6px' }}>
                        实际到场 {fb.actual_attendance} 人 · 人员：{fb.actual_staff || '-'}
                      </div>
                      {fb.feedback_note && <div className="log-reason">备注：{fb.feedback_note}</div>}
                      {fb.change_reason && <div className="log-reason">变更原因：{fb.change_reason}</div>}
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
