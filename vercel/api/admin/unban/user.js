const { requireAdmin, normalizeUsername } = require('../../../lib/auth');
const { unbanUser } = require('../../../lib/db');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { username } = req.body || {};
  const u = normalizeUsername(username);
  if (!u) return res.status(400).json({ success: false, error: 'Username required' });

  await unbanUser({ username: u });
  return res.json({ success: true });
};

