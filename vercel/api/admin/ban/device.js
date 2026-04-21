const { requireAdmin } = require('../../../lib/auth');
const { banDevice } = require('../../../lib/db');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { device_id, deviceId, reason } = req.body || {};
  const id = device_id || deviceId;
  if (!id) return res.status(400).json({ success: false, error: 'device_id required' });

  await banDevice({ deviceId: String(id), reason });
  return res.json({ success: true });
};

