# RayaRayu

Platform undangan pernikahan digital. Semua halaman memakai **Next.js App Router**, TypeScript, dan Tailwind CSS v4 dalam satu proyek di root repo.

| Halaman | URL | Lokasi |
|---|---|---|
| Landing page | `/` | `app/(marketing)/` |
| Dashboard klien | `/dashboard`, `/login`, `/register`, `/reset-password` | `app/(dashboard)/`, `src/screens/` |
| Pemindai petugas | `/scanner` | `app/(dashboard)/scanner/` |
| Undangan tamu | `/{slug}/{token}`, `/pratinjau/{slug}/{token}` | `app/(invitation)/`, `src/features/invitation/` |

Tautan lama `/invitation.html?token=…` masih didukung sebagai route Next.js, bukan file HTML. Markup undangan sudah berupa komponen React; interaksi template lama masih berada di `src/features/invitation/mount-invitation.js`.

## Jalankan secara lokal

Gunakan Node.js 22 atau lebih baru. Jalankan perintah dari root repo:

```bash
npm ci
cp .env.example .env.local
# Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
npm run typecheck
npm run lint
npm run build
npm start                   # jalankan hasil build
```

Jika berpindah dari Vite, salin **nilai** `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` dari `app/.env` lama ke nama `NEXT_PUBLIC_*` yang baru. Jika menggunakan `VITE_PUBLIC_APP_URL`, padanannya adalah `NEXT_PUBLIC_APP_URL` (opsional). Jangan commit `.env.local` atau memakai service-role key. Tanpa konfigurasi, landing page tetap bisa dibuka; halaman yang memerlukan Supabase menampilkan pesan konfigurasi.

Untuk tes di HP pada Wi-Fi yang sama, isi `NEXT_DEV_ALLOWED_ORIGINS` di `.env.local` dengan IP LAN Mac saja (`ipconfig getifaddr en0`, tanpa `http://` atau port). Jalankan ulang `npm run dev -- --hostname 0.0.0.0`, lalu buka `http://<IP-LAN-Mac>:3000`. Kamera pemindai perlu HTTPS di HP.

## v0 dan Vercel

1. Setelah branch tersedia di GitHub, hubungkan repo ke v0 dan pilih branch migrasi. Gunakan root repo (`.`), bukan `app/`, sebagai direktori proyek.
2. Untuk UI dashboard dari v0, letakkan komponen bersama di `src/components/ui/` dan impor lewat `@/components/ui/…`. Route baru dibuat di `app/`. Konfigurasi shadcn ada di `components.json`; token Tailwind dashboard di `src/styles/tailwind.css`. Pakai `'use client'` hanya untuk bagian yang perlu state, event handler, atau API browser.
3. Di Vercel, pilih **Next.js**, gunakan root repo (`.`), dan kosongkan override install, build, serta output Vite lama. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` untuk environment yang dipakai, lalu redeploy. Pastikan URL preview diizinkan di pengaturan redirect Supabase jika ingin menguji konfirmasi akun dan reset password.

Tidak ada perubahan pada database. Nama dan parameter RPC adalah kontrak API; lihat [`db/README.md`](db/README.md) sebelum mengubahnya.
