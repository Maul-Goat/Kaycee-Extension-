module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  try {
    const { tg_id } = req.body || {};
    const raw = process.env.TG_ALLOWED_IDS || '';
    const allowed = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!allowed.length) {
      // default deny if not configured
      return res.json({ success: false, error: 'TG_ALLOWLIST_NOT_CONFIGURED' });
    }

    const ok = allowed.includes(String(tg_id || '').trim());
    return res.json({ success: ok });
  } catch {
    return res.json({ success: false });
  }
};

