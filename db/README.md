# Database — RayaRayu

Project Supabase: `awwraxmftlbekclwdrix`

Folder ini mencatat semua perubahan skema dan kebijakan akses. Tujuannya: kalau
suatu saat perlu mengulang, memeriksa, atau membatalkan perubahan, ada jejaknya.

Aplikasi ini statis (4 file HTML di root). Tidak ada build step. Frontend
memanggil Supabase langsung lewat `supabase-js`, jadi **setiap RPC di bawah ini
adalah bagian dari kontrak API**. Mengubah nama atau parameter fungsi akan
memutus halaman tanpa error build.

---

## 1. Urutan migrasi

Jalankan **berurutan**. Jangan melompat.

| # | File | Isi |
|---|---|---|
| 1 | `2026-10-29-p0-step1-additive.sql` | Tambah objek baru tanpa merusak yang lama |
| 2 | `2026-10-29-p0-step2-restrictive.sql` | Hapus policy bocor, kunci akses |
| 3 | `2026-10-29-p1-token.sql` | Token undangan 10 karakter |
| 4 | `2026-10-29-p1-indexes-rls.sql` | Index + RLS `auth.uid()` jadi initplan |
| 5 | `2026-10-29-p1-scanner-ticketless.sql` | Tamu tanpa tiket bisa check-in dari daftar |
| 6 | `2026-10-29-p1-rotate-all-tokens.sql` | Ganti semua token (khusus data uji) |
| 7 | `2026-10-29-p2-multi-event.sql` | Multi-acara per klien (catatan diff, bukan skrip) |
| 8 | `2026-10-29-p2-create-event.sql` | Klien bisa buat acara sendiri + akun tanpa acara |
| 9 | `2026-10-29-p3-signup.sql` | Pendaftaran klien mandiri (trigger `auth.users` -> `clients`) |
| 10 | `2026-10-29-p3-quota.sql` | Kuota undangan per paket, ditegakkan di server |
| 11 | `2026-10-30-p4-plans-mvp.sql` | Katalog paket, masa aktif, publish, watermark — **diterapkan 2026-10-30** |
| 12 | `2026-10-30-p5-event-slug.sql` | Slug per acara, `couple_name`, kunci slug setelah terbit — **diterapkan 2026-10-30** |
| 13 | `2026-10-30-p6-preview-token.sql` | Tautan pratinjau per acara (`preview_token`) — **diterapkan 2026-10-30** |

### Prasyarat tiap tahap

- **#1** aman dijalankan lebih dulu. Frontend lama tetap jalan setelahnya.
- **#2** hanya boleh dijalankan **setelah** frontend yang memakai RPC baru
  ter-deploy. Kalau tidak, scanner dan undangan rusak. Frontend itu ada di
  commit `291c16e`.
- **#3–#6** tidak mengubah kontrak API, aman kapan saja.
- **#6 khusus data uji.** Jangan dijalankan pada acara yang tautannya sudah
  dikirim ke tamu. Lihat bagian 4.

### Cara menjalankan

Lewat Supabase SQL Editor, atau satu per satu lewat MCP `execute_sql`. Satu
file = satu eksekusi. Setelah tiap file, jalankan query verifikasi di bagian 5.

`step2` dan `scanner-ticketless` sama-sama mendefinisikan ulang
`get_invitation_details`. **Versi terakhir yang menang.** Kalau file #2
dijalankan ulang setelah #5, pencarian berdasarkan id tamu akan hidup lagi.
Hindari mengulang #2 kecuali memang sedang rollback.

---

## 2. Snapshot rollback

Ada di `db/backup/`, **tidak masuk git** (dilihat `.gitignore`) karena isinya
definisi lama yang sengaja tidak aman.

| File | Isi |
|---|---|
| `2026-10-29-p0-before.sql` | 7 policy bocor + 3 fungsi sebelum hardening |
| `2026-10-29-p1-token-before.sql` | `add_guest_by_client` versi lama + token tamu saat itu |

Backup hanya menolong untuk mengembalikan kondisi. Jangan dijalankan di
produksi kecuali benar-benar ingin membuka kembali akses anon.

---

## 3. Kondisi database sekarang

### RPC publik (bisa dipanggil tanpa login)

Semuanya `SECURITY DEFINER` dan **wajib** memakai token atau kode akses.
Tidak ada yang bisa membaca tabel langsung.

