import React, { useState, useEffect } from 'react';
import { api } from '../api.js';

function Audit() {
  const [activeTab, setActiveTab] = useState('logs');
  const [changeLogs, setChangeLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [fbResultFilter, setFbResultFilter] = useState('all');

  const executionStatusLabel = {
    pending: { text: '待开始', cls: 'tag-exec-pending' },
    ongoing: { text: '进行中', cls: 'tag-exec-ongoing' },
    completed: { text: '已完成', cls: 'tag-exec-completed' },
    no_show: { text: '未到场', cls: 'tag-exec-noshow' },
    cancelled_temp: { text: '临时取消', cls: 'tag-exec-cancelled' },
    abnormal: { text: '异常结束', cls: 'tag-exec-abnormal' }
  };

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

  const loadFeedbacks = async () => {
    try {
      const result = fbResultFilter === 'all' ? undefined : fbResultFilter;
      const list = await api.listAllFeedbacks(startDate || undefined, endDate || undefined, result);
      setFeedbacks(list);
    } catch (e) { alert(e.message); }
  };

  useEffect(() => {
    if (activeTab === 'logs') loadLogs();
    else if (activeTab === 'snapshots') loadSnapshots();
    else if (activeTab === 'feedbacks') loadFeedbacks();
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
    delete: { text: '删除', cls: 'delete' },
    feedback_create: { text: '提交反馈', cls: 'feedback_create' },
    feedback_update: { text: '修改反馈', cls: 'feedback_update' }
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
        <div className={`tab ${activeTab === 'feedbacks' ? 'active' : ''}`} onClick={() => setActiveTab('feedbacks')}>
          执行反馈
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

      {activeTab === 'feedbacks' && (
        <div>
          <div className="toolbar" style={{ justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>开始：</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>结束：</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>执行结果：</span>
              <select value={fbResultFilter} onChange={e => setFbResultFilter(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                <option value="all">全部</option>
                <option value="completed">已完成</option>
                <option value="no_show">未到场</option>
                <option value="cancelled_temp">临时取消</option>
                <option value="abnormal">异常结束</option>
              </select>
              <button className="btn-secondary" onClick={loadFeedbacks}>查询</button>
            </div>
          </div>

          {feedbacks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div>暂无执行反馈记录</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {feedbacks.map(fb => {
                const execLabel = executionStatusLabel[fb.execution_result];
                return (
                  <div key={fb.id} className="log-entry feedback-history" style={{
                    borderLeftColor: execLabel?.cls.includes('completed') ? '#10b981' :
                                     execLabel?.cls.includes('noshow') ? '#ef4444' :
                                     execLabel?.cls.includes('cancelled') ? '#f59e0b' :
                                     execLabel?.cls.includes('abnormal') ? '#8b5cf6' : '#3b82f6'
                  }}>
                    <div className="log-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span className="log-type" style={{ fontWeight: 600 }}>预约 #{fb.booking_id}</span>
                        <span className="tag" style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 500,
                          background: execLabel?.cls.includes('completed') ? '#dcfce7' :
                                     execLabel?.cls.includes('noshow') ? '#fee2e2' :
                                     execLabel?.cls.includes('cancelled') ? '#fef3c7' :
                                     execLabel?.cls.includes('abnormal') ? '#ede9fe' : '#dbeafe',
                          color: execLabel?.cls.includes('completed') ? '#166534' :
                                 execLabel?.cls.includes('noshow') ? '#991b1b' :
                                 execLabel?.cls.includes('cancelled') ? '#92400e' :
                                 execLabel?.cls.includes('abnormal') ? '#5b21b6' : '#1e40af'
                        }}>{execLabel?.text || fb.execution_result}</span>
                        <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{fb.booking_title}</span>
                      </div>
                      <span className="log-time">{fb.created_at}{fb.version > 1 && ` (v${fb.version})`}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px', color: '#4b5563', marginTop: '8px' }}>
                      <div><span style={{ color: '#9ca3af' }}>讲解点：</span>{fb.venue_name}</div>
                      <div><span style={{ color: '#9ca3af' }}>时间：</span>{fb.booking_date_start} {fb.booking_time_start} ~ {fb.booking_date_end} {fb.booking_time_end}</div>
                      <div><span style={{ color: '#9ca3af' }}>预约创建人：</span>{fb.creator_name}</div>
                      <div><span style={{ color: '#9ca3af' }}>反馈提交人：</span>{fb.feedback_creator_name}</div>
                      <div><span style={{ color: '#9ca3af' }}>实际到场：</span>{fb.actual_attendance} 人</div>
                      <div><span style={{ color: '#9ca3af' }}>实际人员：</span>{fb.actual_staff || '-'}</div>
                    </div>
                    {fb.feedback_note && <div className="log-reason" style={{ marginTop: '6px' }}>反馈备注：{fb.feedback_note}</div>}
                    {fb.change_reason && <div className="log-reason" style={{ marginTop: '4px' }}>变更原因：{fb.change_reason}</div>}
                    {fb.version > 1 && fb.updater_name && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>最后修改人：{fb.updater_name} @ {fb.updated_at}</div>}
                  </div>
                );
              })}
            </div>
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
                  {selectedSnapshot.snapshot_data.map(b => {
                    const execLabel = executionStatusLabel[b.execution_status];
                    return (
                      <div key={b.id} style={{
                        padding: '12px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        marginBottom: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ fontWeight: 600 }}>{b.title}</div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {execLabel && (
                              <span className="tag" style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 500,
                                background: execLabel.cls.includes('completed') ? '#dcfce7' :
                                           execLabel.cls.includes('ongoing') ? '#d1fae5' :
                                           execLabel.cls.includes('noshow') ? '#fee2e2' :
                                           execLabel.cls.includes('cancelled') ? '#fef3c7' :
                                           execLabel.cls.includes('abnormal') ? '#ede9fe' : '#e0e7ff',
                                color: execLabel.cls.includes('completed') ? '#166534' :
                                       execLabel.cls.includes('ongoing') ? '#065f46' :
                                       execLabel.cls.includes('noshow') ? '#991b1b' :
                                       execLabel.cls.includes('cancelled') ? '#92400e' :
                                       execLabel.cls.includes('abnormal') ? '#5b21b6' : '#4338ca'
                              }}>{execLabel.text}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.7' }}>
                          <div>讲解点：{b.venue_name}</div>
                          <div>时间：{b.date_start} {b.time_start} ~ {b.date_end} {b.time_end}</div>
                          <div>人数：{b.visitor_count} 人</div>
                          <div>人员：{(b.staff_list || []).map(s => s.name).join('、') || '未指派'}</div>
                          {b.remark && <div>备注：{b.remark}</div>}
                          {b.feedback && (
                            <div style={{ marginTop: '8px', padding: '8px 10px', background: '#f8fafc', borderRadius: '4px' }}>
                              <div style={{ fontWeight: 500, marginBottom: '4px' }}>📋 执行反馈</div>
                              <div>执行结果：{executionStatusLabel[b.feedback.execution_result]?.text || b.feedback.execution_result}</div>
                              <div>实际到场：{b.feedback.actual_attendance} 人</div>
                              <div>实际人员：{b.feedback.actual_staff || '-'}</div>
                              {b.feedback.feedback_note && <div>备注：{b.feedback.feedback_note}</div>}
                              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                                提交人：{b.feedback.creator_name} @ {b.feedback.created_at}{b.feedback.version > 1 && ` (v${b.feedback.version})`}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
