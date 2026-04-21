const { getClientIp } = require('../lib/auth');
const { insertLog } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  try {
    const { username, userId, user_id, action, details, version } = req.body || {};
    await insertLog({
      username,
      userId: userId || user_id || null,
      action,
      details,
      version,
      ip: getClientIp(req),
    });
    return res.json({ success: true });
  } catch {
    return res.json({ success: false });
  }
};

