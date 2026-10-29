# RayaRayu — Rombak Model Monetisasi

Status: **draf kerja**, 29 Oktober 2026.
Target segmen: **B2C (mempelai) + B2B (WO/vendor)**.

> Catatan kejujuran: angka kompetitor di dokumen ini **belum diverifikasi**
> karena jaringan ke situs kompetitor diblokir dari mesin kerja. Semua angka
> pasar ditandai 🟡. Angka biaya infrastruktur dan struktur harga adalah
> estimasi yang bisa diuji ulang.

---

## 1. Ringkasan keputusan

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Unit billing B2C | **One-time per event** | Nikah sekali; langganan bulanan = friksi |
| Unit billing B2B | **Langganan + kredit event** | WO butuh volume & retensi |
| Value metric utama | **Jumlah tamu** | Proxy langsung dari "kerjaan yang dihemat" |
| Paywall emosional | **Watermark** | Terlihat 300 tamu = akuisisi gratis |
| Posisi masa aktif | **Proteksi biaya, bukan alat jual** | Menjual "30 hari" bikin stres + review jelek |
| Fitur yang TIDAK di-paywall | Blast WA via `wa.me` | Sudah ada di dashboard, biayanya nol, jangan dijual |
| Harga masuk | **Rp99.000** | Di bawah ambang "mikir dua kali" |

Prinsip: **jangan satu tabel harga untuk dua pembeli berbeda.** Mempelai membeli
sekali karena deadline; WO membeli berulang karena hemat waktu. Dipaksa satu
skema, keduanya jadi tidak pas.

---

## 2. Kondisi hari ini (fakta dari repo & DB)

Sudah ada:

- `clients.tier` (`free`/`pro`), `clients.guest_limit` (30), `clients.event_limit` (1).
- Penegakan di server: `add_guest_by_client` + `create_event` (`db/2026-10-29-p3-quota.sql`).
- Dashboard menampilkan kuota dari `stats.max_quota`.
- Fitur jadi: RSVP, wishes, QR check-in, 2 sesi, kategori/group, amplop digital,
  template WA (deep link `wa.me`), export/tiket cetak.

Belum ada:

- `expires_at` — tidak ada konsep masa aktif sama sekali.
- Tema sebagai entitas (sekarang tampilan undangan tunggal).
- Tabel addon & order/pembayaran.
- Tier di antara `free` dan `pro`.

Implikasi: pekerjaan terbesar bukan membangun fitur baru, tapi **menambah 4
kolom/tabel dan memecah `free`/`pro` jadi 4 tier**.

---

## 3. Persona & JTBD

### A. Mempelai (B2C) — pembayar utama volume

- Usia 24–32, Jabodetabek + kota besar, budget nikah Rp150–300 jt.
- JTBD: *"Supaya tamu tidak nyasar, dan saya tidak ditelpon 100 kali soal lokasi, jam, dan dress code."*
- Pemicu beli: **H-90 sampai H-30**. Deadline keras, keputusan cepat, dipengaruhi contoh visual.
- Yang ditakuti: ribet, hasil jelek, penipuan (transfer dulu, barang tak ada).
- Sensitivitas harga: rendah secara nominal (Rp150k = 0,05% budget), tinggi secara psikologis (harus terasa "worth it dibanding gratis").
- Yang bikin dia **tidak** bayar: watermark tidak mengganggu, kuota sudah cukup, atau takut kehilangan data.

→ Konsekuensi desain: **free tier harus cukup untuk bikin dia jatuh cinta, tapi
tidak cukup untuk acara sesungguhnya.**

### B. WO / vendor / koleb event (B2B) — pembayar utama margin

- Menangani 3–15 acara/bulan. Sudah punya template sendiri, tapi bikin manual.
- JTBD: *"Bikin undangan klien dalam 20 menit, pakai branding saya, tanpa klien telpon saya tiap hari."*
- Pemicu beli: musi­m acara (banyak job sekaligus), klien minta revisi terus.
- Yang ditakuti: limit tamu kejebol di tengah job, sistem down saat H-1, tidak bisa ekspor data ke Excel klien.
- Sensitivitas harga: **rendah per event**, tinggi untuk biaya bulanan saat sepi.

