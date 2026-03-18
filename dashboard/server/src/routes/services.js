const express = require('express');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const router = express.Router();

// List systemd services
router.get('/', async (_req, res) => {
  try {
    const { stdout } = await execFileAsync('systemctl', [
      'list-units',
      '--type=service',
      '--all',
      '--no-pager',
      '--plain',
      '--no-legend',
    ]);

    const services = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          unit: parts[0],
          load: parts[1],
          active: parts[2],
          sub: parts[3],
          description: parts.slice(4).join(' '),
        };
      });

    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Service action: start, stop, restart, enable, disable
router.post('/:name/:action', async (req, res) => {
  const { name, action } = req.params;
  const allowed = ['start', 'stop', 'restart', 'enable', 'disable'];

  if (!allowed.includes(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }

  // Basic validation: service name must be alphanumeric with hyphens/dots
  if (!/^[\w.@-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid service name' });
  }

  try {
    await execFileAsync('systemctl', [action, name]);
    res.json({ success: true, action, service: name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Service status
router.get('/:name/status', async (req, res) => {
  const { name } = req.params;

  if (!/^[\w.@-]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid service name' });
  }

  try {
    const { stdout } = await execFileAsync('systemctl', [
      'show', name,
      '--no-pager',
      '--property=ActiveState,SubState,LoadState,Description,MainPID,MemoryCurrent',
    ]);

    const props = {};
    stdout.trim().split('\n').forEach((line) => {
      const [key, ...rest] = line.split('=');
      props[key] = rest.join('=');
    });

    res.json(props);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
