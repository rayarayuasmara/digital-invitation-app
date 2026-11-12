# digital-invitation-app

Undangan pernikahan digital RayaRayu. Repo ini punya dua lapis:

| Lapis | Lokasi | Status |
|---|---|---|
| **React (aktif)** | `app/` | Migrasi yang dilanjutkan. Vite + React + Arc UI |
| HTML vanila (acuan) | root: `index.html`, `dashboard.html`, `invitation.html`, `scanner.html` | Versi live saat ini, disimpan sebagai acuan migrasi |

Arsip HTML lama tambahan ada di `index.html.legacy` dan
`dashboard.html.legacy` (lokal, tidak masuk git).

## Menjalankan app React

```bash
cd app
npm install
npm run dev     # http://localhost:5173
npm run build   # cek tipe + build produksi
```

Konfigurasi Supabase ada di `app/.env`
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).

## Acuan HTML vanila

| File | URL | Isi |
|---|---|---|
| `index.html` | `/` | Landing page |
| `dashboard.html` | `/dashboard` | Panel klien (login) |
| `dashboard.html` | `/login` | Form masuk |
| `dashboard.html` | `/register` | Form daftar |
| `dashboard.html` | `/reset-password` | Form password baru (dari email reset) |
| `scanner.html` | `/scanner` | Check-in petugas (kode akses) |
| `invitation.html` | `/{slug}/{token}` | Undangan tamu |
| `invitation.html` | `/pratinjau/{slug}/{token}` | Pratinjau undangan |

Deploy live masih memakai halaman statis dari branch `main` dan rewrite di
`vercel.json` root. Build React di `app/` belum diarahkan ke konfigurasi
Vercel.

Perubahan database (policy, RPC, index, token) dicatat di
[`db/README.md`](db/README.md) — baca itu sebelum menyentuh Supabase.

## Sebelum mengubah

- Frontend memanggil Supabase langsung. Nama dan parameter RPC adalah kontrak
  API; mengubahnya memutus halaman tanpa error build.
- Jangan menambah policy `using (true)` untuk role `public` pada tabel mana pun.
- `opencode.json` memuat token GitHub dan tidak masuk git.
- Satu akun klien bisa punya lebih dari satu acara. Dashboard menyediakan
  pemilih acara; lihat [`db/README.md`](db/README.md) bagian "Banyak acara per
  klien".