→ Konsekuensi desain: paket WO harus **kredit event** (bayar saat pakai),
bukan kursi bulanan yang jalan terus saat tidak ada job.

### C. Panitia keluarga / koleb (free) — mesin akuisisi

- Bikin 1 undangan, tidak akan bayar, tapi membagikan link ke 200+ orang.
- Perannya: **channel**, bukan customer. Setiap undangan free = iklan berjalan.

---

## 4. Value metric & paywall

| Kandidat value metric | Kualitas | Putusan |
|---|---|---|
| Jumlah tamu | Skala linear dengan kerja yang dihemat, mudah dihitung | ✅ utama (B2C) |
| Jumlah event | Cocok untuk WO, mudah dipahami | ✅ utama (B2B) |
| Masa aktif | Bikin cemas, tidak menambah nilai | ⚠️ hanya proteksi biaya |
| Jumlah foto/storage | Tidak terasa oleh pembeli | ❌ jangan dijual |
| Fitur (tema, musik) | Bagus untuk diferensiasi, jelek sebagai value metric | ⚠️ pelengkap |

**Watermark adalah paywall yang benar.** Ia bekerja tiga arah sekaligus:
menaikkan konversi (gengsi), menurunkan biaya free tier, dan menjadi iklan
(300 tamu melihat "Dibuat dengan RayaRayu").

Yang **jangan** di-paywall:

- **Blast WA.** Sekarang memakai deep link `wa.me` — biaya nol, dan merupakan
  fitur yang paling terasa "produk jadi". Kalau di-paywall, free tier terasa
  lumpuh. Yang dijual terpisah adalah **Auto Blast** (kirim otomatis via API,
  ada biaya per pesan).
- **RSVP & absensi setelah hari-H.** Mematikan ini di hari acara = satu-satunya
  cara mendapat review 1 bintang.

---

## 5. Arsitektur harga: dua lini

```
LINI A — Undangan (B2C, one-time, per event)
  Free  ──► Silver ──► Gold ──► Diamond
   0        99k        199k      349k

LINI B — Studio (B2B, langganan + kredit)
  Studio 299k/bln (5 kredit)  ──►  Studio Pro 799k/bln (20 kredit)
  kredit tambahan 59k/event
```

Aturan pemisah: B2C tidak boleh dapat white-label, export API, atau multi-seat.
B2B tidak mendapat diskon per-event lebih murah dari Gold (kredit 59k/event
memang lebih murah — itu insentif volume, dan WO menjualnya lagi ke klien).

---

## 6. Matriks tier final

### Lini A — Undangan (B2C)

| | **Free** | **Silver** | **Gold** ⭐ | **Diamond** |
|---|---|---|---|---|
| Harga | Rp0 | Rp99.000 | Rp199.000 | Rp349.000 |
| Acara | 1 | 1 | 1 | 1 |
| Tamu | 30 | 300 | 1.000 | 3.000 |
| Estimasi pax | 100 | 1.000 | 4.000 | 12.000 |
| Tema | 3 basic | 10 | semua + premium | semua + 1 custom |
| Masa aktif | 60 hari | H+30 | H+90 | H+180 |
| Watermark | **ya** | tidak | tidak | tidak |
| Foto | 3 | 20 | 200 (500 MB) | 1.000 (2 GB) |
| Musik latar | – | ✓ | ✓ | ✓ |
| Sesi acara | 1 | 2 | 2 | 4 |
| Device scanner | 1 | 2 | 5 | 10 |
| Export tamu/RSVP | – | CSV | CSV + PDF | CSV + PDF |
| Template WA | 1 | 3 | custom | custom |
| Rekening amplop | 1 | 2 | 5 | 10 |
| Slug kustom | – | ✓ | ✓ | ✓ |
| Custom domain | – | – | – | ✓ |
| Support | – | email | prioritas | WA langsung |

⭐ = ditampilkan sebagai "Paling populer", dengan harga coret Rp299.000.

