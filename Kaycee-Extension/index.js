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
const { userQueries, deviceQueries, logQueries } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── ADMIN KEY ─────────────────────────────────────────────────────────────
// Set this in your .env file or environment variables!
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
    windowMs: 15 * 60 * 1000,   // 15 min window
    max: 30,                     // 30 attempts per window
    message: { success: false, error: 'Too many requests. Try again later.' }
});

const logLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { success: false, error: 'Rate limit exceeded.' }
});

// ─── HELPER: Normalize username ────────────────────────────────────────────
function normalizeUsername(raw = '') {
    let u = raw.trim();
    if (!u.startsWith('@')) u = '@' + u;
    return u.toLowerCase();
}

// ─── HELPER: Admin middleware ──────────────────────────────────────────────
function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (key !== ADMIN_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

// ─── HELPER: Get real IP ───────────────────────────────────────────────────
function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
}

// ══════════════════════════════════════════════════════════════════════════════
//  PUBLIC ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Kaycee Auth Server', time: new Date().toISOString() });
});

// ── GET /version ─────────────────────────────────────────────────────────────
// Replaces the GitHub raw version.json
app.get('/version', (req, res) => {
    const allBanned = deviceQueries.getAll.all();
    const bannedIds = allBanned.map(b => b.device_id);

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
// Register with TikTok username only — NO password
app.post('/register', authLimiter, (req, res) => {
    try {
        const { username, avatar, device_id } = req.body;

        if (!username || username.trim().length < 2) {
            return res.json({ success: false, error: 'Username is required.' });
        }

        const normalized = normalizeUsername(username);

        // Check if already registered
        const existing = userQueries.findByUsername.get(normalized);
        if (existing) {
            return res.json({ success: false, error: 'USERNAME_EXISTS: This TikTok account is already registered.' });
        }

        // Save new user
        userQueries.create.run(normalized, avatar || null, device_id || null);

        console.log(`[REGISTER] ✅ New user: ${normalized} | IP: ${getIP(req)}`);

        return res.json({ success: true, message: 'Account created successfully!' });

    } catch (err) {
        console.error('[REGISTER ERROR]', err);
        res.json({ success: false, error: 'Server error. Please try again.' });
    }
});

// ── POST /login ──────────────────────────────────────────────────────────────
// Login with TikTok username only — NO password
app.post('/login', authLimiter, (req, res) => {
    try {
        const { username, device_id } = req.body;

        if (!username || username.trim().length < 2) {
            return res.json({ success: false, error: 'Username is required.' });
        }

        const normalized = normalizeUsername(username);

        // Check device ban first
        if (device_id) {
            const bannedDevice = deviceQueries.isBanned.get(device_id);
            if (bannedDevice) {
                return res.json({
                    success: false,
                    error: `BAN: Device access revoked. Reason: ${bannedDevice.reason || 'Policy violation'}`
                });
            }
        }

        // Find user
        const user = userQueries.findByUsername.get(normalized);

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
        userQueries.updateLastLogin.run(device_id || null, normalized);

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
// Used by content.js to check if currently logged-in TikTok user is banned
app.post('/check_shield', (req, res) => {
    try {
        const { username, device_id } = req.body;

        if (!username) {
            return res.json({ isBanned: false });
        }

        const normalized = normalizeUsername(username);
        const user = userQueries.findByUsername.get(normalized);

        if (user && user.is_banned) {
            return res.json({
                isBanned: true,
                reason: user.ban_reason || 'Access denied by administrator.'
            });
        }

        // Check device ban
        if (device_id) {
            const bannedDevice = deviceQueries.isBanned.get(device_id);
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
// Replaces the Telegram/Cloudflare log worker
app.post('/log', logLimiter, (req, res) => {
    try {
        const { username, userId, action, details, version } = req.body;
        const ip = getIP(req);

        logQueries.insert.run(
            username || 'Anonymous',
            userId   || null,
            action   || 'UNKNOWN',
            details  || '',
            version  || '?',
            ip
        );

        console.log(`[LOG] ${username || 'Anon'} | ${action} | ${details}`);
        res.json({ success: true });

    } catch (err) {
        console.error('[LOG ERROR]', err);
        res.json({ success: false });
    }
});

// ── GET /api/analyze ─────────────────────────────────────────────────────────
// Proxy for TikTok user video data (replaces old onrender.com server)
app.get('/api/analyze', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json({ success: false, error: 'Username required' });

        const clean = username.replace('@', '');
        const url = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(clean)}&count=35&cursor=0`;

        const fetch = require('node-fetch');
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
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


// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN ENDPOINTS  (require X-Admin-Key header)
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /admin/users ─────────────────────────────────────────────────────────
app.get('/admin/users', requireAdmin, (req, res) => {
    const users = userQueries.getAllUsers.all();
    res.json({ success: true, count: users.length, users });
});

// ── GET /admin/logs ──────────────────────────────────────────────────────────
app.get('/admin/logs', requireAdmin, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const logs = logQueries.getRecent.all(limit);
    res.json({ success: true, count: logs.length, logs });
});

// ── POST /admin/ban/user ──────────────────────────────────────────────────────
app.post('/admin/ban/user', requireAdmin, (req, res) => {
    const { username, reason } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });

    const normalized = normalizeUsername(username);
    const user = userQueries.findByUsername.get(normalized);
    if (!user) return res.json({ success: false, error: 'User not found' });

    userQueries.ban.run(reason || 'Banned by admin', normalized);
    console.log(`[ADMIN] Banned user: ${normalized}`);
    res.json({ success: true, message: `User ${normalized} banned.` });
});

// ── POST /admin/unban/user ────────────────────────────────────────────────────
app.post('/admin/unban/user', requireAdmin, (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });

    const normalized = normalizeUsername(username);
    userQueries.unban.run(normalized);
    console.log(`[ADMIN] Unbanned user: ${normalized}`);
    res.json({ success: true, message: `User ${normalized} unbanned.` });
});

// ── POST /admin/ban/device ────────────────────────────────────────────────────
app.post('/admin/ban/device', requireAdmin, (req, res) => {
    const { device_id, reason } = req.body;
    if (!device_id) return res.json({ success: false, error: 'device_id required' });

    deviceQueries.ban.run(device_id, reason || 'Banned by admin');
    console.log(`[ADMIN] Banned device: ${device_id}`);
    res.json({ success: true, message: `Device ${device_id} banned.` });
});

// ── POST /admin/unban/device ──────────────────────────────────────────────────
app.post('/admin/unban/device', requireAdmin, (req, res) => {
    const { device_id } = req.body;
    if (!device_id) return res.json({ success: false, error: 'device_id required' });

    deviceQueries.unban.run(device_id);
    console.log(`[ADMIN] Unbanned device: ${device_id}`);
    res.json({ success: true, message: `Device ${device_id} unbanned.` });
});

// ── DELETE /admin/user ────────────────────────────────────────────────────────
app.delete('/admin/user', requireAdmin, (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, error: 'Username required' });

    const normalized = normalizeUsername(username);
    userQueries.deleteUser.run(normalized);
    console.log(`[ADMIN] Deleted user: ${normalized}`);
    res.json({ success: true, message: `User ${normalized} deleted.` });
});

// ── GET /admin/dashboard ──────────────────────────────────────────────────────
app.get('/admin/dashboard', requireAdmin, (req, res) => {
    const users        = userQueries.getAllUsers.all();
    const bannedDevs   = deviceQueries.getAll.all();
    const recentLogs   = logQueries.getRecent.all(20);
    const totalUsers   = users.length;
    const bannedUsers  = users.filter(u => u.is_banned).length;
    const activeToday  = users.filter(u => u.last_login && u.last_login.startsWith(new Date().toISOString().slice(0,10))).length;

    res.json({
        success: true,
        stats: {
            total_users: totalUsers,
            banned_users: bannedUsers,
            active_today: activeToday,
            banned_devices: bannedDevs.length
        },
        users,
        banned_devices: bannedDevs,
        recent_logs: recentLogs
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
║  Admin  : set ADMIN_KEY env variable         ║
╚══════════════════════════════════════════════╝
`);
    console.log(`Health  → http://localhost:${PORT}/health`);
    console.log(`Version → http://localhost:${PORT}/version`);
    console.log(`Admin   → http://localhost:${PORT}/admin/dashboard  (requires X-Admin-Key)`);
});
