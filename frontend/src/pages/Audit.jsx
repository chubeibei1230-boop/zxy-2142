import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

function Audit() {
  const [activeTab, setActiveTab] = useState('logs');
  const [changeLogs, setChangeLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadLogs = async () => {
    try {
      const logs = await api.listChangeLogs(startDate || undefined, endDate || undefined);
      setChangeLogs(logs);
    } catch (e) { alert(e.message); }
  };

  const loadSnapshots = async () => {
    try {
      const list = await api.listSnapshots();
      setSnapshots(list);
    } catch (e) { alert(e.message); }
  };

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
    else loadSnapshots();
  }, [activeTab]);

  const viewSnapshot = async (id) => {
    try {
      const data = await api.getSnapshot(id);
      setSelectedSnapshot(data);
    } catch (e) { alert(e.message); }
  };

  const typeLabel = {
    create: { text: '创建', cls: 'create' },
    update: { text: '更新', cls: 'update' },
    adjust: { text: '调整', cls: 'adjust' },
    delete: { text: '删除', cls: 'delete' }
  };

  return (
    <div>
      <div className="toolbar">
        <h2 style={{ fontSize: '18px' }}>🔍 审计中心</h2>
      </div>

      <div className="nav-tabs" style={{ padding: 0, marginBottom: '20px' }}>
        <div className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          变更记录
        </div>
        <div className={`tab ${activeTab === 'snapshots' ? 'active' : ''}`} onClick={() => setActiveTab('snapshots')}>
          日程快照
        </div>
      </div>

      {activeTab === 'logs' && (
        <div>
          <div className="toolbar" style={{ justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>开始：</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>结束：</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <button className="btn-secondary" onClick={loadLogs}>查询</button>
            </div>
          </div>

          {changeLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div>暂无变更记录</div>
            </div>
          ) : (
            changeLogs.map(log => {
              const t = typeLabel[log.change_type] || { text: log.change_type, cls: '' };
              return (
                <div key={log.id} className={`log-entry ${t.cls}`}>
                  <div className="log-header">
                    <span className="log-type">预约 #{log.booking_id} - {t.text}</span>
                    <span className="log-time">{log.created_at}</span>
                  </div>
                  <div className="log-operator">操作人：{log.operator_name}</div>
                  {log.change_reason && <div className="log-reason">原因：{log.change_reason}</div>}
                  {(log.before_data || log.after_data) && (
                    <div className="log-diff">
                      <details>
                        <summary>查看变更详情</summary>
                        {log.before_data && (
                          <div>
                            <div style={{ color: '#fca5a5', marginBottom: '4px', marginTop: '8px' }}>变更前：</div>
                            <pre>{JSON.stringify(JSON.parse(log.before_data), null, 2)}</pre>
                          </div>
                        )}
                        {log.after_data && (
                          <div>
                            <div style={{ color: '#86efac', marginBottom: '4px', marginTop: '8px' }}>变更后：</div>
                            <pre>{JSON.stringify(JSON.parse(log.after_data), null, 2)}</pre>
                          </div>
                        )}
                      </details>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'snapshots' && (
        <div>
          {snapshots.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📸</div>
              <div>暂无快照，请管理员在管理页面创建</div>
            </div>
          ) : (
            <div className="snapshot-list">
              {snapshots.map(s => (
                <div key={s.id} className="snapshot-item">
                  <div>
                    <strong>📅 {s.snapshot_date}</strong>
                    <span style={{ marginLeft: '12px', fontSize: '12px', color: '#9ca3af' }}>创建于 {s.created_at}</span>
                  </div>
                  <button className="btn-secondary btn-small" onClick={() => viewSnapshot(s.id)}>查看详情</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedSnapshot && (
        <div className="modal-overlay" onClick={() => setSelectedSnapshot(null)}>
          <div className="modal" style={{ width: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📸 日程快照 - {selectedSnapshot.snapshot_date}</h3>
              <button className="modal-close" onClick={() => setSelectedSnapshot(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
                创建时间：{selectedSnapshot.created_at}
              </p>
              {selectedSnapshot.snapshot_data.length === 0 ? (
                <div className="empty-state"><div>该日无预约记录</div></div>
              ) : (
                <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                  {selectedSnapshot.snapshot_data.map(b => (
                    <div key={b.id} style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      marginBottom: '10px'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '6px' }}>{b.title}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.7' }}>
                        <div>讲解点：{b.venue_name}</div>
                        <div>时间：{b.date_start} {b.time_start} ~ {b.date_end} {b.time_end}</div>
                        <div>人数：{b.visitor_count} 人</div>
                        <div>人员：{(b.staff_list || []).map(s => s.name).join('、') || '未指派'}</div>
                        {b.remark && <div>备注：{b.remark}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedSnapshot(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Audit;
