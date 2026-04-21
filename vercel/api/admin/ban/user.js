const { requireAdmin, normalizeUsername } = require('../../../lib/auth');
const { getUserByUsername, banUser } = require('../../../lib/db');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { username, reason } = req.body || {};
  const u = normalizeUsername(username);
  if (!u) return res.status(400).json({ success: false, error: 'Username required' });

  const existing = await getUserByUsername(u);
  if (!existing) return res.status(404).json({ success: false, error: 'User not found' });

  await banUser({ username: u, reason });
  return res.json({ success: true });
};

