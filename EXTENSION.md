## Extension (Chrome MV3)

File extension ada di folder `extension/`:
- `extension/manifest.json`
- `extension/background.js`
- `extension/content.js`
- `extension/inject.js`
- `extension/popup.html`
- `extension/popup.js`

Cara pakai:
- buka `chrome://extensions`
- aktifkan **Developer mode**
- klik **Load unpacked**
- pilih folder `extension/`

Endpoint backend yang dipakai extension (base URL sekarang `https://kaycee-extension-6109cjr0o-maul-goats-projects.vercel.app`):
- `POST /login`
- `POST /register` (masih ada, tapi backend sekarang auto-create juga)
- `POST /check_shield`
- `POST /log`
- `GET  /api/analyze`
- `POST /verify-tg`
- `POST /get_bypass_config`

Backend Vercel-nya ada di folder `vercel/` dan routingnya di `vercel.json`.

