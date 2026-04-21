const { requireAdmin } = require('../../lib/auth');
const { listLogs } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const limit = parseInt(req.query?.limit || '100', 10);
  const logs = await listLogs(limit);
  return res.json({ success: true, count: logs.length, logs });
};

