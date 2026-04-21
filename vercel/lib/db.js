const { sql } = require('@vercel/postgres');

async function getUserByUsername(username) {
  const { rows } = await sql`
    SELECT id, username, avatar, device_id, is_banned, ban_reason, last_login, created_at
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function isDeviceBanned(deviceId) {
  if (!deviceId) return null;
  const { rows } = await sql`
    SELECT device_id, reason, created_at
    FROM banned_devices
    WHERE device_id = ${deviceId}
    LIMIT 1
  `;
  return rows[0] || null;
}

async function upsertUserLogin({ username, avatar, deviceId }) {
  const { rows } = await sql`
    INSERT INTO users (username, avatar, device_id, last_login)
    VALUES (${username}, ${avatar || null}, ${deviceId || null}, NOW())
    ON CONFLICT (username) DO UPDATE
      SET avatar     = COALESCE(EXCLUDED.avatar, users.avatar),
          device_id  = COALESCE(EXCLUDED.device_id, users.device_id),
          last_login = NOW()
    RETURNING id, username, avatar, device_id, is_banned, ban_reason, last_login, created_at
  `;
  return rows[0];
}

async function insertLog({ username, userId, action, details, version, ip }) {
  await sql`
    INSERT INTO logs (username, user_id, action, details, version, ip)
    VALUES (${username || 'Anonim'}, ${userId || null}, ${action || 'UNKNOWN'}, ${details || ''}, ${version || '?'}, ${ip || 'unknown'})
  `;
}

async function listUsers() {
  const { rows } = await sql`
    SELECT id, username, avatar, device_id, is_banned, ban_reason, last_login, created_at
    FROM users
    ORDER BY created_at DESC
  `;
  return rows;
}

async function listLogs(limit = 100) {
  const lim = Number.isFinite(limit) ? Math.max(1, Math.min(1000, limit)) : 100;
  const { rows } = await sql`
    SELECT id, username, user_id, action, details, version, ip, created_at
    FROM logs
    ORDER BY created_at DESC
    LIMIT ${lim}
  `;
  return rows;
}

async function banUser({ username, reason }) {
  await sql`
    UPDATE users
    SET is_banned = TRUE, ban_reason = ${reason || 'Banned by admin'}
    WHERE username = ${username}
  `;
}

async function unbanUser({ username }) {
  await sql`
    UPDATE users
    SET is_banned = FALSE, ban_reason = NULL
    WHERE username = ${username}
  `;
}

async function banDevice({ deviceId, reason }) {
  await sql`
    INSERT INTO banned_devices (device_id, reason)
    VALUES (${deviceId}, ${reason || 'Banned by admin'})
    ON CONFLICT (device_id) DO UPDATE
      SET reason = EXCLUDED.reason
  `;
}

async function unbanDevice({ deviceId }) {
  await sql`DELETE FROM banned_devices WHERE device_id = ${deviceId}`;
}

module.exports = {
  getUserByUsername,
  isDeviceBanned,
  upsertUserLogin,
  insertLog,
  listUsers,
  listLogs,
  banUser,
  unbanUser,
  banDevice,
  unbanDevice,
};

