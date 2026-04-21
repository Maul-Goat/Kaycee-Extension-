const { normalizeUsername, getClientIp } = require('../lib/auth');
const { getUserByUsername, isDeviceBanned, upsertUserLogin, insertLog } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { username, avatar, device_id, deviceId, userId } = req.body || {};
    const normalized = normalizeUsername(username);
    const device = device_id || deviceId || userId || null;

    if (!normalized || normalized.length < 2) {
      return res.status(400).json({ success: false, error: 'Username is required.' });
    }

    const bannedDevice = await isDeviceBanned(device);
    if (bannedDevice) {
      return res.json({
        success: false,
        error: `BAN: Device access revoked. Reason: ${bannedDevice.reason || 'Policy violation'}`,
      });
    }

    const existing = await getUserByUsername(normalized);
    if (existing?.is_banned) {
      return res.json({ success: false, error: `BAN: ${existing.ban_reason || 'Access denied by administrator.'}` });
    }

    const user = await upsertUserLogin({ username: normalized, avatar, deviceId: device });

    // optional audit log
    await insertLog({
      username: user.username,
      userId: device,
      action: existing ? 'LOGIN' : 'AUTO_REGISTER',
      details: existing ? 'Login via username-only flow' : 'Account auto-created on first login',
      version: req.headers['x-client-version'] || '?',
      ip: getClientIp(req),
    }).catch(() => {});

    return res.json({ success: true, username: user.username, avatar: user.avatar || '' });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
};

