-- RayaRayu — P1: ganti SEMUA token tamu ke format 10 karakter
-- Diterapkan 2026-10-29.
--
-- Konteks: seluruh data tamu saat ini adalah data uji, belum ada undangan
-- yang benar-benar dikirim. Jadi tidak ada tautan hidup yang perlu
-- dipertahankan, dan sisa token 32 bit bisa dihabiskan sekaligus.
--
-- Hasil: 21 token diganti, total 22 tamu semua format baru (10 karakter),
-- semua unik. Token lama tidak berlaku lagi.
--
-- Tiket milik tamu yang ticket_token-nya sama dengan token undangan ikut
-- disamakan, supaya QR yang sama tetap berfungsi setelah token diganti.
-- (Tidak ada QR tercetak untuk data uji, ini hanya untuk konsistensi.)

begin;

create temp table _rot on commit drop as
select g.id, g.invitation_token as old_token, public.gen_invitation_token(10) as new_token
from public.guests g
where g.invitation_token !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{10}$';

update public.guests g
set invitation_token = r.new_token
from _rot r
where g.id = r.id;

update public.tickets t
set ticket_token = r.new_token
from _rot r
where t.guest_id = r.id
  and t.ticket_token = r.old_token;

commit;

-- Verifikasi:
--   22/22 tamu format baru, 22 token unik
--   get_invitation_details('4npy28jasr') -> 1 baris (Iryawan)
--   get_invitation_details('e0bb0d8f')   -> 0 baris
--   https://rayarayu.vercel.app/rudi-irul/4npy28jasr -> undangan terbuka

-- ============================================================
-- CATATAN untuk data sungguhan nanti
-- ============================================================
-- Jangan jalankan blok di atas pada acara yang tautannya sudah dikirim ke
-- tamu. Untuk keperluan itu, ganti hanya tamu yang belum dikirim:
--
--   create temp table _rot on commit drop as
--   select g.id, g.invitation_token as old_token, public.gen_invitation_token(10) as new_token
--   from public.guests g
--   where not g.is_sent
--     and g.invitation_token !~ '^[abcdefghjkmnpqrstuvwxyz23456789]{10}$';
--
-- Dan ingat: kalau suatu saat ada tautan yang bocor, tidak ada tombol
-- "perbarui semua tautan" di dashboard. Token per tamu hanya bisa diganti
-- lewat SQL seperti di atas.
