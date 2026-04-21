/**
 * ╔══════════════════════════════════════════════════╗
 * ║         KAYCEE EXTENSION - AUTH SERVER           ║
 * ║         Username-only authentication             ║
 * ╚══════════════════════════════════════════════════╝
 */

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const fetch      = require('node-fetch');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── KONFIGURASI SUPABASE (VERCEL ENV VARIABLES) ───────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── ADMIN KEY ─────────────────────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || 'kaycee-admin-secret-change-me';

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin: ['chrome-extension://*', '*'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Admin-Key']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── RATE LIMITERS ─────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, error: 'Too many requests. Try again later.' }
});

const logLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, error: 'Rate limit exceeded.' }
});

// ─── HELPERS ───────────────────────────────────────────────────────────────
function normalizeUsername(raw = '') {
    let u = raw.trim();
    if (!u.startsWith('@')) u = '@' + u;
    return u.toLowerCase();
}

function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (key !== ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Kaycee Auth Server (Supabase)', time: new Date().toISOString() });
});

// ── GET /version ─────────────────────────────────────────────────────────────
app.get('/version', async (req, res) => {
    const { data: bannedDevs } = await supabase.from('banned_devices').select('device_id');
    const bannedIds = bannedDevs ? bannedDevs.map(b => b.device_id) : [];

    res.json({
        version: '1.0.0',
        min_version: '1.0.0',
        status: 'active',
        message: '',
        banned_ids: bannedIds,
        ban_reason: 'Violation of Kaycee Extension Terms of Service.'
    });
});

// ── POST /register ───────────────────────────────────────────────────────────
app.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, avatar, device_id } = req.body;

        if (!username || username.trim().length < 2) {
            return res.json({ success: false, error: 'Username is required.' });
        }

        const normalized = normalizeUsername(username);

        // Check if already registered
        const { data: existing } = await supabase.from('users').select('id').eq('username', normalized).single();
        if (existing) {
            return res.json({ success: false, error: 'USERNAME_EXISTS: This TikTok account is already registered.' });
        }

        // Save new user
        const { error } = await supabase.from('users').insert([{ 
            username: normalized, 
            avatar: avatar || null, 
            device_id: device_id || null 
        }]);

        if (error) {
            console.error('[REGISTER ERROR]', error);
            return res.json({ success: false, error: 'Server error. Please try again.' });
        }

        console.log(`[REGISTER] ✅ New user: ${normalized} | IP: ${getIP(req)}`);
        return res.json({ success: true, message: 'Account created successfully!' });

    } catch (err) {
        console.error('[REGISTER ERROR]', err);
        res.json({ success: false, error: 'Server error. Please try again.' });
    }
});

// ── POST /login ──────────────────────────────────────────────────────────────
app.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, device_id } = req.body;

        if (!username || username.trim().length < 2) {
            return res.json({ success: false, error: 'Username is required.' });
        }

        const normalized = normalizeUsername(username);

        // Check device ban first
        if (device_id) {
            const { data: bannedDevice } = await supabase.from('banned_devices').select('*').eq('device_id', device_id).single();
            if (bannedDevice) {
                return res.json({
                    success: false,
                    error: `BAN: Device access revoked. Reason: ${bannedDevice.reason || 'Policy violation'}`
                });
            }
        }

        // Find user
        const { data: user } = await supabase.from('users').select('*').eq('username', normalized).single();

        if (!user) {
            return res.json({ success: false, error: 'NOT_FOUND: Username not registered. Please create an account first.' });
        }

        // Check if user-level banned
        if (user.is_banned) {
            return res.json({
                success: false,
                error: `BAN: ${user.ban_reason || 'Access denied by administrator.'}`
            });
        }

        // Update last login
        await supabase.from('users').update({ 
            last_login: new Date().toISOString(), 
            device_id: device_id || null 
        }).eq('username', normalized);

        console.log(`[LOGIN] ✅ ${normalized} | IP: ${getIP(req)}`);

        return res.json({
            success: true,
            username: user.username,
            avatar: user.avatar || ''
        });

    } catch (err) {
        console.error('[LOGIN ERROR]', err);
        res.json({ success: false, error: 'Server error. Please try again.' });
    }
});

// ── POST /check_shield ───────────────────────────────────────────────────────
app.post('/check_shield', async (req, res) => {
    try {
        const { username, device_id } = req.body;

        if (!username) return res.json({ isBanned: false });

        const normalized = normalizeUsername(username);
        const { data: user } = await supabase.from('users').select('is_banned, ban_reason').eq('username', normalized).single();

        if (user && user.is_banned) {
            return res.json({
                isBanned: true,
                reason: user.ban_reason || 'Access denied by administrator.'
            });
        }

        // Check device ban
        if (device_id) {
            const { data: bannedDevice } = await supabase.from('banned_devices').select('reason').eq('device_id', device_id).single();
            if (bannedDevice) {
                return res.json({
                    isBanned: true,
                    reason: bannedDevice.reason || 'Device access revoked.'
                });
            }
        }

        return res.json({ isBanned: false });

    } catch (err) {
        console.error('[SHIELD ERROR]', err);
        res.json({ isBanned: false });
    }
});

// ── POST /log ────────────────────────────────────────────────────────────────
app.post('/log', logLimiter, async (req, res) => {
    try {
        const { username, userId, action, details, version } = req.body;
        const ip = getIP(req);

        await supabase.from('logs').insert([{ 
            username: username || 'Anonymous', 
            user_id: userId || null, 
            action: action || 'UNKNOWN', 
            details: details || '', 
            version: version || '?', 
            ip 
        }]);

        console.log(`[LOG] ${username || 'Anon'} | ${action} | ${details}`);
        res.json({ success: true });

    } catch (err) {
        console.error('[LOG ERROR]', err);
        res.json({ success: false });
    }
});

