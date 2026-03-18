const express = require('express');
const Docker = require('dockerode');

const router = express.Router();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// List all containers
router.get('/containers', async (_req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    res.json(containers.map((c) => ({
      id: c.Id.slice(0, 12),
      name: c.Names[0]?.replace(/^\//, ''),
      image: c.Image,
      state: c.State,
      status: c.Status,
      ports: c.Ports,
      created: c.Created,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Container action: start, stop, restart, remove
router.post('/containers/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  const allowed = ['start', 'stop', 'restart', 'remove'];

  if (!allowed.includes(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }

  try {
    const container = docker.getContainer(id);
    await container[action]();
    res.json({ success: true, action, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Container logs (last 100 lines)
router.get('/containers/:id/logs', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
      timestamps: true,
    });
    // Strip Docker stream header bytes
    const text = logs.toString('utf8').replace(/[\x00-\x08]/g, '');
    res.type('text/plain').send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Docker system info
router.get('/info', async (_req, res) => {
  try {
    const info = await docker.info();
    res.json({
      containers: info.Containers,
      running: info.ContainersRunning,
      paused: info.ContainersPaused,
      stopped: info.ContainersStopped,
      images: info.Images,
      serverVersion: info.ServerVersion,
      memoryLimit: info.MemTotal,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
