-- RayaRayu — P2: dukungan multi-acara per klien
-- Diterapkan 2026-10-29.
--
-- Bentuk file: CATATAN DIFF, bukan skrip mandiri. Definisi penuh kelima fungsi
-- ada di database dan panjangnya ~19 KB; yang berubah hanya tanda tangan dan
-- satu klausa WHERE. Kalau perlu membangun ulang dari nol, ambil definisi
-- terbaru dengan pg_get_functiondef() lalu terapkan dua perubahan di bawah.
--
-- Pola yang sama untuk semua fungsi:
--   1. Tambah parameter terakhir: p_event_id uuid default null
--      null = acara pertama milik klien (perilaku lama, kompatibel).
--   2. Batasi pemilihan acara ke p_event_id kalau diisi.
--   3. DROP tanda tangan lama SEBELUM create. Tanpa drop, parameter default
--      menghasilkan overload baru dan panggilan tanpa id jadi ambigu.
--
-- Frontend dashboard sekarang mengirim p_event_id berisi acara yang dipilih,
-- dan menyimpan pilihan itu di localStorage (`rr_event_id`).

-- ============================================================
-- 1. get_client_dashboard_data
-- ============================================================
-- Lama : public.get_client_dashboard_data()
-- Baru : public.get_client_dashboard_data(p_event_id uuid default null)
--
-- SELECT * INTO v_event FROM public.events WHERE client_id = v_client.id LIMIT 1;
-- menjadi
-- SELECT * INTO v_event FROM public.events
--  WHERE client_id = v_client.id AND (p_event_id IS NULL OR id = p_event_id) LIMIT 1;

-- ============================================================
-- 2. list_client_guests
-- ============================================================
-- Lama : (p_search text, p_categories text[], p_types text[], p_sessions text[],
--         p_status text, p_sort text, p_dir text, p_offset integer, p_limit integer)
-- Baru : tambah p_event_id uuid default null di akhir
--
-- SELECT e.id INTO v_event_id FROM public.events e
--   JOIN public.clients c ON c.id = e.client_id
--  WHERE c.user_id = auth.uid() LIMIT 1;
-- menjadi
--  WHERE c.user_id = auth.uid()
--    AND (p_event_id IS NULL OR e.id = p_event_id) LIMIT 1;

-- ============================================================
-- 3. add_guest_by_client
-- ============================================================
-- Lama : (p_group_name text, p_category text, p_max_pax integer, p_phone text,
--         p_invitation_type text, p_session text)
-- Baru : tambah p_event_id uuid default null di akhir
--
-- Klausa WHERE yang sama seperti list_client_guests, ditambah
--   AND (p_event_id IS NULL OR e.id = p_event_id)

-- ============================================================
-- 4. update_guest_by_client
-- ============================================================
-- Lama : (p_guest_id uuid, p_group_name text, p_category text, p_max_pax integer,
--         p_phone text, p_rsvp_status text, p_is_checked_in boolean,
--         p_is_sent boolean, p_invitation_type text, p_session text)
-- Baru : tambah p_event_id uuid default null di akhir
--
-- Klausa WHERE yang sama.

-- ============================================================
-- 5. check_in_guest
-- ============================================================
-- Lama : public.check_in_guest(p_ticket_token text)
-- Baru : public.check_in_guest(p_ticket_token text, p_event_id uuid default null)
--
-- Klausa WHERE yang sama.

-- ============================================================
-- Grant
-- ============================================================
-- DROP + CREATE membuat Supabase memberi grant baru ke anon dan authenticated.
-- Wajib dicabut ulang:

--   revoke execute on function public.<nama>(<args>) from anon, public;
--   grant  execute on function public.<nama>(<args>) to authenticated;

-- Tidak berubah (sudah aman, tidak perlu p_event_id):
--   delete_guest_by_client     -> dikunci lewat guest_id + kepemilikan acara
--   update_guest_sent_status   -> sama
--   events_rotate_scanner_code -> sudah punya p_event_id
--   get_scanner_guests         -> sudah punya p_event_id

-- ============================================================
-- Verifikasi
-- ============================================================

select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('anon', p.oid, 'execute') as anon_bisa,
       (pg_get_functiondef(p.oid) ilike '%p_event_id is null or%') as ter_scoping
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_client_dashboard_data','list_client_guests',
                    'add_guest_by_client','update_guest_by_client','check_in_guest')
order by p.proname;

-- Harus: 5 baris, anon_bisa = false, ter_scoping = true.
