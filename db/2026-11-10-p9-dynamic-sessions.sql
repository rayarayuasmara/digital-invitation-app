-- RayaRayu — P9: sesi acara jadi dinamis (1–3)
--
-- Sebelumnya sesi dipatok 2 kolom di tabel events (session_1_*, session_2_*).
-- Sekarang sesi disimpan sebagai baris di event_sessions, jumlahnya 1–3.
--
-- Keputusan produk:
--   - satu tamu tetap satu sesi (tidak ada relasi banyak-ke-banyak)
--   - minimal 1 sesi, maksimal 3
--   - menghapus sesi memindahkan tamunya ke sesi pertama yang tersisa
--   - undangan menampilkan SEMUA sesi, sesi tamu ditandai
--   - scanner tetap satu untuk semua sesi
--
-- guests.session TETAP teks (nama sesi), bukan FK. Alasannya: enam fungsi
-- tamu (rsvp, check-in, scanner, daftar tamu) membaca kolom itu dan tidak
-- perlu diubah. Konsistensi nama dijaga oleh save_event_sessions().

begin;

-- ---------------------------------------------------------------
-- 1. Tabel sesi
-- ---------------------------------------------------------------
create table if not exists public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  time_text text,
  sort_order int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists event_sessions_event_idx
  on public.event_sessions (event_id, sort_order);

-- Tidak ada unique index: rename yang bertukar nama (A->B, B->A) akan
-- gagal di tengah UPDATE. Keunikan dijaga di save_event_sessions().

alter table public.event_sessions enable row level security;