// ── GET /api/analyze ─────────────────────────────────────────────────────────
app.get('/api/analyze', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json({ success: false, error: 'Username required' });

        const clean = username.replace('@', '');
        const url = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(clean)}&count=35&cursor=0`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 15000
        });

        const json = await response.json();

        if (json.code !== 0 || !json.data) {
            return res.json({ success: false, error: 'USER_NOT_FOUND' });
        }

        const videos = (json.data.videos || []).map(v => ({
            id: v.video_id,
            title: v.title || '',
            cover: v.cover,
            views: v.play_count || 0,
            likes: v.digg_count || 0,
            comments: v.comment_count || 0,
            shares: v.share_count || 0,
            playUrl: v.play || v.wmplay || '',
            create_time: v.create_time || 0
        }));

        res.json({ success: true, video_count: videos.length, data: videos });

    } catch (err) {
        console.error('[ANALYZE ERROR]', err.message);
        res.json({ success: false, error: 'SERVER_OFFLINE' });
    }
});

// ── POST /get_bypass_config (NEW BYPASS ENGINE) ──────────────────────────────
app.post('/get_bypass_config', (req, res) => {
    res.json({ success: true, payload: 120 });
});


// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ENDPOINTS  (require X-Admin-Key header)
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /admin/users ─────────────────────────────────────────────────────────
app.get('/admin/users', requireAdmin, async (req, res) => {
    const { data: users } = await supabase.from('users').select('*');
    res.json({ success: true, count: users ? users.length : 0, users: users || [] });
});

// ── GET /admin/logs ──────────────────────────────────────────────────────────
app.get('/admin/logs', requireAdmin, async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const { data: logs } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
    res.json({ success: true, count: logs ? logs.length : 0, logs: logs || [] });
});

// ── POST /admin/ban/user ──────────────────────────────────────────────────────
app.post('/admin/ban/user', requireAdmin, async (req, res) => {
    const { username, reason } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });

    const normalized = normalizeUsername(username);
    
    const { error } = await supabase.from('users').update({ 
        is_banned: true, ban_reason: reason || 'Banned by admin' 
    }).eq('username', normalized);

    if (error) return res.json({ success: false, error: 'Database error' });

    console.log(`[ADMIN] Banned user: ${normalized}`);
    res.json({ success: true, message: `User ${normalized} banned.` });
});

// ── POST /admin/unban/user ────────────────────────────────────────────────────
app.post('/admin/unban/user', requireAdmin, async (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });

    const normalized = normalizeUsername(username);
    
    await supabase.from('users').update({ is_banned: false, ban_reason: null }).eq('username', normalized);
    
    console.log(`[ADMIN] Unbanned user: ${normalized}`);
    res.json({ success: true, message: `User ${normalized} unbanned.` });
});

// ── POST /admin/ban/device ────────────────────────────────────────────────────
app.post('/admin/ban/device', requireAdmin, async (req, res) => {
    const { device_id, reason } = req.body;
    if (!device_id) return res.json({ success: false, error: 'device_id required' });

    // Upsert to create or update if exists
    await supabase.from('banned_devices').upsert({ 
        device_id: device_id, reason: reason || 'Banned by admin' 
    });

    console.log(`[ADMIN] Banned device: ${device_id}`);
    res.json({ success: true, message: `Device ${device_id} banned.` });
});

// ── POST /admin/unban/device ──────────────────────────────────────────────────
app.post('/admin/unban/device', requireAdmin, async (req, res) => {
    const { device_id } = req.body;
    if (!device_id) return res.json({ success: false, error: 'device_id required' });

    await supabase.from('banned_devices').delete().eq('device_id', device_id);
    
    console.log(`[ADMIN] Unbanned device: ${device_id}`);
    res.json({ success: true, message: `Device ${device_id} unbanned.` });
});

// ── DELETE /admin/user ────────────────────────────────────────────────────────
app.delete('/admin/user', requireAdmin, async (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });

    const normalized = normalizeUsername(username);
    await supabase.from('users').delete().eq('username', normalized);
    
    console.log(`[ADMIN] Deleted user: ${normalized}`);
    res.json({ success: true, message: `User ${normalized} deleted.` });
});

// ── GET /admin/dashboard ──────────────────────────────────────────────────────
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
    const { data: users } = await supabase.from('users').select('*');
    const { data: bannedDevs } = await supabase.from('banned_devices').select('*');
    const { data: recentLogs } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(20);
    
    const totalUsers = users ? users.length : 0;
    const bannedUsers = users ? users.filter(u => u.is_banned).length : 0;
    const today = new Date().toISOString().slice(0, 10);
    const activeToday = users ? users.filter(u => u.last_login && u.last_login.startsWith(today)).length : 0;

    res.json({
        success: true,
        stats: {
            total_users: totalUsers,
            banned_users: bannedUsers,
            active_today: activeToday,
            banned_devices: bannedDevs ? bannedDevs.length : 0
        },
        users: users || [],
        banned_devices: bannedDevs || [],
        recent_logs: recentLogs || []
    });
});

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ─── START ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║        KAYCEE AUTH SERVER RUNNING            ║
║  Port   : ${PORT}                                ║
║  DB     : SUPABASE DETECTED                  ║
╚══════════════════════════════════════════════╝
`);
});

module.exports = app;
