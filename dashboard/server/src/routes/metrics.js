const express = require('express');
const si = require('systeminformation');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [cpu, mem, fsSize, networkStats, osInfo, time] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.osInfo(),
      si.time(),
    ]);

    res.json({
      cpu: {
        load: cpu.currentLoad,
        cores: cpu.cpus.map((c) => c.load),
        model: cpu.cpus[0]?.model || 'Unknown',
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        percent: (mem.used / mem.total) * 100,
      },
      disks: fsSize.map((d) => ({
        fs: d.fs,
        mount: d.mount,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        percent: d.use,
      })),
      network: networkStats.map((n) => ({
        iface: n.iface,
        rx_bytes: n.rx_bytes,
        tx_bytes: n.tx_bytes,
        rx_sec: n.rx_sec,
        tx_sec: n.tx_sec,
      })),
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        hostname: osInfo.hostname,
        arch: osInfo.arch,
      },
      uptime: time.uptime,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