drop policy if exists event_sessions_owner on public.event_sessions;
create policy event_sessions_owner on public.event_sessions
  for select to authenticated
  using (exists (
    select 1 from public.events e
      join public.clients c on c.id = e.client_id
     where e.id = event_sessions.event_id and c.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------
-- 2. Isi dari kolom lama
-- ---------------------------------------------------------------
insert into public.event_sessions (event_id, name, time_text, sort_order)
select id, btrim(session_1_name), nullif(btrim(coalesce(session_1_time, '')), ''), 1
  from public.events
 where nullif(btrim(coalesce(session_1_name, '')), '') is not null
   and not exists (select 1 from public.event_sessions s where s.event_id = events.id);

insert into public.event_sessions (event_id, name, time_text, sort_order)
select id, btrim(session_2_name), nullif(btrim(coalesce(session_2_time, '')), ''), 2
  from public.events
 where nullif(btrim(coalesce(session_2_name, '')), '') is not null
   and not exists (
     select 1 from public.event_sessions s
      where s.event_id = events.id and lower(s.name) = lower(btrim(events.session_2_name))
   );

-- ---------------------------------------------------------------
-- 3. Simpan daftar sesi (tambah / ubah / hapus + pindahkan tamu)
-- ---------------------------------------------------------------
create or replace function public.save_event_sessions(p_event_id uuid, p_sessions jsonb)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ev public.events%rowtype;
  v_count int;
  v_first text;
begin
  select e.* into v_ev
    from public.events e
    join public.clients c on c.id = e.client_id
   where e.id = p_event_id and c.user_id = auth.uid();

  if v_ev.id is null then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;

  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' then
    return json_build_object('success', false, 'message', 'Data sesi tidak valid.');
  end if;

  v_count := jsonb_array_length(p_sessions);
  if v_count < 1 then return json_build_object('success', false, 'message', 'Minimal satu sesi.'); end if;
  if v_count > 3 then return json_build_object('success', false, 'message', 'Maksimal tiga sesi.'); end if;

  create temp table if not exists _rr_sessions (
    idx int, id uuid, name text, time_text text
  ) on commit drop;
  delete from _rr_sessions;

  insert into _rr_sessions (idx, id, name, time_text)
  select (t.ord - 1)::int,
         nullif(t.e->>'id', '')::uuid,
         btrim(coalesce(t.e->>'name', '')),
         nullif(btrim(coalesce(t.e->>'time_text', t.e->>'time', '')), '')
    from jsonb_array_elements(p_sessions) with ordinality as t(e, ord);

  if exists (select 1 from _rr_sessions where name = '') then
    return json_build_object('success', false, 'message', 'Nama sesi wajib diisi.');
  end if;
  if (select count(distinct lower(name)) from _rr_sessions) <> v_count then
    return json_build_object('success', false, 'message', 'Nama sesi harus berbeda.');
  end if;
  if exists (
    select 1 from _rr_sessions s
     where s.id is not null
       and not exists (select 1 from public.event_sessions x
                        where x.id = s.id and x.event_id = p_event_id)
  ) then
    return json_build_object('success', false, 'message', 'Sesi tidak dikenal.');
  end if;

  v_first := (select name from _rr_sessions order by idx limit 1);

  -- Peta perpindahan tamu: nama lama -> nama baru.
  create temp table if not exists _rr_map (old_name text, new_name text) on commit drop;
  delete from _rr_map;

  insert into _rr_map (old_name, new_name)
  select x.name, s.name
    from _rr_sessions s
    join public.event_sessions x on x.id = s.id
   where s.id is not null and x.name is distinct from s.name;

  insert into _rr_map (old_name, new_name)
  select x.name, v_first
    from public.event_sessions x
   where x.event_id = p_event_id
     and not exists (select 1 from _rr_sessions s where s.id = x.id);

  update public.guests g
     set session = m.new_name
    from _rr_map m
   where g.event_id = p_event_id and g.session = m.old_name;

  delete from public.event_sessions x
   where x.event_id = p_event_id
     and not exists (select 1 from _rr_sessions s where s.id = x.id);

  update public.event_sessions x
     set name = s.name, time_text = s.time_text, sort_order = s.idx + 1
    from _rr_sessions s
   where x.id = s.id and x.event_id = p_event_id;

  insert into public.event_sessions (event_id, name, time_text, sort_order)
  select p_event_id, s.name, s.time_text, s.idx + 1
    from _rr_sessions s
   where s.id is null;

  -- Tamu yang sesinya null / tidak dikenal diarahkan ke sesi pertama.
  update public.guests g
     set session = v_first
   where g.event_id = p_event_id
     and (g.session is null
          or not exists (select 1 from public.event_sessions x
                          where x.event_id = p_event_id and x.name = g.session));

  return json_build_object(
    'success', true,
    'sessions', (
      select coalesce(json_agg(json_build_object(
               'id', x.id, 'name', x.name, 'time_text', x.time_text) order by x.sort_order), '[]'::json)
        from public.event_sessions x where x.event_id = p_event_id
    )
  );
end;
$$;

revoke execute on function public.save_event_sessions(uuid, jsonb) from public, anon;
grant execute on function public.save_event_sessions(uuid, jsonb) to authenticated;

commit;

-- ============================================================
-- BAGIAN 2 — diterapkan setelah bagian 1
-- ============================================================
--
-- Catatan penerapan: fungsi pembaca ditulis ulang langsung lewat SQL
-- (bukan di file ini) karena badannya panjang. Ringkasan perubahannya:
--
--   get_invitation_details  DROP+CREATE; tambah kolom terakhir `sessions jsonb`
--                           session_time diambil dari event_sessions
--   get_event_preview       DROP+CREATE; sama, sesi pertama untuk tamu palsu
--   scanner_event_info      mengembalikan 'sessions' array (kunci lama dihapus)
--   create_event            DROP+CREATE; signature baru:
--                           (p_title, p_event_date, p_location,
--                            p_couple_name, p_slug, p_sessions jsonb)
--                           memanggil save_event_sessions() setelah insert
--   add_guest_by_client     sesi default = sesi pertama; validasi ke tabel
--   update_guest_by_client  idem
--   get_client_dashboard_data  event.sessions = array {id,name,time_text};
--                           filter_options.sessions dari tabel
--
-- PENTING: Supabase memasang pg_safeupdate, sehingga `delete from <temp>`
-- tanpa WHERE ditolak ("DELETE requires a WHERE clause").
-- Gunakan `delete from _rr_sessions where true;`.

begin;

drop trigger if exists trg_events_sync_session_names on public.events;
drop function if exists public.events_sync_session_names();

alter table public.events
  drop column if exists session_1_name,
  drop column if exists session_1_time,
  drop column if exists session_2_name,
  drop column if exists session_2_time;

commit;

-- Verifikasi:
--   select e.slug, s.sort_order, s.name, s.time_text
--     from public.event_sessions s join public.events e on e.id = s.event_id
--    order by e.slug, s.sort_order;
--
--   -- hapus sesi memindahkan tamu ke sesi pertama:
--   select public.save_event_sessions('<event_id>',
--          '[{"id":"<sesi_id>","name":"Akad","time_text":"10.00 WIB"}]'::jsonb);
