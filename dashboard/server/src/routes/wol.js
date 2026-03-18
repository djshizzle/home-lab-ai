const express = require('express');
const wol = require('wake_on_lan');

const router = express.Router();

// Send Wake-on-LAN magic packet
router.post('/wake', (req, res) => {
  const { mac, address } = req.body;

  if (!mac || !/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac)) {
    return res.status(400).json({ error: 'Invalid MAC address' });
  }

  const opts = {};
  if (address) opts.address = address;

  wol.wake(mac, opts, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, mac, message: `WoL packet sent to ${mac}` });
  });
});

module.exports = router;
