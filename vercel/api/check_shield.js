const { normalizeUsername } = require('../lib/auth');
const { getUserByUsername, isDeviceBanned } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ isBanned: false });

  try {
    const { username, device_id, deviceId, userId } = req.body || {};
    const normalized = username ? normalizeUsername(username) : '';
    const device = device_id || deviceId || userId || null;

    if (normalized) {
      const user = await getUserByUsername(normalized);
      if (user?.is_banned) {
        return res.json({ isBanned: true, reason: user.ban_reason || 'Access denied by administrator.' });
      }
    }

    const bannedDevice = await isDeviceBanned(device);
    if (bannedDevice) {
      return res.json({ isBanned: true, reason: bannedDevice.reason || 'Device access revoked.' });
    }

    return res.json({ isBanned: false });
  } catch {
    return res.json({ isBanned: false });
  }
};

