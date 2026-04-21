function normalizeUsername(raw = '') {
  let u = String(raw).trim();
  if (!u) return '';
  if (!u.startsWith('@')) u = '@' + u;
  return u.toLowerCase();
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function requireAdmin(req) {
  const key = req.headers['x-admin-key'] || new URL(req.url, 'http://localhost').searchParams.get('key');
  const adminKey = process.env.ADMIN_KEY;
  return Boolean(adminKey && key && key === adminKey);
}

module.exports = { normalizeUsername, getClientIp, requireAdmin };

