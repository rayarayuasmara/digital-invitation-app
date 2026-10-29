# MVP Monetisasi — Spek Teknis

Status: **diterapkan 30 Oktober 2026.** Migrasi sudah jalan
(`db/2026-10-30-p4-plans-mvp.sql`), frontend sudah diubah, **belum di-deploy**.
Rujukan strategi: `docs/monetisasi.md`.

---

## 1. Prinsip

1. **Kolomnya sekarang, fiturnya nanti.** Setiap fitur masa depan yang butuh
   kolom, kolomnya dibuat di MVP. Migrasi yang tidak perlu = utang yang tidak
   perlu.
2. **Plan adalah data, bukan kode.** Harga dan limit hidup di tabel `plans`.
   Tidak ada angka limit yang ditulis mati di fungsi.
3. **Satu resolver.** Semua penegakan (tambah tamu, publish, undangan publik)
   membaca `event_entitlements()` — bukan kolom yang berbeda-beda.
4. **Pembayaran manual dulu.** Tanpa payment gateway, tapi lewat tabel `orders`
   supaya Midtrans nanti cuma menulis baris, bukan merombak frontend.
5. **Free tier harus bisa dipakai, tapi tidak bisa dipakai untuk menang.**

---

## 2. Lingkup MVP

### Masuk

| # | Fitur | Kenapa masuk MVP |
|---|---|---|
| 1 | Tabel `plans` + 3 tier (Free/Silver/Gold) | Tanpa ini tidak ada yang bisa dijual |
| 2 | `event_entitlements()` | Fondasi semua penegakan |
| 3 | `events.published_at` + tombol **Terbitkan** | Titik konversi utama |
| 4 | `events.expires_at` + halaman kedaluwarsa | Proteksi biaya |
| 5 | Watermark di undangan Free | Paywall + kanal akuisisi |
| 6 | Halaman harga di `index.html` → WhatsApp | Jualan tanpa checkout |
| 7 | Aktivasi manual via `set_client_plan()` | Cukup untuk 10–30 penjualan pertama |

### Ditunda (kolomnya tetap disiapkan)

| Fitur | Alasan ditunda | Yang disiapkan sekarang |
|---|---|---|
| Payment gateway | Manual dulu, validasi harga | Tabel `orders` |
| Addon | Belum ada volume | Tabel `addons` + `client_addons` + resolver sudah menjumlahkan |
| Galeri tema | Kerja desain paling lama | `events.theme_id`, `plans.limits.themes` |
| Multi-seat / Studio | Butuh multi-tenant | `plans.billing` sudah ada |
| Custom domain | Butuh DNS per klien | `plans.features.custom_domain` |
| Auto blast WA | Biaya API, butuh saldo | `plans.features.auto_blast` |
| Coupon, invoice, refund | Belum perlu | `orders.status` sudah lengkap |

**Batasan MVP: 3 tier, 1 tema (`classic`), 1 pembayaran manual.** Diamond dan
Studio cukup jadi baris di `plans` kapan pun dibutuhkan.

---

## 3. Arsitektur: satu sumber kebenaran

```
                        ┌──────────────┐
                        │    plans     │  harga + limit + fitur (data)
                        └──────┬───────┘
                               │
        clients.tier ──────────┤
                               ▼
                    event_entitlements(event_id)
                    ┌──────────┴───────────┐
                    │ guest_limit          │
                    │ expires_at           │
                    │ is_published         │
                    │ watermark            │
                    │ features (jsonb)     │
                    └──────────┬───────────┘
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
   add_guest_by_client   get_invitation_    dashboard
   (tolak kalau penuh)   details (flag)     (kuota, banner)
```

Aturan: **tidak ada fungsi yang boleh membaca `plans` langsung.** Semua lewat
resolver. Kalau nanti limit pindah dari level klien ke level event, cukup ubah
resolver — tiga pemanggilnya tidak tahu.

---

## 4. Skema

### Baru

```
plans          code, name, price, billing, limits jsonb, features jsonb, sort_order, is_active
addons         code, name, price, meta jsonb, is_active
client_addons  client_id, event_id?, addon_code, qty, amount, expires_at, status
orders         client_id, event_id?, plan_code?, addon_code?, amount, status,
               provider, provider_ref, paid_at
```

`limits` contoh (Free):

```json
{ "events": 1, "guests": 30, "pax": 100, "themes": 3, "photos": 3,
  "sessions": 1, "devices": 1, "active_days": 60, "grace_days": 7 }
```

`features` contoh (Free):

```json
{ "watermark": true, "export": "none", "custom_domain": false,
  "custom_slug": false, "wa_templates": 1, "bank_accounts": 1 }
```

### Ditambah ke tabel lama

| Tabel | Kolom | Keterangan |
|---|---|---|
| `events` | `published_at timestamptz` | null = draf |
| `events` | `expires_at timestamptz` | null = tanpa batas (data lama) |
| `events` | `theme_id text default 'classic'` | placeholder tema |
| `clients` | `plan_started_at timestamptz` | kapan paket aktif |

`clients.guest_limit` dan `event_limit` **tetap ada** (dipakai dashboard) tapi
jadi turunan `plans` lewat trigger. Jangan diedit manual lagi.

---

## 5. Fungsi yang disentuh

