import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

export default function ServicesPanel() {
  const { get, post } = useApi();
  const [services, setServices] = useState([]);
  const [filter, setFilter] = useState('');

  const refresh = useCallback(async () => {
    const data = await get('/services');
    if (Array.isArray(data)) setServices(data);
  }, [get]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAction = async (name, action) => {
    await post(`/services/${encodeURIComponent(name)}/${action}`);
    refresh();
  };

  const filtered = services.filter((s) =>
    s.unit.toLowerCase().includes(filter.toLowerCase()) ||
    s.description.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="card">
      <div className="flex-between mb-1">
        <h3 style={{ margin: 0 }}>Systemd Services</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Filter services..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '200px' }}
          />
          <button className="btn sm" onClick={refresh}>Refresh</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>State</th>
            <th>Sub</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.slice(0, 100).map((s) => (
            <tr key={s.unit}>
              <td style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {s.unit}
              </td>
              <td>
                <span className={`badge ${s.active}`}>{s.active}</span>
              </td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{s.sub}</td>
              <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.description}
              </td>
              <td>
                <div className="btn-group">
                  <button className="btn sm" onClick={() => handleAction(s.unit, 'restart')}>Restart</button>
                  {s.active === 'active' ? (
                    <button className="btn sm" onClick={() => handleAction(s.unit, 'stop')}>Stop</button>
                  ) : (
                    <button className="btn sm" onClick={() => handleAction(s.unit, 'start')}>Start</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length > 100 && (
        <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          Showing 100 of {filtered.length} services. Use filter to narrow down.
        </div>
      )}
    </div>
  );
}
