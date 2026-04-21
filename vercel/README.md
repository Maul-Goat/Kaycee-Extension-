## Vercel (Backend + Admin)

Folder `vercel/` ini berisi backend yang akan kamu deploy ke **Vercel**.

### Yang disediakan
- Endpoint publik (dipakai extension):
  - `POST /login` (auto-create user jika belum ada)
  - `POST /register` (compat; sama seperti login)
  - `POST /check_shield`
  - `POST /log`
  - `GET  /api/analyze`
  - `POST /verify-tg` (berbasis allowlist env)
  - `POST /get_bypass_config` (payload dari env)
- Endpoint admin:
  - `GET  /admin` (halaman web admin)
  - `GET  /api/admin/users`
  - `GET  /api/admin/logs`
  - `POST /api/admin/ban/user`
  - `POST /api/admin/unban/user`
  - `POST /api/admin/ban/device`
  - `POST /api/admin/unban/device`

### Environment variables (Vercel → Project Settings → Environment Variables)
- `POSTGRES_URL`: connection string Postgres (Vercel Postgres / Neon / Supabase, dll)
- `ADMIN_KEY`: kunci admin untuk akses endpoint admin (wajib diganti)
- `TG_ALLOWED_IDS`: (opsional) daftar tg id dipisah koma, contoh: `12345,67890`
- `BYPASS_PAYLOAD`: (opsional) angka integer untuk payload bypass

### Setup database
Jalankan SQL di `vercel/db/schema.sql` di database Postgres-mu.