| Fungsi | Dipakai oleh | Kunci akses |
|---|---|---|
| `get_invitation_details(token)` | `invitation.html` | token undangan / token tiket |
| `submit_rsvp(token, status, pax)` | `invitation.html` | token undangan |
| `send_wish(token, message)` | `invitation.html` | token undangan |
| `get_event_wishes(token)` | `invitation.html` | token undangan |
| `get_event_rsvp_summary(token)` | `invitation.html` | token undangan |
| `scanner_event_info(kode)` | `scanner.html` | kode petugas acara |
| `scanner_list_guests(kode)` | `scanner.html` | kode petugas acara |
| `scanner_check_in(kode, input)` | `scanner.html` | kode petugas acara |

### RPC pemilik acara (wajib login)

`create_event`, `get_client_dashboard_data`, `list_client_guests`, `add_guest_by_client`,
`update_guest_by_client`, `update_guest_sent_status`, `delete_guest_by_client`,
`get_scanner_guests`, `check_in_guest`, `process_check_in`,
`events_rotate_scanner_code`.

Semuanya memeriksa `auth.uid()` dan membatasi ke acara milik pemanggil.
`events_rotate_scanner_code` membuat kode petugas 16 hex. Kode ini hanya
membuka daftar tamu + check-in, tidak bisa mengubah data.

### Bukan untuk siapa pun

`gen_invitation_token` — hanya dipanggil dari fungsi lain. Grant-nya dicabut
dari `anon`, `authenticated`, dan `public`.

### Policy RLS yang aktif

| Tabel | Policy | Siapa |
|---|---|---|
| `clients` | `Allow client full access` | pemilik baris (`user_id = auth.uid()`) |
| `events` | `Allow events access` | klien pemilik acara |
| `guests` | `Allow guests access` | klien pemilik acara |
| `rsvps` | `Allow rsvps access` | klien pemilik acara |
| `tickets` | `Allow tickets access` | klien pemilik acara |
| `wishes` | `Klien bisa membaca ucapan acaranya` | klien pemilik acara, hanya SELECT |

Tidak ada policy untuk `anon` di tabel mana pun. Tamu mengakses data lewat RPC,
bukan lewat tabel. Ini disengaja: kalau ada policy `using (true)` untuk `public`,
seluruh tabel terbuka lagi.

Semua policy memakai `(select auth.uid())`, bukan `auth.uid()`, supaya nilainya
dihitung sekali per query.

### Index

Selain primary key dan unique constraint:

| Tabel | Index | Untuk |
|---|---|---|
| `clients` | `clients_user_id_idx` | FK `user_id`, policy RLS |
| `events` | `events_client_id_idx` | FK `client_id`, policy RLS |
| `events` | `events_scanner_code_key` (unique, partial) | pencarian kode petugas |
| `guests` | `guests_invitation_token_lower_key` (unique) | lookup token, cegah kembar |
| `guests` | `guests_event_category_idx` | filter dashboard |
| `guests` | `guests_event_created_idx` | urutan dashboard |
| `guests` | `guests_event_name_idx` | urutan nama |
| `guests` | `guests_event_session_idx` | filter sesi |
| `wishes` | `wishes_event_created_idx` | daftar ucapan |
| `wishes` | `wishes_guest_id_idx` | FK `guest_id` |
| `tickets` | `tickets_scanned_by_idx` | FK `scanned_by` |

---

## 4. Token undangan

Token adalah bagian tautan yang dikirim ke tamu: `/{slug}/{token}`.

- Format sekarang: **10 karakter**, alfabet 31 simbol
  `abcdefghjkmnpqrstuvwxyz23456789` (tanpa `i l o 0 1`).
- Kekuatan: 49,5 bit. Format lama 8 hex hanya 32 bit.
- Dibuat oleh `gen_invitation_token()`, memakai byte acak dari `pgcrypto`
  (`extensions.gen_random_bytes`) dengan rejection sampling supaya sebarannya
  rata.
- Semua pencarian memakai `lower()`, jadi **jangan** membuat token dengan
  huruf besar.

### Mengganti token

Selalu filter dengan `is_sent` agar tautan yang sudah dikirim tidak mati:

```sql
create temp table _rot on commit drop as
select g.id, g.invitation_token as old_token,
       public.gen_invitation_token(10) as new_token
from public.guests g
where not g.is_sent
  and g.invitation_token !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{10}$';

update public.guests g set invitation_token = r.new_token
from _rot r where g.id = r.id;

update public.tickets t set ticket_token = r.new_token
from _rot r
where t.guest_id = r.id and t.ticket_token = r.old_token;
```

