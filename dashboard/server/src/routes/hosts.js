const express = require('express');
const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const HOSTS_FILE = path.join(__dirname, '..', '..', 'hosts.json');

function loadHosts() {
  if (!fs.existsSync(HOSTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8'));
}

function saveHosts(hosts) {
  fs.writeFileSync(HOSTS_FILE, JSON.stringify(hosts, null, 2));
}

// List configured hosts
router.get('/', (_req, res) => {
  res.json(loadHosts());
});

// Add a host
router.post('/', (req, res) => {
  const { name, hostname, mac, username, port } = req.body;

  if (!name || !hostname) {
    return res.status(400).json({ error: 'name and hostname are required' });
  }

  const hosts = loadHosts();
  const host = {
    id: Date.now().toString(36),
    name,
    hostname,
    mac: mac || null,
    username: username || 'root',
    port: port || 22,
  };
  hosts.push(host);
  saveHosts(hosts);

  res.status(201).json(host);
});

// Delete a host
router.delete('/:id', (req, res) => {
  const hosts = loadHosts();
  const filtered = hosts.filter((h) => h.id !== req.params.id);

  if (filtered.length === hosts.length) {
    return res.status(404).json({ error: 'Host not found' });
  }

  saveHosts(filtered);
  res.json({ success: true });
});

// Execute SSH command on a host
router.post('/:id/ssh', async (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'command is required' });
  }

  const hosts = loadHosts();
  const host = hosts.find((h) => h.id === req.params.id);

  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: host.hostname,
      port: host.port,
      username: host.username,
      agent: process.env.SSH_AUTH_SOCK,
    });

    const result = await ssh.execCommand(command, { timeout: 30000 });
    ssh.dispose();

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code,
    });
  } catch (err) {
    ssh.dispose();
    res.status(500).json({ error: err.message });
  }
});

// Ping a host
router.get('/:id/ping', async (req, res) => {
  const hosts = loadHosts();
  const host = hosts.find((h) => h.id === req.params.id);

  if (!host) {
    return res.status(404).json({ error: 'Host not found' });
  }

  const { execFile } = require('child_process');
  execFile('ping', ['-c', '1', '-W', '2', host.hostname], (err, stdout) => {
    res.json({
      reachable: !err,
      hostname: host.hostname,
      output: stdout || '',
    });
  });
});

module.exports = router;
