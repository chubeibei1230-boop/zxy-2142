import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

function FeedbackModal({ open, onClose, onSave, booking, existingFeedback, user }) {
  const isEditing = !!existingFeedback;

  const [form, setForm] = useState({
    actual_attendance: 0,
    actual_staff: '',
    execution_result: 'completed',
    feedback_note: '',
    change_reason: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingFeedback) {
      setForm({
        actual_attendance: existingFeedback.actual_attendance || 0,
        actual_staff: existingFeedback.actual_staff || '',
        execution_result: existingFeedback.execution_result || 'completed',
        feedback_note: existingFeedback.feedback_note || '',
        change_reason: ''
      });
    } else {
      const staffNames = (booking?.staff_list || []).map(s => s.name).join('、');
      setForm({
        actual_attendance: booking?.visitor_count || 0,
        actual_staff: staffNames,
        execution_result: 'completed',
        feedback_note: '',
        change_reason: ''
      });
    }
    setError('');
    setLoading(false);
  }, [open, existingFeedback, booking]);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value
    }));
  };

  const resultOptions = [
    { value: 'completed', label: '✅ 已完成', desc: '预约正常完成' },
    { value: 'no_show', label: '❌ 未到场', desc: '预约方未到场' },
    { value: 'cancelled_temp', label: '⚠️ 临时取消', desc: '临时通知取消' },
    { value: 'abnormal', label: '🔶 异常结束', desc: '过程中出现异常' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isEditing && !form.change_reason?.trim()) {
      setError('修改反馈必须填写变更原因');
      return;
    }
    if (form.actual_attendance < 0) {
      setError('实际到场人数不能为负数');
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await api.updateBookingFeedback(booking.id, form);
      } else {
        await api.createBookingFeedback(booking.id, form);
      }
      onSave();
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEditing ? '修改执行反馈' : '提交执行反馈'} - {booking?.title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{
              padding: '12px 14px',
              background: '#f8fafc',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#6b7280',
              lineHeight: '1.7'
            }}>
              <div>📍 讲解点：<strong style={{ color: '#374151' }}>{booking?.venue_name}</strong></div>
              <div>⏰ 时间：<strong style={{ color: '#374151' }}>{booking?.date_start} {booking?.time_start} ~ {booking?.date_end} {booking?.time_end}</strong></div>
              <div>👥 预计人数：<strong style={{ color: '#374151' }}>{booking?.visitor_count} 人</strong></div>
              <div>🧑‍🏫 安排人员：<strong style={{ color: '#374151' }}>{(booking?.staff_list || []).map(s => s.name).join('、') || '未指派'}</strong></div>
            </div>

            <div className="form-group">
              <label>执行结果 *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {resultOptions.map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '12px',
                      border: form.execution_result === opt.value
                        ? '2px solid #3b82f6'
                        : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: form.execution_result === opt.value ? '#eff6ff' : 'white',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="execution_result"
                        value={opt.value}
                        checked={form.execution_result === opt.value}
                        onChange={handleChange}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>{opt.label}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '26px' }}>{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>实际到场人数</label>
                <input
                  type="number"
                  name="actual_attendance"
                  value={form.actual_attendance}
                  onChange={handleChange}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>实际讲解人员</label>
                <input
                  type="text"
                  name="actual_staff"
                  value={form.actual_staff}
                  onChange={handleChange}
                  placeholder="多人用顿号分隔"
                />
              </div>
            </div>

            <div className="form-group">
              <label>反馈备注</label>
              <textarea
                name="feedback_note"
                value={form.feedback_note}
                onChange={handleChange}
                rows="3"
                placeholder="可填写执行过程中的详细情况、特殊事件、改进建议等"
              ></textarea>
            </div>

            {(isEditing) && (
              <div className="form-group">
                <label>变更原因 *</label>
                <textarea
                  name="change_reason"
                  value={form.change_reason}
                  onChange={handleChange}
                  rows="2"
                  placeholder="请填写修改反馈的原因，用于审计追溯"
                  required
                ></textarea>
              </div>
            )}

            {existingFeedback && existingFeedback.version > 1 && (
              <div style={{
                padding: '10px 12px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#92400e',
                marginBottom: '12px'
              }}>
                📝 该反馈已修改 {existingFeedback.version - 1} 次，当前版本 v{existingFeedback.version}
              </div>
            )}

            {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '8px 20px' }} disabled={loading}>
              {loading ? '保存中...' : isEditing ? '保存修改' : '提交反馈'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FeedbackModal;