Belum ada tombol "perbarui tautan" di dashboard. Penggantian token hanya lewat
SQL.

### Reset data uji (bukan migrasi)

`reset-test-data.sql` menghapus tamu, RSVP, tiket, dan ucapan untuk satu acara.
Akun klien dan profil acara tetap. Kode petugas ikut dimatikan.

Ubah `v_slug` di dalam file (`NULL` = semua acara), lalu jalankan sekali. File
ini tidak masuk urutan migrasi dan tidak boleh dijalankan pada acara yang
tautannya sudah dikirim ke tamu.

---

## 5. Verifikasi cepat

Ganti `$K` dengan publishable key, `$KODE` dengan kode petugas aktif, dan
`$TOKEN` dengan token tamu.

```bash
U="https://awwraxmftlbekclwdrix.supabase.co"
H=(-H "apikey: $K" -H "Authorization: Bearer $K" -H "Content-Type: application/json")

# Harus BALIK []
curl -s "$U/rest/v1/guests?select=group_name&limit=1" "${H[@]}"
curl -s "$U/rest/v1/tickets?select=ticket_token&limit=1" "${H[@]}"
curl -s "$U/rest/v1/rsvps?select=status&limit=1" "${H[@]}"
curl -s "$U/rest/v1/wishes?select=message&limit=1" "${H[@]}"

# Harus jalan
curl -s -X POST "$U/rest/v1/rpc/scanner_event_info" "${H[@]}" -d "{\"p_code\":\"$KODE\"}"
curl -s -X POST "$U/rest/v1/rpc/get_invitation_details" "${H[@]}" -d "{\"p_token\":\"$TOKEN\"}"

# Harus ditolak
curl -s -X POST "$U/rest/v1/rpc/get_scanner_guests" "${H[@]}" -d '{}'   # -> []
curl -s -X POST "$U/rest/v1/rpc/check_in_guest" "${H[@]}" -d '{"p_ticket_token":"x"}'
curl -s -X POST "$U/rest/v1/rpc/delete_guest_by_client" "${H[@]}" -d '{"p_guest_id":"00000000-0000-0000-0000-000000000000"}'
```

Uji policy sebagai pemilik, tanpa login sungguhan:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '<user_id dari public.clients>', 'role', 'authenticated')::text, true);
select (select count(*) from public.clients) as clients,
       (select count(*) from public.events)  as events,
       (select count(*) from public.guests)  as guests;
