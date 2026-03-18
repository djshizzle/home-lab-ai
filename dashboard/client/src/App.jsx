import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import MetricsPanel from './panels/MetricsPanel';
import DockerPanel from './panels/DockerPanel';
import ServicesPanel from './panels/ServicesPanel';
import HostsPanel from './panels/HostsPanel';

const TABS = [
  { id: 'metrics', label: 'System Metrics' },
  { id: 'docker', label: 'Docker' },
  { id: 'services', label: 'Services' },
  { id: 'hosts', label: 'Hosts & WoL' },
];

export default function App() {
  const [tab, setTab] = useState('metrics');
  const { metrics, connected } = useWebSocket();

  return (
    <div className="app">
      <header>
        <h1>Home Lab Dashboard</h1>
        <span className={`status ${connected ? 'connected' : ''}`}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </header>

      <nav>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'metrics' && <MetricsPanel metrics={metrics} />}
        {tab === 'docker' && <DockerPanel />}
        {tab === 'services' && <ServicesPanel />}
        {tab === 'hosts' && <HostsPanel />}
      </main>
    </div>
  );
}