Pembeda yang benar-benar dijual cuma lima: **tamu, tema, watermark, masa aktif,
custom domain**. Sisanya bonus agar tabel terasa penuh — tapi Silver tidak boleh
terasa "kurang".

### Lini B — Studio (B2B)

| | **Studio** | **Studio Pro** |
|---|---|---|
| Harga | Rp299.000/bln | Rp799.000/bln |
| Kredit event | 5 | 20 |
| Kredit tambahan | Rp59.000/event | Rp49.000/event |
| Seat admin | 3 | 10 |
| Tamu per event | 1.000 | 3.000 |
| Semua tema | ✓ | ✓ |
| White-label (logo WO) | ✓ | ✓ |
| Export CSV/PDF | ✓ | ✓ |
| Custom domain per klien | – | ✓ |
| API / webhook | – | ✓ (fase 3) |
| Support | prioritas | WA + onboarding |

Pitch WO: *"Modal Rp59.000 per undangan, tagih klien Rp250.000."*

---

## 7. Addon

| Addon | Harga | Batas |
|---|---|---|
| +100 tamu | Rp29.000 | maks 3× per event |
| Event tambahan (B2C) | Rp79.000 | maks 3× per akun |
| Perpanjang 30 hari | Rp29.000 | maks 2×, mentok H+180 |
| Hapus watermark (event Free) | Rp49.000 | 1× per event |
| Tema premium satuan | Rp39.000 | — |
| Custom domain | Rp79.000 | per event, termasuk setup |
| Desain tema custom | Rp450.000 | 2× revisi |
| QR cetak fisik | Rp3.500/pcs | min. 50 pcs |
| **Auto Blast WA** | Rp199.000 / 500 pesan | biaya API ~Rp125–200rb → **jangan di bawah ini** |
| Video save-the-date | Rp249.000 | — |
| Admin tambahan | Rp19.000/bln | maks 5 |

Aturan anti-bocor:

1. **Addon tidak boleh mengalahkan tier.** Free + 3×" +100 tamu" = 330 tamu
   dengan Rp87.000, lebih murah dari Silver. Karena itu batasnya 3× dan
   harganya dijaga di atas Rp29.000.
2. **Addon tidak memperpanjang otomatis.** Masa aktif hanya naik kalau addon
   perpanjangan dibeli eksplisit.
3. **Addon melekat ke event, bukan akun** — kecuali kredit Studio.

---

## 8. Aturan main (sering dilupakan, paling sering jadi komplain)

| Kasus | Aturan |
|---|---|
| Mulai hitung masa aktif | **Saat publish**, bukan saat daftar |
| Rumus expiry | `min(publish_at + N hari, event_date + grace)` |
| Grace | Free +7, Silver +30, Gold +90, Diamond +180 |
| Tanggal event palsu (2099) | Clamp: maksimal `publish_at + 365 hari` |
| Habis masa aktif | Read-only 30 hari → arsip → hapus (dengan email H-7 & H-1) |
| Hari-H | RSVP + scanner **selalu** aktif, apa pun status paket |
| Upgrade | Bayar selisih, berlaku langsung, masa aktif ikut naik |
| Downgrade | Data tidak dihapus; tamu ke-N tidak bisa dikirim/diedit |
| Refund | Tidak ada setelah publish; sebelum publish boleh 100% |

---

## 9. Unit economics

### Biaya per event (estimasi)

| Komponen | Silver (300 tamu) |
|---|---|
| Payment gateway (blended 2,5%) | Rp2.500 |
| Storage foto (20 × 1,5 MB) | Rp500 |
| Egress (300 tamu × 60% buka × 2,5 MB = 450 MB) | Rp1.500 |
| Support WA/email | Rp2.000 |
| **Total biaya variabel** | **≈ Rp6.500** |
| **Margin kotor** | **≈ 93%** |

### Biaya tetap

| Item | Per bulan |
|---|---|
| Supabase Pro | ~Rp400.000 |
| Vercel Pro | ~Rp320.000 |
| Domain + tools | ~Rp150.000 |
| **Total** | **≈ Rp870.000** |

**Break-even: ±9 penjualan Silver/bulan.** Sangat rendah — artinya masalahnya
bukan margin, tapi **konversi dan akuisisi**.

