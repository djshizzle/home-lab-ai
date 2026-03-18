import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

export default function HostsPanel() {
  const { get, post, del } = useApi();
  const [hosts, setHosts] = useState([]);
  const [hostStatus, setHostStatus] = useState({});
  const [sshOutput, setSshOutput] = useState({});
  const [sshCmd, setSshCmd] = useState({});
  const [form, setForm] = useState({ name: '', hostname: '', mac: '', username: 'root', port: '22' });
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    const data = await get('/hosts');
    if (Array.isArray(data)) setHosts(data);
  }, [get]);

  useEffect(() => { refresh(); }, [refresh]);

  const pingAll = useCallback(async () => {
    const results = {};
    await Promise.all(
      hosts.map(async (h) => {
        const res = await get(`/hosts/${h.id}/ping`);
        results[h.id] = res.reachable;
      })
    );
    setHostStatus(results);
  }, [get, hosts]);

  useEffect(() => {
    if (hosts.length > 0) pingAll();
  }, [hosts, pingAll]);

  const addHost = async () => {
    if (!form.name || !form.hostname) return;
    await post('/hosts', { ...form, port: parseInt(form.port, 10) });
    setForm({ name: '', hostname: '', mac: '', username: 'root', port: '22' });
    setShowForm(false);
    refresh();
  };

  const removeHost = async (id) => {
    await del(`/hosts/${id}`);
    refresh();
  };

  const wakeHost = async (mac) => {
    if (!mac) return;
    await post('/wol/wake', { mac });
  };

  const runSsh = async (id) => {
    const cmd = sshCmd[id];
    if (!cmd) return;
    const result = await post(`/hosts/${id}/ssh`, { command: cmd });
    setSshOutput((prev) => ({ ...prev, [id]: result }));
  };

  return (
    <div>
      <div className="flex-between mb-1">
        <h3>Remote Hosts</h3>
        <div className="btn-group">
          <button className="btn sm" onClick={pingAll}>Ping All</button>
          <button className="btn sm primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Host'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card mb-1">
          <h3>Add Host</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. NAS" />
            </div>
            <div className="form-group">
              <label>Hostname / IP</label>
              <input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="192.168.1.100" />
            </div>
            <div className="form-group">
              <label>MAC (for WoL)</label>
              <input value={form.mac} onChange={(e) => setForm({ ...form, mac: e.target.value })} placeholder="AA:BB:CC:DD:EE:FF" />
            </div>
            <div className="form-group">
              <label>SSH User</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} style={{ width: '70px' }} />
            </div>
            <button className="btn primary" onClick={addHost}>Save</button>
          </div>
        </div>
      )}

      {hosts.length === 0 ? (
        <div className="card empty-state">No hosts configured. Add one to get started.</div>
      ) : (
        <div className="grid">
          {hosts.map((h) => (
            <div className="card" key={h.id}>
              <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{h.name}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {h.hostname}:{h.port} ({h.username})
                  </div>
                </div>
                <span className={`badge ${hostStatus[h.id] ? 'online' : 'offline'}`}>
                  {hostStatus[h.id] ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className="btn-group mb-1">
                <button className="btn sm" onClick={() => get(`/hosts/${h.id}/ping`).then((r) => setHostStatus((s) => ({ ...s, [h.id]: r.reachable })))}>
                  Ping
                </button>
                {h.mac && (
                  <button className="btn sm primary" onClick={() => wakeHost(h.mac)}>
                    Wake (WoL)
                  </button>
                )}
                <button className="btn sm danger" onClick={() => removeHost(h.id)}>Remove</button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="SSH command..."
                  value={sshCmd[h.id] || ''}
                  onChange={(e) => setSshCmd((s) => ({ ...s, [h.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && runSsh(h.id)}
                />
                <button className="btn sm" onClick={() => runSsh(h.id)}>Run</button>
              </div>

              {sshOutput[h.id] && (
                <div className="logs-box" style={{ maxHeight: '200px' }}>
                  {sshOutput[h.id].stdout || ''}
                  {sshOutput[h.id].stderr ? `\nSTDERR:\n${sshOutput[h.id].stderr}` : ''}
                  {sshOutput[h.id].error ? `\nERROR: ${sshOutput[h.id].error}` : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
