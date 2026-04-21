-- Enable UUID generation (matches your schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Buat tabel users
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    avatar TEXT,
    device_id TEXT,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buat tabel banned_devices
CREATE TABLE IF NOT EXISTS banned_devices (
    device_id TEXT PRIMARY KEY,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buat tabel logs
CREATE TABLE IF NOT EXISTS logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    username TEXT DEFAULT 'Anonim',
    user_id TEXT,
    action TEXT,
    details TEXT,
    version TEXT,
    ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

