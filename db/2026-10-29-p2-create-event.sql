-- RayaRayu — P2: klien bisa membuat acara sendiri + akun tanpa acara
-- Diterapkan 2026-10-29.
--
-- Dua perubahan:
--   1. RPC baru create_event() supaya klien tidak perlu menyentuh SQL.
--   2. get_client_dashboard_data() tidak lagi mengembalikan acara kosong yang
--      membuat frontend error. Kalau belum punya acara, balasannya
--      success: true + event: null, dan dashboard menampilkan layar onboarding.

begin;

-- ============================================================
-- 1. create_event
-- ============================================================

create or replace function public.create_event(
  p_title text,
  p_event_date date,
  p_location text,
  p_session_1_name text default null,
  p_session_1_time text default null,
  p_session_2_name text default null,
  p_session_2_time text default null
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_client public.clients%rowtype;
  v_count int;
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_s1n text := coalesce(nullif(btrim(p_session_1_name), ''), 'Akad');
  v_s2n text := coalesce(nullif(btrim(p_session_2_name), ''), 'Resepsi');
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  select * into v_client from public.clients where user_id = auth.uid();
  if v_client.id is null then
    return json_build_object('success', false, 'message', 'Akun klien tidak ditemukan.');
  end if;

  if v_title = '' then
    return json_build_object('success', false, 'message', 'Judul acara wajib diisi.');
  end if;
  if p_event_date is null then
    return json_build_object('success', false, 'message', 'Tanggal acara wajib diisi.');
  end if;

  -- Batas wajar supaya satu akun tidak bisa membuat acara tanpa henti.
  select count(*) into v_count from public.events where client_id = v_client.id;
  if v_count >= 20 then
    return json_build_object('success', false, 'message', 'Batas 20 acara per akun sudah tercapai.');
  end if;

  insert into public.events (client_id, title, event_date, location,
                             session_1_name, session_1_time, session_2_name, session_2_time)
  values (v_client.id, v_title, p_event_date::timestamptz,
          nullif(btrim(coalesce(p_location, '')), ''),
          v_s1n, nullif(btrim(coalesce(p_session_1_time, '')), ''),
          v_s2n, nullif(btrim(coalesce(p_session_2_time, '')), ''))
  returning id into v_id;

  return json_build_object('success', true, 'event_id', v_id);
end;
$fn$;

-- Grant default Supabase memberi akses ke anon juga; cabut per role.
revoke all on function public.create_event(text, date, text, text, text, text, text) from public;
revoke execute on function public.create_event(text, date, text, text, text, text, text) from anon, authenticated;
grant execute on function public.create_event(text, date, text, text, text, text, text) to authenticated;

-- ============================================================
-- 2. get_client_dashboard_data: jangan error saat belum punya acara
-- ============================================================
--
-- Sisipkan tepat setelah pemilihan acara:
--
--   SELECT * INTO v_event FROM public.events
--    WHERE client_id = v_client.id AND (p_event_id IS NULL OR id = p_event_id) LIMIT 1;
--
-- Tambahkan:
--
--   IF v_event.id IS NULL THEN
--     RETURN json_build_object(
--       'success', true,
--       'client', row_to_json(v_client),
--       'event', NULL,
--       'stats', '{}'::json,
--       'categories', '[]'::json,
--       'filter_options', '{}'::json,
--       'recent', '[]'::json,
--       'guests', '[]'::json
--     );
--   END IF;
--
-- Tanpa ini, frontend membaca data.event.id dan berhenti dengan TypeError.
-- Frontend sekarang memperlakukan event NULL sebagai layar onboarding, dan
-- mengulang panggilan tanpa p_event_id kalau acara tersimpan di perangkat
-- sudah tidak ada.

commit;

-- ============================================================
-- Verifikasi
-- ============================================================

select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       has_function_privilege('anon', p.oid, 'execute') as anon_bisa,
       (pg_get_functiondef(p.oid) ilike '%v_event.id is null%') as ada_guard
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_event', 'get_client_dashboard_data')
order by p.proname;

-- Harus: create_event ada dan anon_bisa = false,
--        get_client_dashboard_data ada_guard = true.
