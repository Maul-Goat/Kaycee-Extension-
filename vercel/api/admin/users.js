const { requireAdmin } = require('../../lib/auth');
const { listUsers } = require('../../lib/db');

module.exports = async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const users = await listUsers();
  return res.json({ success: true, count: users.length, users });
};

