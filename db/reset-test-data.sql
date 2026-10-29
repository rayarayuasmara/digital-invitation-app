-- RayaRayu — reset data tamu (BERSIH-BERSIH, BUKAN MIGRASI)
--
-- Menghapus SELURUH data tamu untuk satu acara: tamu, RSVP, tiket, ucapan.
-- Yang dipertahankan: akun klien, profil acara, template WhatsApp, pengaturan.
--
-- PERINGATAN
-- Skrip ini menghapus permanen. Tautan undangan yang sudah tersebar akan mati
-- dan tidak bisa dipulihkan. Jalankan hanya pada data uji, atau pada acara
-- yang memang belum dikirim.
--
-- Cara pakai:
--   1. Ubah v_slug di bawah ke slug acara yang mau dikosongkan.
--      Isi NULL untuk mengosongkan semua acara.
--   2. Jalankan seluruh file dalam satu kali eksekusi.
--   3. Periksa hasil query verifikasi di bagian bawah.

begin;

do $reset$
declare
  v_slug text := 'rudi-irul';   -- NULL = semua acara
  v_events int;
  v_guests int;
  v_wishes int;
begin
  create temp table _ev on commit drop as
  select e.id
  from public.events e
  join public.clients c on c.id = e.client_id
  where v_slug is null or c.slug = v_slug;

  select count(*) into v_events from _ev;
  if v_events = 0 then
    raise exception 'Tidak ada acara yang cocok dengan slug %.', coalesce(v_slug, 'NULL');
  end if;

  delete from public.wishes w using _ev where w.event_id = _ev.id;
  get diagnostics v_wishes = row_count;

  -- tickets dan rsvps ikut terhapus lewat ON DELETE CASCADE
  delete from public.guests g using _ev where g.event_id = _ev.id;
  get diagnostics v_guests = row_count;

  -- Kode petugas lama dimatikan, penanda "ucapan sudah dibaca" direset.
  update public.events e
  set scanner_code = null,
      wishes_seen_at = null
  from _ev
  where e.id = _ev.id;

  raise notice 'Acara: %, tamu dihapus: %, ucapan dihapus: %', v_events, v_guests, v_wishes;
end;
$reset$;

commit;

-- ============================================================
-- Verifikasi: semua harus 0 untuk acara yang direset
-- ============================================================

select c.slug,
       e.title,
       e.scanner_code,
       (select count(*) from public.guests g where g.event_id = e.id) as tamu,
       (select count(*) from public.rsvps r
          join public.guests g on g.id = r.guest_id
         where g.event_id = e.id) as rsvp,
       (select count(*) from public.tickets t
          join public.guests g on g.id = t.guest_id
         where g.event_id = e.id) as tiket,
       (select count(*) from public.wishes w where w.event_id = e.id) as ucapan
from public.clients c
join public.events e on e.client_id = c.id
order by c.slug;
