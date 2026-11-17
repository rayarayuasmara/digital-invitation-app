# AGENTS.md

Panduan kerja untuk agen AI di repo ini. Balas dalam Bahasa Indonesia; istilah teknis boleh Inggris. Semua teks UI berbahasa Indonesia.

## Isi repo

Aplikasi undangan pernikahan digital RayaRayu. Dua permukaan berbeda:

| Permukaan | Lokasi | Route | Stack |
|---|---|---|---|
| Landing page | `index.html` | `/` | HTML vanila |
| Undangan tamu | `invitation.html` | `/{slug}/{token}`, `/pratinjau/{slug}/{token}` | HTML vanila |
| Dashboard klien | `app/` | `/dashboard`, `/login`, `/register`, `/reset-password`, `/scanner` | React + Vite + TypeScript |

`vercel.json` memetakan route React ke `dashboard.html` hasil build di `app/dist`. `app/dashboard.html` adalah **entry Vite**, bukan file legacy. File `*.legacy` di root hanya arsip lokal dan tidak dilacak git.

## Perintah

```bash
cd app
npm install
cp .env.example .env    # lalu isi dua nilai dari dashboard Supabase
npm run dev             # http://localhost:5173
npm run build           # tsc -b && vite build, lalu copy aset statis
npm run lint            # oxlint
npm run tokens          # regenerate app/src/styles/tokens.css
```

Output build `app/dist`. Di Vercel: `installCommand` = `cd app && npm ci`, `buildCommand` = `cd app && npm run build`.

## Konfigurasi & rahasia

- Variabel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Nilai untuk deploy diset di Vercel untuk Production, Preview, dan Development. Setelah diubah, deployment **harus di-redeploy** — Vercel tidak membangun ulang otomatis.
- `app/.env` hanya untuk lokal dan **tidak dilacak git** (dikeluarkan di `0ebe491`). Jangan commit nilai apa pun.
- Publishable key memang publik karena di-inline ke bundle — bukan kebocoran. Jangan sarankan rotasi tanpa alasan kuat.
- Jangan pernah menampilkan alamat email pengguna, di kode maupun dokumen.

## Database

Project ref `awwraxmftlbekclwdrix`. Riwayat migrasi di `db/` (p0–p11) dan **`db/README.md` adalah sumber kebenaran**. Tabel inti: `clients`, `events`, `guests`, `rsvps`, `tickets`, `wishes`, `event_sessions`, `orders`, `app_settings`.

Hampir semua write lewat RPC `SECURITY DEFINER`, bukan write langsung ke tabel. **Mengubah nama atau parameter RPC memutus frontend tanpa error build** — cari dulu pemanggilnya di `app/src` sebelum menyentuh SQL.

## Alur kerja

1. Audit dulu, usul kemudian, ubah terakhir. Jangan refactor yang tidak diminta.
2. Setiap perubahan lewat branch → push → preview Vercel.
3. **Jangan push ke `main` sebelum pengguna bilang preview aman.** Setelah itu merge `--ff-only`.
4. Perubahan docs-only tanpa dampak build boleh langsung merge setelah dijelaskan.
5. Temuan harus konkret: path file, nomor baris, angka.

## Commit

- Author: `rayarayuasmara <rayarayuasmara@users.noreply.github.com>`
- Trailer: `Co-Authored-By: <nama model> <noreply@anthropic.com>` dan `Claude-Session: <url sesi>`. Ikuti pola commit yang sudah ada di `git log`.

## Batasan lingkungan

- `node_modules` sering tidak terpasang dan instalasi paket bisa diblokir; verifikasi nyata lewat preview Vercel.
- `tsc` global memunculkan error React dan library pihak ketiga. Saring hanya file yang diubah.
- Tidak ada tes otomatis. Logika kuota, check-in, RSVP, dan token belum tertutup.

## Design tokens

`app/src/styles/tokens.css` **generated** — jangan edit manual. `theme.css` hand-written. Urutan import di `main.tsx` penting: foundation → index → tokens → app → theme → tailwind. Jangan hard-code warna atau ukuran brand di CSS komponen.

## Antrean yang belum dikerjakan

1. Audit `get_client_dashboard_data()`: apakah memfilter `auth.uid()`, `search_path` terkunci, dan `client_id` tidak bisa dipalsukan dari frontend.
2. A11y: `inert` pada TabBar saat menu FAB terbuka, `prefers-reduced-motion` untuk `.tabbar-shell`, focus trap + kembalikan fokus ke FAB setelah ditutup.
3. Setelah aksi tamu, `onChanged` memanggil `load()` dan mengambil ulang seluruh dashboard. Optimistic update butuh rollback — bahas perilakunya dulu.
4. Hierarki visual Beranda belum dinilai, perlu dilihat di preview.
5. Belum ada tes untuk kuota, check-in, RSVP, dan token.
6. `docs/` masih menyebut `dashboard.html` yang sudah dihapus — catatan historis, boleh dibiarkan.
