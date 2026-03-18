import React from 'react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatRate(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec < 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

function meterColor(percent) {
  if (percent < 50) return 'green';
  if (percent < 75) return 'yellow';
  if (percent < 90) return 'orange';
  return 'red';
}

function Meter({ percent }) {
  const p = Math.min(100, Math.max(0, percent || 0));
  return (
    <div className="meter">
      <div
        className={`meter-fill ${meterColor(p)}`}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export default function MetricsPanel({ metrics }) {
  if (!metrics) {
    return <div className="empty-state">Waiting for live metrics...</div>;
  }

  const { cpu, memory, disks, network } = metrics;

  return (
    <div className="grid">
      <div className="card">
        <h3>CPU Usage</h3>
        <div className="metric-value">{cpu.load.toFixed(1)}%</div>
        <Meter percent={cpu.load} />
        {cpu.cores && (
          <div style={{ marginTop: '0.75rem' }}>
            {cpu.cores.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-dim)', width: '3rem' }}>Core {i}</span>
                <div style={{ flex: 1 }}>
                  <Meter percent={c} />
                </div>
                <span style={{ width: '3rem', textAlign: 'right' }}>{c.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Memory</h3>
        <div className="metric-value">{memory.percent.toFixed(1)}%</div>
        <Meter percent={memory.percent} />
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
          {formatBytes(memory.used)} / {formatBytes(memory.total)}
        </div>
      </div>

      <div className="card">
        <h3>Disk Usage</h3>
        {disks.map((d, i) => (
          <div key={i} style={{ marginBottom: '0.75rem' }}>
            <div className="flex-between" style={{ fontSize: '0.85rem' }}>
              <span>{d.mount}</span>
              <span style={{ color: 'var(--text-dim)' }}>{d.percent.toFixed(1)}%</span>
            </div>
            <Meter percent={d.percent} />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              {formatBytes(d.used)} / {formatBytes(d.size)}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Network</h3>
        {network.filter((n) => n.rxSec !== null).map((n, i) => (
          <div key={i} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600 }}>{n.iface}</div>
            <div style={{ color: 'var(--text-dim)' }}>
              Down: {formatRate(n.rxSec)} | Up: {formatRate(n.txSec)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