rollback;
```

---

## 6. Rollback

Dari yang paling ringan:

| Perubahan | Cara membatalkan |
|---|---|
| Policy RLS | Jalankan blok policy di `backup/2026-10-29-p0-before.sql` |
| Fungsi | Definisi lama ada di backup; jalankan manual setelah dibaca |
| Index | Lihat komentar rollback di `2026-10-29-p1-indexes-rls.sql` |
| Kolom `events.scanner_code` | `alter table public.events drop column scanner_code;` (setelah drop fungsi `scanner_*` dan `events_rotate_scanner_code`) |
| Token | Tidak bisa dikembalikan ke nilai lama kalau tidak dicatat. Backup P1 hanya memuat 2 token saat itu; sisanya sudah berganti permanen. |

Kalau membatalkan `step2`, perhitungkan juga frontend: halaman sudah tidak
memakai akses tabel langsung, jadi mengembalikan policy tidak memulihkan
fungsi apa pun — hanya membuka kembali data ke publik.

---

## 7. Jebakan yang sudah ditemui

1. **`revoke ... from public` tidak cukup.** Supabase memberi grant `EXECUTE`
   ke `anon` dan `authenticated` secara otomatis untuk setiap fungsi baru di
   schema `public`. Harus dicabut per role:

   ```sql
   revoke execute on function public.nama_fungsi(...) from anon, authenticated, public;
   ```

2. **Trigger function bisa dipanggil lewat API.** `events_sync_session_names`,
   `rsvp_fill_guest_meta`, `sync_rsvp_guest_meta` sempat terbuka untuk `anon`.
   Grant-nya sudah dicabut; trigger tetap berjalan normal karena Postgres tidak
   memeriksa `EXECUTE` untuk pemanggilan trigger.

3. **Policy `using (true)` untuk role `public`** membuka seluruh tabel ke anon,
   bukan hanya ke pengguna login. Tujuh policy seperti itu sudah dihapus.

4. **`guests.is_checked_in` tidak selalu sinkron** dengan `tickets.is_checked_in`.
   Dashboard dan scanner membaca status dari `tickets`. Jangan memakai kolom
   `guests.is_checked_in` sebagai sumber kebenaran.

5. **`gen_random_bytes` ada di schema `extensions`**, bukan `public`. Panggil
   sebagai `extensions.gen_random_bytes(...)` supaya tidak bergantung
   `search_path`.

---

## 8. Sisa risiko yang diketahui

- `auth_leaked_password_protection` mati. Hanya tersedia di plan berbayar.
  Risiko rendah karena aplikasi tidak punya halaman daftar atau reset password.
- Tidak ada rate limit pada RPC publik. Diterima karena token 49,5 bit dan kode
  petugas 64 bit.
- `get_scanner_guests` masih mengembalikan `invitation_token`, tapi hanya untuk
  pemilik acara yang login.

### Paket dan kuota

Batas disimpan di tabel `clients`, bukan di kode:

| Kolom | Arti |
|---|---|
| `tier` | Nama paket (`free`, `pro`) — hanya label |
| `guest_limit` | Jumlah undangan per acara |
| `event_limit` | Jumlah acara per akun |

Default untuk pendaftar baru: `free`, 30 undangan, 1 acara. Akun lama di-set
`pro` (1000 undangan, 20 acara).

Penegakan ada di server:

- `add_guest_by_client` menolak kalau jumlah tamu acara sudah mencapai
  `guest_limit`.
- `create_event` menolak kalau jumlah acara sudah mencapai `event_limit`.
- `get_client_dashboard_data` mengirim `stats.max_quota` dari `guest_limit`,
  jadi kartu "Kuota Tamu" menampilkan batas sebenarnya.

Kuota dihitung per acara. Menurunkan paket tidak menghapus tamu lama; hanya
penambahan baru yang diblokir.

### Pendaftaran klien

Klien mendaftar sendiri lewat `dashboard.html`. Trigger `on_auth_user_created`
membuat baris `public.clients` otomatis: nama dari metadata `name`, slug dari
nama (huruf kecil, tanda hubung), ditambah `-2`, `-3`, ... kalau bentrok.

Tiga hal di dashboard Supabase yang menentukan berhasil tidaknya pendaftaran:

1. Auth -> Providers -> Email aktif.
2. "Confirm email": kalau aktif, pendaftar harus klik tautan di email sebelum
   bisa masuk. Kalau nonaktif, langsung masuk ke layar onboarding acara.
3. SMTP. SMTP bawaan Supabase punya kuota kirim sangat kecil di plan gratis,
   sehingga pendaftaran sering gagal dengan "email rate limit exceeded".
   Pasang SMTP sendiri (Resend/Brevo punya tier gratis) di Auth -> SMTP Settings.

Domain email juga divalidasi: `example.com` dan domain tanpa MX ditolak dengan
"Email address ... is invalid".

### Banyak acara per klien

Sudah didukung sejak `2026-10-29-p2-multi-event.sql`. Lima fungsi menerima
`p_event_id uuid default null`:

`get_client_dashboard_data`, `list_client_guests`, `add_guest_by_client`,
`update_guest_by_client`, `check_in_guest`.

- `p_event_id` kosong (`null`) = acara pertama milik klien. Ini menjaga
  kompatibilitas pemanggil lama.
- `p_event_id` diisi acara yang bukan milik pemanggil = ditolak
  (`Unauthorized` / daftar kosong), bukan error 500.
- Dashboard menampilkan pemilih acara di header Home kalau klien punya lebih
  dari satu acara. Pilihan disimpan di `localStorage` dengan kunci
  `rr_event_id`. Kalau acara itu sudah dihapus, dashboard otomatis kembali ke
  acara pertama.
- `delete_guest_by_client` dan `update_guest_sent_status` tidak butuh
  `p_event_id`: keduanya dikunci lewat `guest_id` plus cek kepemilikan acara.
- `get_scanner_guests` dan `events_rotate_scanner_code` sudah menerima
  `p_event_id` sejak awal.

Tamu tidak bisa berpindah acara. Kalau perlu memindahkan, hapus lalu buat ulang
di acara tujuan — token undangan ikut baru.
