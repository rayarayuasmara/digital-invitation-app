# Checklist Sebelum Rilis

Hal-hal yang **tidak bisa dikerjakan dari kode** dan harus disetel manual.

---

## 1. Supabase → Authentication → URL Configuration

**Wajib.** Tanpa ini, link konfirmasi email dan reset password mengarah ke
`http://localhost:3000` dan gagal untuk semua pengguna sungguhan.

| Field | Isi |
|---|---|
| Site URL | `https://<domain-produksi>` (domain Vercel, tanpa garis miring di akhir) |
| Redirect URLs | `https://<domain-produksi>/**` |
| Redirect URLs | `http://localhost:3000/**` (khusus development) |

Kode di `dashboard.html` sudah mengirim `emailRedirectTo: <origin>/dashboard`.
Supabase hanya memakai nilai itu kalau origin-nya ada di daftar Redirect URLs.
Kalau tidak cocok, Supabase diam-diam jatuh ke Site URL.

**Cek:** daftar akun uji baru → email konfirmasi harus menuju domain produksi,
bukan localhost.

---

## 2. Konfirmasi email: nyala atau mati?

Cek di Authentication → Providers → Email → *Confirm email*.

| Pilihan | Konsekuensi |
|---|---|
| Mati | Daftar langsung bisa masuk. Risiko: orang mendaftar dengan email milik orang lain |
| Nyala | Perlu klik email. Risiko: email masuk spam dan pengguna tidak bisa masuk |

Kalau dinyalakan, pastikan nomor 1 sudah benar lebih dulu.

---

## 3. Reset password

Belum ada tombol "Lupa password?" di halaman login. Selama belum ada:

- Pengguna harus menghubungi WhatsApp untuk reset manual.
- Ini **hambatan nyata** begitu ada pengguna berbayar.

---

## 4. Nomor WhatsApp

Masih placeholder `6281234567890` di:

- `index.html` — 4 tautan (hero, 3 kartu harga, footer harga)
- `dashboard.html` — tombol Upgrade di kartu Paket

---

## 5. Uji sebelum deploy

- [ ] Buka undangan lama `/<slug>/<token>` — harus tampil normal.
- [ ] Daftar akun baru → konfirmasi email menuju domain produksi.
- [ ] Login → dashboard hanya menampilkan **Home**, tidak menembus tab lain saat scroll.
- [ ] Tab Acara → tombol share menjelaskan tautan per tamu, tidak menyalin tautan mati.
- [ ] Akun Free: kuota 30 tamu, badge RayaRayu muncul di undangan.
- [ ] Akun Free: tombol Terbitkan mengisi masa aktif (60 hari / H+7).
- [ ] Tambah tamu ke-31 ditolak dengan pesan upgrade.
- [ ] Tautan pratinjau `/pratinjau/<slug>/<token>` terbuka tanpa login,
      menampilkan "Nama Tamu", dan RSVP-nya mati.
- [ ] Pratinjau tetap bisa dibuka sebelum undangan diterbitkan.
- [ ] Slug dikunci di form Acara setelah undangan terbit.
- [ ] Daftar akun baru: isi nama mempelai → slug → tanggal → undangan jadi.

---

## 6. Urutan deploy

1. Migrasi DB (kalau ada) — **selalu sebelum** frontend.
2. Push ke `main` → Vercel auto-deploy.
3. Set Site URL (kalau domain berubah).
4. Uji poin 5 di perangkat sungguhan.
