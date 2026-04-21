const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

// Konfigurasi Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ADMIN_KEY = process.env.ADMIN_KEY || 'kaycee-admin-secret-change-me';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const logLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

function normalizeUsername(raw = '') {
    let u = raw.trim();
    if (!u.startsWith('@')) u = '@' + u;
    return u.toLowerCase();
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Kaycee Auth Server (Vercel+Supabase)' });
});

// GET /version (Cek device ban global)
app.get('/version', async (req, res) => {
    const { data: bannedDevs } = await supabase.from('banned_devices').select('device_id');
    const bannedIds = bannedDevs ? bannedDevs.map(b => b.device_id) : [];
    
    res.json({
        version: '1.0.0',
        min_version: '1.0.0',
        status: 'active',
        banned_ids: bannedIds,
        ban_reason: 'Violation of System Policies.'
    });
});

// POST /register
app.post('/register', authLimiter, async (req, res) => {
    const { username, avatar, device_id } = req.body;
    if (!username || username.trim().length < 2) return res.json({ success: false, error: 'Username is required.' });

    const normalized = normalizeUsername(username);
    
    // Cek user exists
    const { data: existing } = await supabase.from('users').select('*').eq('username', normalized).single();
    if (existing) return res.json({ success: false, error: 'USERNAME_EXISTS: This account is already registered.' });

    // Insert user
    const { error } = await supabase.from('users').insert([{ 
        username: normalized, avatar, device_id 
    }]);

    if (error) return res.json({ success: false, error: 'Server error. Please try again.' });
    return res.json({ success: true, message: 'Account created successfully!' });
});

// POST /login
app.post('/login', authLimiter, async (req, res) => {
    const { username, device_id } = req.body;
    if (!username || username.trim().length < 2) return res.json({ success: false, error: 'Username is required.' });

    const normalized = normalizeUsername(username);

    // Cek Device Ban
    if (device_id) {
        const { data: bannedDevice } = await supabase.from('banned_devices').select('*').eq('device_id', device_id).single();
        if (bannedDevice) return res.json({ success: false, error: `BAN: ${bannedDevice.reason || 'Device access revoked.'}` });
    }

    // Cek User
    const { data: user } = await supabase.from('users').select('*').eq('username', normalized).single();
    if (!user) return res.json({ success: false, error: 'NOT_FOUND: Username not registered.' });
    if (user.is_banned) return res.json({ success: false, error: `BAN: ${user.ban_reason || 'Access denied.'}` });

    // Update last_login
    await supabase.from('users').update({ last_login: new Date().toISOString(), device_id }).eq('username', normalized);

    return res.json({ success: true, username: user.username, avatar: user.avatar || '' });
});

// POST /log
app.post('/log', logLimiter, async (req, res) => {
    const { username, userId, action, details, version } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    
    await supabase.from('logs').insert([{ 
        username: username || 'Anonim', user_id: userId, action, details, version, ip 
    }]);
    res.json({ success: true });
});

// POST /check_shield
app.post('/check_shield', async (req, res) => {
    const { username, device_id } = req.body;
    if (!username) return res.json({ isBanned: false });

    const normalized = normalizeUsername(username);
    const { data: user } = await supabase.from('users').select('is_banned, ban_reason').eq('username', normalized).single();
    
    if (user && user.is_banned) return res.json({ isBanned: true, reason: user.ban_reason });

    if (device_id) {
        const { data: bannedDevice } = await supabase.from('banned_devices').select('reason').eq('device_id', device_id).single();
        if (bannedDevice) return res.json({ isBanned: true, reason: bannedDevice.reason });
    }

    return res.json({ isBanned: false });
});

module.exports = app;
