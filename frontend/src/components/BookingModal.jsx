import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

function BookingModal({ open, onClose, onSave, editingBooking, venues, staff, timeSlots, defaultDate }) {
  const [form, setForm] = useState({
    title: '',
    venue_id: '',
    date_start: defaultDate,
    date_end: defaultDate,
    time_start: '09:00',
    time_end: '11:30',
    visitor_count: 0,
    remark: '',
    status: 'confirmed',
    staff_ids: [],
    change_reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingBooking) {
      setForm({
        title: editingBooking.title || '',
        venue_id: editingBooking.venue_id || '',
        date_start: editingBooking.date_start || defaultDate,
        date_end: editingBooking.date_end || defaultDate,
        time_start: editingBooking.time_start || '09:00',
        time_end: editingBooking.time_end || '11:30',
        visitor_count: editingBooking.visitor_count || 0,
        remark: editingBooking.remark || '',
        status: editingBooking.status || 'confirmed',
        staff_ids: (editingBooking.staff_list || []).map(s => s.id),
        change_reason: ''
      });
    } else {
      setForm({
        title: '',
        venue_id: venues[0]?.id || '',
        date_start: defaultDate,
        date_end: defaultDate,
        time_start: timeSlots[0]?.start_time || '09:00',
        time_end: timeSlots[0]?.end_time || '11:30',
        visitor_count: 0,
        remark: '',
        status: 'confirmed',
        staff_ids: [],
        change_reason: ''
      });
    }
    setError('');
  }, [editingBooking, defaultDate, open]);

  if (!open) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'staff_ids') {
        const id = parseInt(e.target.value, 10);
        setForm(f => ({
          ...f,
          staff_ids: checked
            ? [...f.staff_ids, id]
            : f.staff_ids.filter(s => s !== id)
        }));
      }
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        venue_id: parseInt(form.venue_id, 10),
        visitor_count: parseInt(form.visitor_count, 10) || 0
      };
      if (editingBooking) {
        await api.updateBooking(editingBooking.id, payload);
      } else {
        await api.createBooking(payload);
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
          <h3>{editingBooking ? '编辑 / 调整预约' : '新建预约'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>预约标题 *</label>
              <input name="title" value={form.title} onChange={handleChange} required placeholder="如：XX 公司参观讲解" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>讲解点 *</label>
                <select name="venue_id" value={form.venue_id} onChange={handleChange} required>
                  <option value="">请选择</option>
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>参观人数</label>
                <input type="number" name="visitor_count" value={form.visitor_count} onChange={handleChange} min="0" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>开始日期 *</label>
                <input type="date" name="date_start" value={form.date_start} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>结束日期 *</label>
                <input type="date" name="date_end" value={form.date_end} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>开始时间 *</label>
                <input type="time" name="time_start" value={form.time_start} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>结束时间 *</label>
                <input type="time" name="time_end" value={form.time_end} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label>讲解人员</label>
              <div className="checkbox-group">
                {staff.map(s => (
                  <label key={s.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      name="staff_ids"
                      value={s.id}
                      checked={form.staff_ids.includes(s.id)}
                      onChange={handleChange}
                    />
                    {s.name}（{s.title || '讲解员'}）
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>状态</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="confirmed">已确认</option>
                  <option value="adjusted">已调整</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>备注</label>
              <textarea name="remark" value={form.remark} onChange={handleChange} rows="2" placeholder="可选备注信息"></textarea>
            </div>

            {editingBooking && (
              <div className="form-group">
                <label>调整原因 *</label>
                <textarea name="change_reason" value={form.change_reason} onChange={handleChange} rows="2" placeholder="请填写调整或修改的原因，用于审计记录" required></textarea>
              </div>
            )}

            {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '8px 20px' }} disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BookingModal;
