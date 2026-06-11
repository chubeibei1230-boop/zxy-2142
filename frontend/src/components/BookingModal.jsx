import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api.js';

function BookingModal({ open, onClose, onSave, editingBooking, venues, staff, timeSlots, defaultDate, user }) {
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
  const [conflicts, setConflicts] = useState([]);
  const [liveConflicts, setLiveConflicts] = useState([]);
  const [liveChecking, setLiveChecking] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [forceSaveChecked, setForceSaveChecked] = useState(false);
  const checkTimerRef = useRef(null);

  const isAdmin = user?.role === 'admin';

  const runLiveCheck = useCallback(async () => {
    if (!form.venue_id || !form.date_start || !form.date_end || !form.time_start || !form.time_end) {
      setLiveConflicts([]);
      return;
    }
    setLiveChecking(true);
    try {
      const result = await api.checkConflict({
        venue_id: parseInt(form.venue_id, 10),
        date_start: form.date_start,
        date_end: form.date_end,
        time_start: form.time_start,
        time_end: form.time_end,
        staff_ids: form.staff_ids,
        exclude_booking_id: editingBooking?.id || null
      });
      setLiveConflicts(result.conflicts || []);
    } catch (e) {
      // ignore live check errors
    } finally {
      setLiveChecking(false);
    }
  }, [form.venue_id, form.date_start, form.date_end, form.time_start, form.time_end, JSON.stringify(form.staff_ids), editingBooking?.id]);

  useEffect(() => {
    if (!open) return;
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(() => {
      runLiveCheck();
    }, 300);
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [open, runLiveCheck]);

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
    setConflicts([]);
    setLiveConflicts([]);
    setShowConflictDialog(false);
    setPendingPayload(null);
    setForceSaveChecked(false);
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
      } else if (name === 'force_save') {
        setForceSaveChecked(checked);
      }
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const validateForm = () => {
    if (!form.title?.trim()) return '请填写预约标题';
    if (!form.venue_id) return '请选择讲解点';
    if (!form.date_start || !form.date_end) return '请选择日期';
    const ds = new Date(form.date_start);
    const de = new Date(form.date_end);
    if (de < ds) return '结束日期不能早于开始日期';
    if (form.date_start === form.date_end) {
      if (!form.time_start || !form.time_end) return '请选择时间';
      const [sh, sm] = form.time_start.split(':').map(Number);
      const [eh, em] = form.time_end.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (endMinutes <= startMinutes) return '同一天的结束时间必须晚于开始时间';
    }
    if ((editingBooking || forceSaveChecked) && !form.change_reason?.trim()) {
      return forceSaveChecked ? '强制保存必须填写调整/覆盖原因' : '请填写调整原因';
    }
    return null;
  };

  const doSave = async (payload, forceSave = false) => {
    try {
      const savePayload = { ...payload, force_save: forceSave };
      if (editingBooking) {
        await api.updateBooking(editingBooking.id, savePayload);
      } else {
        await api.createBooking(savePayload);
      }
      onSave();
    } catch (err) {
      if (err.message && typeof err.message === 'object' && err.message.conflicts) {
        setConflicts(err.message.conflicts);
        setPendingPayload(payload);
        setShowConflictDialog(true);
        setError(err.message.message || '存在资源冲突');
      } else {
        setError(err.message || '保存失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    const payload = {
      ...form,
      venue_id: parseInt(form.venue_id, 10),
      visitor_count: parseInt(form.visitor_count, 10) || 0
    };

    try {
      const conflictResult = await api.checkConflict({
        venue_id: payload.venue_id,
        date_start: payload.date_start,
        date_end: payload.date_end,
        time_start: payload.time_start,
        time_end: payload.time_end,
        staff_ids: payload.staff_ids,
        exclude_booking_id: editingBooking?.id || null
      });

      if (conflictResult.has_conflict && !forceSaveChecked) {
        setConflicts(conflictResult.conflicts);
        setPendingPayload(payload);
        setShowConflictDialog(true);
        setLoading(false);
        return;
      }

      await doSave(payload, forceSaveChecked);
    } catch (err) {
      setError(err.message || '检查冲突失败');
      setLoading(false);
    }
  };

  const handleForceSave = async () => {
    if (!form.change_reason?.trim()) {
      setError('强制保存必须填写调整/覆盖原因');
      return;
    }
    setLoading(true);
    setShowConflictDialog(false);
    const payload = pendingPayload || {
      ...form,
      venue_id: parseInt(form.venue_id, 10),
      visitor_count: parseInt(form.visitor_count, 10) || 0
    };
    await doSave(payload, true);
  };

  const handleConflictGoBack = () => {
    setShowConflictDialog(false);
    if (editingBooking || isAdmin) {
      const conflictDesc = conflicts.map(c =>
        c.conflict_type === 'venue'
          ? `讲解点${c.venue_name}与「${c.booking_title}」冲突`
          : `讲解员${c.staff_name}与「${c.booking_title}」冲突`
      ).join('；');
      setForm(f => ({
        ...f,
        change_reason: f.change_reason
          ? f.change_reason
          : `因资源冲突调整：${conflictDesc}`
      }));
    }
    setConflicts([]);
    setPendingPayload(null);
  };

  const formatConflictTime = (c) => {
    if (c.date_start === c.date_end) {
      return `${c.date_start} ${c.time_start}-${c.time_end}`;
    }
    return `${c.date_start} ${c.time_start} ~ ${c.date_end} ${c.time_end}`;
  };

  const conflictTypeLabel = (type) => {
    return type === 'venue' ? '讲解点冲突' : '讲解员冲突';
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

            {liveConflicts.length > 0 && (
              <div className="live-conflict-warning">
                <div className="live-conflict-title">
                  {liveChecking ? '🔄 正在检测冲突...' : '⚠️ 实时检测到资源冲突'}
                </div>
                {!liveChecking && (
                  <div className="conflict-warning-item-list">
                    {liveConflicts.slice(0, 3).map((c, i) => (
                      <div key={i} className="live-conflict-item">
                        <span className={`conflict-type-tag tag-${c.conflict_type}`}>
                          {conflictTypeLabel(c.conflict_type)}
                        </span>
                        <span>「{c.booking_title}」{formatConflictTime(c)}</span>
                      </div>
                    ))}
                    {liveConflicts.length > 3 && (
                      <div className="live-conflict-more">... 还有 {liveConflicts.length - 3} 处冲突</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(editingBooking || showConflictDialog || forceSaveChecked) && (
              <div className="form-group">
                <label>调整原因 {forceSaveChecked || editingBooking ? '*' : ''}</label>
                <textarea
                  name="change_reason"
                  value={form.change_reason}
                  onChange={handleChange}
                  rows="2"
                  placeholder={forceSaveChecked ? '请填写强制保存（覆盖冲突）的原因，用于审计记录' : '请填写调整或修改的原因，用于审计记录'}
                  required={forceSaveChecked || !!editingBooking}
                ></textarea>
              </div>
            )}

            {showConflictDialog && isAdmin && (
              <div className="force-save-section">
                <label className="checkbox-item" style={{ fontWeight: 600, color: '#991b1b' }}>
                  <input
                    type="checkbox"
                    name="force_save"
                    checked={forceSaveChecked}
                    onChange={handleChange}
                  />
                  我是管理员，已知晓冲突风险，强制保存（需填写上方调整原因）
                </label>
              </div>
            )}

            {error && <div style={{ color: '#ef4444', fontSize: '13px' }}>{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '8px 20px' }} disabled={loading}>
              {loading ? '保存中...' : forceSaveChecked ? '强制保存' : '保存'}
            </button>
          </div>
        </form>

        {showConflictDialog && (
          <div className="conflict-dialog-overlay">
            <div className="conflict-dialog">
              <div className="conflict-dialog-header">
                <span className="conflict-dialog-icon">⚠️</span>
                <h4>资源冲突提醒</h4>
              </div>
              <div className="conflict-dialog-body">
                <p className="conflict-dialog-desc">
                  当前预约与以下已有预约存在资源冲突，请调整后再保存{isAdmin ? '，或作为管理员强制保存（需注明原因）' : ''}：
                </p>
                <div className="conflict-list">
                  {conflicts.map((c, i) => (
                    <div key={i} className={`conflict-item conflict-type-${c.conflict_type}`}>
                      <div className="conflict-item-header">
                        <span className={`conflict-type-tag tag-${c.conflict_type}`}>
                          {conflictTypeLabel(c.conflict_type)}
                        </span>
                        <span className="conflict-booking-name">{c.booking_title}</span>
                      </div>
                      <div className="conflict-item-detail">
                        <span>📍 讲解点：{c.venue_name}</span>
                        <span>⏰ 时间：{formatConflictTime(c)}</span>
                        {c.conflict_type === 'staff' && c.staff_name && (
                          <span>🧑‍🏫 冲突人员：{c.staff_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="conflict-dialog-footer">
                <button className="btn-secondary" onClick={handleConflictGoBack}>返回修改</button>
                {isAdmin && (
                  <button
                    className="btn-danger"
                    onClick={handleForceSave}
                    disabled={!form.change_reason?.trim() || loading}
                    style={{ padding: '8px 16px' }}
                  >
                    {loading ? '保存中...' : '强制保存（管理员）'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingModal;