### Biaya free tier

Free user (30 tamu, 3 foto) ≈ 45 MB egress + 5 MB storage ≈ **Rp150–300**.
1.000 free user/bulan ≈ Rp300.000. Dengan konversi 8%, itu 80 penjualan ≈
Rp10 jt revenue. **Free tier bukan beban biaya — yang mahal adalah free tier
yang terlalu besar sehingga tidak ada alasan upgrade.**

### Target ekonomi

| Metrik | Target |
|---|---|
| Harga rata-rata (ARPU B2C) | Rp152.000 |
| Konversi free → paid | 8–15% (deadline-driven, wajar di atas SaaS biasa) |
| Attach rate addon | ≥ 25% |
| CAC organic (watermark + SEO) | < Rp20.000 |
| CAC berbayar (IG/TikTok ads) | < Rp75.000 |
| Churn Studio | < 8%/bulan |
| LTV/CAC | > 3× |

---

## 10. Business Model Canvas (ringkas)

| Blok | Isi |
|---|---|
| **Segmen** | Mempelai (B2C), WO/vendor (B2B), panitia keluarga (free/channel) |
| **Value prop B2C** | Undangan rapi + RSVP otomatis + QR check-in, siap dalam hitungan menit |
| **Value prop B2B** | White-label, kredit event, hemat 3–5 jam per job |
| **Channel** | Watermark di undangan free, SEO ("undangan digital"), IG/TikTok, komunitas WO |
| **Revenue** | Paket one-time, langganan Studio, addon, jasa desain |
| **Key cost** | Infra (~Rp870k/bln), payment fee 2,5%, desain tema, support |
| **Key resource** | Katalog tema, kecepatan publish, keandalan hari-H |
| **Unfair advantage** | Data check-in + RSVP real-time yang tidak dimiliki template statis |
| **Risiko** | Kanibalisasi free tier, komoditisasi tema, kepercayaan (scam) |

---

## 11. Metrik yang diukur

**North star: event yang di-publish per bulan** — bukan pendaftar, bukan user.

Funnel yang wajib diinstrumentasi:

```
daftar → buat event → tambah ≥10 tamu → publish → bayar
```

Titik bocor yang paling mungkin: **tambah ≥10 tamu** (ribet input manual).
Kalau angka di sini jatuh, perbaiki import CSV dulu — bukan harga.

---

## 12. Roadmap monetisasi

| Fase | Isi | Alasan urutan |
|---|---|---|
| **1** | `expires_at` + watermark + publish gating + tier 4 level | Tanpa ini, tidak ada yang bisa dijual |
| **2** | Addon tamu & perpanjangan + Midtrans Snap | Addon paling laku, tidak butuh fitur baru |
| **3** | Tema sebagai entitas + galeri + custom domain | Butuh kerja desain paling lama |
| **4** | Studio (B2B) + white-label + API | Butuh fondasi multi-tenant |

Migrasi DB yang dibutuhkan (belum dibuat):

```
plans        (code, name, price, limits jsonb, features jsonb, is_active)
client_addons(client_id, event_id null, addon_code, qty, expires_at, status, order_id)
orders       (client_id, plan_code, amount, status, paid_at, payment_ref)
themes       (id, name, tier_min, is_premium, preview_url, price)
```

Kolom tambahan: `events.published_at`, `events.expires_at`, `events.theme_id`,
`events.guest_limit` (pindah dari `clients` agar per-event), `clients.plan_started_at`.

---

## 13. Yang belum bisa diverifikasi

Data kompetitor (Nikahku, Kaya Invitation, Momenku, Invitanku, Weddingku) tidak
bisa diambil karena jaringan diblokir. Cara menutup celah ini, pilih salah satu:

1. Kamu buka situsnya, screenshot halaman harga, saya baca dari gambar.
2. Kamu paste teks harga/limitnya ke chat.
3. Jalankan sesi ini saat jaringan tersedia, saya ambil sendiri.

Yang perlu dicatat dari tiap kompetitor: **harga terendah, limit tamu termurah,
masa aktif, apakah watermark ada, dan apa yang di-paywall.**
