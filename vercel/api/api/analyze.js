module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const username = (req.query && req.query.username) || '';
    if (!username) return res.status(400).json({ success: false, error: 'Username required' });

    const clean = String(username).replace('@', '');
    const url = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(clean)}&count=35&cursor=0`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const json = await response.json();

    if (json.code !== 0 || !json.data) return res.json({ success: false, error: 'USER_NOT_FOUND' });

    const videos = (json.data.videos || []).map((v) => ({
      id: v.video_id,
      title: v.title || '',
      cover: v.cover,
      views: v.play_count || 0,
      likes: v.digg_count || 0,
      comments: v.comment_count || 0,
      shares: v.share_count || 0,
      playUrl: v.play || v.wmplay || '',
      create_time: v.create_time || 0,
    }));

    return res.json({ success: true, video_count: videos.length, data: videos });
  } catch {
    return res.json({ success: false, error: 'SERVER_OFFLINE' });
  }
};

