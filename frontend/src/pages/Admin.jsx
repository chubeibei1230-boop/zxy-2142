import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

function Admin() {
  const [venues, setVenues] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [v, ts, s] = await Promise.all([api.listVenues(), api.listTimeSlots(), api.listStaff()]);
      setVenues(v); setTimeSlots(ts); setStaff(s);
    } catch (e) { alert(e.message); }
  };

  const openModal = (type, item = null) => {
    setModal(type);
    setEditing(item);
    if (type === 'venue') {
      setForm(item ? { ...item } : { name: '', description: '', location: '', is_active: 1 });
    } else if (type === 'timeslot') {
      setForm(item ? { ...item } : { name: '', start_time: '09:00', end_time: '11:00', is_active: 1 });
    } else if (type === 'staff') {
      setForm(item ? { ...item } : { name: '', title: '', phone: '', is_active: 1 });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'venue') {
        if (editing) await api.updateVenue(editing.id, form);
        else await api.createVenue(form);
      } else if (modal === 'timeslot') {
        if (editing) await api.updateTimeSlot(editing.id, form);
        else await api.createTimeSlot(form);
      } else if (modal === 'staff') {
        if (editing) await api.updateStaff(editing.id, form);
        else await api.createStaff(form);
      }
      setModal(null);
      loadAll();
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('确定删除？')) return;
    try {
      if (type === 'venue') await api.deleteVenue(id);
      else if (type === 'timeslot') await api.deleteTimeSlot(id);
      else if (type === 'staff') await api.deleteStaff(id);
      loadAll();
    } catch (e) { alert(e.message); }
  };

  const handleSnapshot = async () => {
    try {
      const res = await api.createSnapshot();
      alert(`快照创建成功：${res.snapshot_date}`);
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ fontSize: '18px' }}>🛠 系统管理</h2>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleSnapshot}>
          📸 创建日程快照
        </button>
      </div>

      <div className="admin-section">
        <div className="toolbar">
          <h3>📍 讲解点管理</h3>
          <button className="btn-secondary" onClick={() => openModal('venue')}>+ 新增讲解点</button>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>名称</th><th>描述</th><th>位置</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {venues.map(v => (
              <tr key={v.id}>
                <td>{v.id}</td><td>{v.name}</td><td>{v.description || '-'}</td><td>{v.location || '-'}</td>
                <td>{v.is_active ? '启用' : '停用'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn-secondary btn-small" onClick={() => openModal('venue', v)}>编辑</button>
                    <button className="btn-danger btn-small" onClick={() => handleDelete('venue', v.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-section">
        <div className="toolbar">
          <h3>⏰ 时段规则</h3>
          <button className="btn-secondary" onClick={() => openModal('timeslot')}>+ 新增时段</button>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>时段名称</th><th>开始时间</th><th>结束时间</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {timeSlots.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td><td>{t.name}</td><td>{t.start_time}</td><td>{t.end_time}</td>
                <td>{t.is_active ? '启用' : '停用'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn-secondary btn-small" onClick={() => openModal('timeslot', t)}>编辑</button>
                    <button className="btn-danger btn-small" onClick={() => handleDelete('timeslot', t.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-section">
        <div className="toolbar">
          <h3>👥 人员名单</h3>
          <button className="btn-secondary" onClick={() => openModal('staff')}>+ 新增人员</button>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>姓名</th><th>职称</th><th>电话</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id}>
                <td>{s.id}</td><td>{s.name}</td><td>{s.title || '-'}</td><td>{s.phone || '-'}</td>
                <td>{s.is_active ? '启用' : '停用'}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn-secondary btn-small" onClick={() => openModal('staff', s)}>编辑</button>
                    <button className="btn-danger btn-small" onClick={() => handleDelete('staff', s.id)}>删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing ? '编辑' : '新增'}{modal === 'venue' ? '讲解点' : modal === 'timeslot' ? '时段' : '人员'}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {modal === 'venue' && (
                  <>
                    <div className="form-group">
                      <label>名称</label>
                      <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>描述</label>
                      <input value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>位置</label>
                      <input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>状态</label>
                      <select value={form.is_active} onChange={e => setForm({ ...form, is_active: parseInt(e.target.value) })}>
                        <option value={1}>启用</option>
                        <option value={0}>停用</option>
                      </select>
                    </div>
                  </>
                )}
                {modal === 'timeslot' && (
                  <>
                    <div className="form-group">
                      <label>时段名称</label>
                      <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>开始时间</label>
                        <input type="time" value={form.start_time || ''} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label>结束时间</label>
                        <input type="time" value={form.end_time || ''} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>状态</label>
                      <select value={form.is_active} onChange={e => setForm({ ...form, is_active: parseInt(e.target.value) })}>
                        <option value={1}>启用</option>
                        <option value={0}>停用</option>
                      </select>
                    </div>
                  </>
                )}
                {modal === 'staff' && (
                  <>
                    <div className="form-group">
                      <label>姓名</label>
                      <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>职称</label>
                      <input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>电话</label>
                      <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>状态</label>
                      <select value={form.is_active} onChange={e => setForm({ ...form, is_active: parseInt(e.target.value) })}>
                        <option value={1}>启用</option>
                        <option value={0}>停用</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModal(null)}>取消</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '8px 20px' }}>保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
