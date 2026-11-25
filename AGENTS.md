# AGENTS.md

Panduan kerja untuk agen AI di repo ini. Balas dalam Bahasa Indonesia; istilah teknis boleh Inggris. Semua teks UI berbahasa Indonesia.

## Isi repo

Aplikasi undangan pernikahan digital RayaRayu. Semua halaman memakai Next.js App Router:

| Permukaan | Lokasi | Route | Stack |
|---|---|---|---|
| Landing page | `app/(marketing)/` | `/` | React + Tailwind |
| Undangan tamu | `app/(invitation)/`, `src/features/invitation/` | `/{slug}/{token}`, `/pratinjau/{slug}/{token}` | React + CSS |
| Dashboard klien | `app/(dashboard)/`, `src/screens/` | `/dashboard`, `/login`, `/register`, `/reset-password`, `/scanner` | React + Arc UI + Tailwind |

`app/` hanya berisi route dan layout. Konfigurasi proyek dan `package.json` ada di root repo. Layout tiap kelompok terpisah agar CSS global landing, undangan, dan dashboard tidak bertabrakan. File `*.legacy` hanya arsip lokal dan tidak dilacak git.

## Perintah

```bash
npm ci
cp .env.example .env.local  # lalu isi dua nilai dari dashboard Supabase
npm run dev                 # http://localhost:3000
npm run typecheck            # next typegen lalu tsc --noEmit
npm run build                # build produksi + cek tipe
npm run lint            # oxlint
npm run tokens          # regenerate src/styles/tokens.css
```

Output build `.next/`. Di Vercel gunakan root repo (`.`) dan preset Next.js tanpa override Vite.

## Konfigurasi & rahasia

- Variabel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `NEXT_PUBLIC_APP_URL` (opsional).
- Nilai untuk deploy diset di Vercel untuk Production, Preview, dan Development. Setelah diubah, deployment **harus di-redeploy** — Vercel tidak membangun ulang otomatis.
- `.env.local` di root hanya untuk lokal dan **tidak dilacak git**. Jangan commit nilai apa pun.
- Publishable key memang publik karena di-inline ke bundle — bukan kebocoran. Jangan sarankan rotasi tanpa alasan kuat.
- Jangan pernah menampilkan alamat email pengguna, di kode maupun dokumen.

## Database

Project ref `awwraxmftlbekclwdrix`. Riwayat migrasi di `db/` (p0–p11) dan **`db/README.md` adalah sumber kebenaran**. Tabel inti: `clients`, `events`, `guests`, `rsvps`, `tickets`, `wishes`, `event_sessions`, `orders`, `app_settings`.

Hampir semua write lewat RPC `SECURITY DEFINER`, bukan write langsung ke tabel. **Mengubah nama atau parameter RPC memutus frontend tanpa error build** — cari dulu pemanggilnya di `src/` sebelum menyentuh SQL.

## Preview lokal (gerbang utama)

```bash
npm run dev -- --hostname 0.0.0.0
```

- Di Mac: `http://localhost:3000/dashboard`
- Di HP (Wi-Fi yang sama): `http://<IP-LAN-Mac>:3000/dashboard`, contoh `http://192.168.1.6:3000/dashboard`.
   Cek IP dengan `ipconfig getifaddr en0`; isi `NEXT_DEV_ALLOWED_ORIGINS` di `.env.local` dengan IP itu (tanpa skema atau port), lalu restart dev server. Perbarui jika IP berubah.
- macOS akan meminta izin firewall untuk `node` saat pertama kali — harus diizinkan.
- Kalau HP tidak bisa membuka, biasanya Wi-Fi tamu mengisolasi antar klien. Pakai jaringan yang sama.
- **Kamera QR tidak bisa diuji lewat `http://192.168.x.x`.** `getUserMedia` butuh secure context; untuk scanner pakai preview Vercel (HTTPS).
- Dev server **tidak** melakukan typecheck penuh. Jalankan `npm run typecheck` atau `npm run build`.

### Workspace Wonder

Wonder menjalankan repo dari **clone sendiri**, bukan dari folder kerja utama:
`~/wonder/workspaces/digital-invitation-app/<nama-workspace>/`.

Clone itu tidak punya `.env.local` karena file tersebut diabaikan git, sehingga
halaman menampilkan pesan "Konfigurasi Supabase belum lengkap". Salin dulu:

```bash
cp /path/ke/repo/.env.local \
   ~/wonder/workspaces/digital-invitation-app/<nama-workspace>/.env.local
```

- Jika konfigurasi belum terbaca, restart dev server.
- Gunakan port yang dicetak dev server jika port 3000 sudah dipakai.
- Workspace Wonder bisa berada di **branch lain** daripada `main`. Cek dengan
  `git -C <path> log --oneline -1` sebelum menyimpulkan ada bug — kode yang
  diuji mungkin bukan `main`.

## Alur kerja

1. Audit dulu, usul kemudian, ubah terakhir. Jangan refactor yang tidak diminta.
2. Setiap perubahan lewat branch. Verifikasi di **lokal** (dan HP) dulu, bukan Vercel.
3. **Jangan merge ke `main` sebelum pengguna bilang "aman"** setelah mencoba di lokal. Merge dengan `--ff-only`.
4. Sebelum merge, `npm run build` **wajib lolos**.
5. Preview Vercel hanya diperlukan kalau: mengubah konfigurasi deploy/env/build, menyentuh fitur yang butuh HTTPS (kamera QR scanner), atau satu cek akhir sebelum perubahan besar. Untuk perubahan kecil, cukup lokal + build.
6. Perubahan docs-only tanpa dampak build boleh langsung merge setelah dijelaskan.
7. Temuan harus konkret: path file, nomor baris, angka.

## Commit

- Author: `rayarayuasmara <rayarayuasmara@users.noreply.github.com>`
- Trailer: `Co-Authored-By: <nama model> <noreply@anthropic.com>` dan `Claude-Session: <url sesi>`. Ikuti pola commit yang sudah ada di `git log`.

## Batasan lingkungan

- `node_modules` sering tidak terpasang dan instalasi paket bisa diblokir; verifikasi nyata lewat preview Vercel.
- `tsc` global memunculkan error React dan library pihak ketiga. Saring hanya file yang diubah.
- Tidak ada tes otomatis. Logika kuota, check-in, RSVP, dan token belum tertutup.

## Design tokens

`src/styles/tokens.css` **generated** — jangan edit manual. `theme.css` hand-written. Urutan import di `app/(dashboard)/layout.tsx` penting: foundation → index → tokens → app → theme → tailwind. Komponen shadcn/v0 masuk `src/components/ui/`. Jangan hard-code warna atau ukuran brand di CSS komponen.

## Antrean yang belum dikerjakan

1. Audit `get_client_dashboard_data()`: apakah memfilter `auth.uid()`, `search_path` terkunci, dan `client_id` tidak bisa dipalsukan dari frontend.
2. A11y: `inert` pada TabBar saat menu FAB terbuka, `prefers-reduced-motion` untuk `.tabbar-shell`, focus trap + kembalikan fokus ke FAB setelah ditutup.
3. Setelah aksi tamu, `onChanged` memanggil `load()` dan mengambil ulang seluruh dashboard. Optimistic update butuh rollback — bahas perilakunya dulu.
4. Hierarki visual Beranda belum dinilai, perlu dilihat di preview.
5. Belum ada tes untuk kuota, check-in, RSVP, dan token.
6. `docs/` masih menyebut `dashboard.html` yang sudah dihapus — catatan historis, boleh dibiarkan.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