| Fungsi | Perubahan | Risiko |
|---|---|---|
| `event_entitlements(uuid)` | **baru** | rendah |
| `publish_event(uuid)` | **baru** | rendah |
| `set_client_plan(uuid, text)` | **baru** | rendah |
| `sync_client_plan_limits()` | **baru** (trigger) | rendah |
| `add_guest_by_client` | sumber limit → resolver | sedang |
| `get_invitation_details` | **DROP + CREATE** (tambah 4 kolom di akhir) | sedang |
| `create_event` | limit acara → plans, set `theme_id` | rendah |

Catatan penting: `get_invitation_details` mengembalikan `TABLE`, jadi menambah
kolom **tidak bisa** pakai `CREATE OR REPLACE` — harus `DROP` lalu `CREATE`.
Karena itu seluruh migrasi dibungkus satu transaksi, dan kolom baru ditaruh
**di akhir** daftar supaya frontend lama (yang membaca per nama) tetap jalan.

---

## 6. Perubahan frontend

### `invitation.html`

1. Baca `is_published`, `expires_at`, `watermark`, `theme_id` dari
   `get_invitation_details`.
2. `is_published === false` → layar yang sudah ada (`#error-screen`), teks
   "Undangan belum diterbitkan."
3. `expires_at < now` → banner "Masa aktif undangan telah berakhir", isi tetap
   tampil (read-only), RSVP dinonaktifkan.
4. `watermark === true` → badge tetap di bawah: "Dibuat dengan RayaRayu",
   tautan ke `/`.
5. Qr tiket & check-in **tetap hidup** sampai H+30 apa pun statusnya.

### `dashboard.html`

1. Tombol **Terbitkan** di tab Acara (panggil `publish_event`).
2. Banner status: `Draf` / `Aktif s.d. 12 Jan 2027` / `Kedaluwarsa`.
3. Kartu kuota sudah ada — cukup ganti label jadi "Tamu" + tombol "Upgrade"
   yang membuka WhatsApp dengan teks paket.

### `index.html`

Bagian harga 3 kartu (Free / Silver / Gold), CTA ke WhatsApp dengan parameter
paket. Tanpa checkout.

---

## 7. Urutan rilis

| Langkah | Aksi | Boleh dibalik? |
|---|---|---|
| 1 | Jalankan migrasi (satu transaksi) | ya, ada snapshot |
| 2 | Backfill: event lama → `published_at = created_at`, `expires_at = null` | ya |
| 3 | Deploy `invitation.html` (baca flag baru) | ya |
| 4 | Deploy `dashboard.html` (tombol Terbitkan) | ya |
| 5 | Deploy `index.html` (harga) | ya |
| 6 | Aktivasi manual klien pertama | — |

Backfill **wajib** sebelum deploy: kalau tidak, semua undangan uji akan
menampilkan "belum diterbitkan" dan terlihat seperti aplikasi rusak.

---

## 8. Risiko

| Risiko | Mitigasi |
|---|---|
| `DROP FUNCTION get_invitation_details` bikin undangan down sedetik | Satu transaksi; kolom baru di akhir |
| Frontend lama + kolom baru | Kolom tambahan diabaikan oleh supabase-js |
| Semua event lama jadi draf | Backfill di langkah 2 |
| `guest_limit` dan plan tidak sinkron | Trigger `sync_client_plan_limits` |
| Tanggal acara diisi 2099 | `expires_at = least(..., now() + 365 hari)` |
| Free tier dipakai untuk acara 500 orang | Watermark + limit 30 tamu (server-side) |
| Pengguna kaget tiba-tiba kedaluwarsa | Banner H-7, dan RSVP tetap hidup sampai H+30 |

---

## 9. Definisi selesai

Database (sudah diverifikasi 30 Okt):

- [x] Klien baru otomatis `free`, 30 tamu, 1 acara, watermark aktif (trigger diuji).
- [x] Tambah tamu ke-31 ditolak dari server (resolver `event_entitlements`).
- [x] Event belum diterbitkan ditolak saat RSVP/ucapan (`submit_rsvp`, `send_wish`).
- [x] `publish_event()` mengisi `published_at` + `expires_at`.
- [x] `set_client_plan(..., 'silver')` menaikkan limit tanpa deploy.
- [x] Semua undangan lama tetap terbuka (`published_at` di-backfill).
- [x] `event_entitlements` tidak bisa dipanggil anon.

Frontend (belum diuji di browser, jaringan mesin kerja diblokir):

- [x] `invitation.html` membaca `is_published` / `is_expired` / `watermark`.
- [x] Badge "Dibuat dengan RayaRayu" hanya untuk paket Free.
- [x] Banner kedaluwarsa + RSVP dibekukan, tiket tetap hidup.
- [x] `dashboard.html` punya kartu Paket + tombol Terbitkan.
- [x] `index.html` punya bagian harga 3 kartu.
- [ ] Verifikasi visual di perangkat sungguhan sebelum deploy.
- [ ] Ganti nomor WhatsApp placeholder `6281234567890`.

---

## 10. Seam yang sudah siap untuk v2

| Nanti | Cukup lakukan |
|---|---|
| Midtrans Snap | Webhook menulis `orders` + panggil `set_client_plan` |
| Addon | UI beli → insert `client_addons`; resolver sudah menjumlahkan |
| Tema premium | Isi `events.theme_id`; `plans.limits.themes` sudah ada |
| Studio (B2B) | Insert baris `plans` dengan `billing='monthly'` |
| Perpanjangan | Addon `extend30` menambah `expires_at` |
| Export CSV | Cek `plans.features.export` di RPC, bukan di JS |
