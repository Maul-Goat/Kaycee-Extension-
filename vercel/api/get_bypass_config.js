module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });

  const payloadRaw = process.env.BYPASS_PAYLOAD;
  const payload = payloadRaw == null ? null : Number(payloadRaw);

  if (!Number.isFinite(payload)) {
    return res.json({ success: false, error: 'BYPASS_PAYLOAD_NOT_CONFIGURED' });
  }

  return res.json({ success: true, payload: Math.floor(payload) });
};

