## Deploy (Vercel)

Yang di-deploy ke Vercel adalah **backend** di folder `vercel/` (routing di `vercel.json`).

### Admin panel
- Buka: `https://kaycee-extension-6109cjr0o-maul-goats-projects.vercel.app/admin`
- Untuk akses, admin panel memanggil endpoint admin dengan header `X-Admin-Key` (disimpan di localStorage browser admin).

### Database
Jalankan schema ini di Postgres (Supabase):
- `vercel/db/schema.sql`

### Environment variables (set di Vercel, jangan commit ke repo)
- `POSTGRES_URL` (**wajib**) → connection string Postgres dari Supabase (format `postgresql://...`)
- `ADMIN_KEY` (**wajib**) → kunci admin kamu
- `TG_ALLOWED_IDS` (opsional) → `123,456`
- `BYPASS_PAYLOAD` (opsional) → integer payload

Catatan:
- `Supabase Project URL` + `Publishable key` **tidak dipakai** oleh backend ini.
- Jangan taruh `ADMIN_KEY` di file extension / repo.

