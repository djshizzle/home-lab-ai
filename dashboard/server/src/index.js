const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const metricsRouter = require('./routes/metrics');
const dockerRouter = require('./routes/docker');
const servicesRouter = require('./routes/services');
const wolRouter = require('./routes/wol');
const hostsRouter = require('./routes/hosts');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// REST routes
app.use('/api/metrics', metricsRouter);
app.use('/api/docker', dockerRouter);
app.use('/api/services', servicesRouter);
app.use('/api/wol', wolRouter);
app.use('/api/hosts', hostsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// WebSocket: push system metrics every 2s
const si = require('systeminformation');

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  const interval = setInterval(async () => {
    try {
      const [cpu, mem, fsSize, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
      ]);

      ws.send(JSON.stringify({
        type: 'metrics',
        data: {
          cpu: { load: cpu.currentLoad, cores: cpu.cpus.map((c) => c.load) },
          memory: {
            total: mem.total,
            used: mem.used,
            free: mem.free,
            percent: (mem.used / mem.total) * 100,
          },
          disks: fsSize.map((d) => ({
            fs: d.fs,
            mount: d.mount,
            size: d.size,
            used: d.used,
            percent: d.use,
          })),
          network: networkStats.map((n) => ({
            iface: n.iface,
            rxSec: n.rx_sec,
            txSec: n.tx_sec,
          })),
          timestamp: Date.now(),
        },
      }));
    } catch (err) {
      console.error('Metrics push error:', err.message);
    }
  }, 2000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('WebSocket client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Home Lab Dashboard API running on port ${PORT}`);
});
