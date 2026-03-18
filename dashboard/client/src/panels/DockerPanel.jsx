import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

export default function DockerPanel() {
  const { get, post } = useApi();
  const [containers, setContainers] = useState([]);
  const [info, setInfo] = useState(null);
  const [logs, setLogs] = useState(null);
  const [logsId, setLogsId] = useState(null);

  const refresh = useCallback(async () => {
    const [c, i] = await Promise.all([
      get('/docker/containers'),
      get('/docker/info'),
    ]);
    if (Array.isArray(c)) setContainers(c);
    if (i && !i.error) setInfo(i);
  }, [get]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAction = async (id, action) => {
    await post(`/docker/containers/${id}/${action}`);
    refresh();
  };

  const viewLogs = async (id) => {
    if (logsId === id) { setLogs(null); setLogsId(null); return; }
    const text = await get(`/docker/containers/${id}/logs`);
    setLogs(text);
    setLogsId(id);
  };

  return (
    <div>
      {info && (
        <div className="grid mb-1">
          <div className="card">
            <h3>Docker Overview</h3>
            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
              <div><strong>{info.running}</strong> running</div>
              <div><strong>{info.stopped}</strong> stopped</div>
              <div><strong>{info.images}</strong> images</div>
              <div style={{ color: 'var(--text-dim)' }}>v{info.serverVersion}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex-between mb-1">
          <h3 style={{ margin: 0 }}>Containers</h3>
          <button className="btn sm" onClick={refresh}>Refresh</button>
        </div>

        {containers.length === 0 ? (
          <div className="empty-state">No containers found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Image</th>
                <th>State</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{c.image}</td>
                  <td><span className={`badge ${c.state}`}>{c.state}</span></td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{c.status}</td>
                  <td>
                    <div className="btn-group">
                      {c.state !== 'running' && (
                        <button className="btn sm" onClick={() => handleAction(c.id, 'start')}>Start</button>
                      )}
                      {c.state === 'running' && (
                        <>
                          <button className="btn sm" onClick={() => handleAction(c.id, 'stop')}>Stop</button>
                          <button className="btn sm" onClick={() => handleAction(c.id, 'restart')}>Restart</button>
                        </>
                      )}
                      <button className="btn sm" onClick={() => viewLogs(c.id)}>Logs</button>
                      <button className="btn sm danger" onClick={() => handleAction(c.id, 'remove')}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {logs && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Logs: {containers.find((c) => c.id === logsId)?.name}</h3>
          <div className="logs-box">{logs}</div>
        </div>
      )}
    </div>
  );
}
