-- RayaRayu — P0 hardening, TAHAP 2: menutup kebocoran.
-- Diterapkan 2026-10-29 ke project awwraxmftlbekclwdrix.
--
-- PRASYARAT: Tahap 1 (2026-10-29-p0-step1-additive.sql) sudah dijalankan DAN
-- frontend yang memakai RPC baru sudah ter-deploy. Kalau file ini dijalankan
-- sebelum frontend baru live, scanner & undangan akan rusak.
--
-- Rollback: pakai db/backup/2026-10-29-p0-before.sql, lalu jalankan ulang
-- definisi fungsi dari file step1.
--
-- Ringkasan:
--   1. get_scanner_guests  -> wajib login + dibatasi ke acara pemiliknya
--   2. check_in_guest      -> wajib login + dibatasi ke acara pemiliknya
--   3. Hapus 7 policy yang membuka seluruh tabel ke anon
--   4. wishes: ganti dengan policy baca khusus pemilik acara (dashboard)
--   5. Cabut EXECUTE anon/PUBLIC dari RPC yang hanya untuk pemilik acara
--
-- Catatan penting: `revoke ... from anon` TIDAK cukup kalau grant-nya datang
-- dari PUBLIC. Harus `revoke ... from public` lalu `grant ... to authenticated`.

-- ============================================================
-- 1. get_scanner_guests: khusus pemilik acara
-- ============================================================

create or replace function public.get_scanner_guests(p_event_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_event_id uuid;
  v_result json;
begin
  if auth.uid() is null then
    return '[]'::json;
  end if;

  select e.id into v_event_id
  from public.events e
  join public.clients c on c.id = e.client_id
  where c.user_id = auth.uid()
    and (p_event_id is null or e.id = p_event_id)
  limit 1;

  if v_event_id is null then
    return '[]'::json;
  end if;

  select json_agg(json_build_object(
    'id', g.id,
    'group_name', g.group_name,
    'category', coalesce(g.category, 'Umum'),
    'max_pax', g.max_pax,
    'invitation_token', g.invitation_token,
    'ticket_token', coalesce(t.ticket_token, g.invitation_token),
    'is_checked_in', coalesce(t.is_checked_in, false),
    'pax_confirmed', coalesce(r.pax_confirmed, g.max_pax),
    'rsvp_status', coalesce(r.status, 'pending')
  ) order by g.group_name asc)
  into v_result
  from public.guests g
  left join public.tickets t on t.guest_id = g.id
  left join public.rsvps r on r.guest_id = g.id
  where g.event_id = v_event_id;

  return coalesce(v_result, '[]'::json);
end;
$fn$;

revoke execute on function public.get_scanner_guests(uuid) from public;
grant execute on function public.get_scanner_guests(uuid) to authenticated;


-- ============================================================
-- 2. check_in_guest: khusus pemilik acara
-- ============================================================

create or replace function public.check_in_guest(p_ticket_token text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_guest record;
  v_ticket record;
  v_cleaned_token text;
  v_scanned_by uuid;
  v_event_id uuid;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Akses ditolak. Petugas wajib login.');
  end if;

  select e.id into v_event_id
  from public.events e
  join public.clients c on c.id = e.client_id
  where c.user_id = auth.uid()
  limit 1;

  if v_event_id is null then
    return json_build_object('success', false, 'message', 'Akses ditolak.');
  end if;

  v_cleaned_token := trim(lower(p_ticket_token));
  v_scanned_by := auth.uid();

  select t.*, g.id as g_id, g.group_name, g.category, g.max_pax, g.event_id,
         r.pax_confirmed, r.status as rsvp_status
  into v_ticket
  from public.tickets t
  join public.guests g on t.guest_id = g.id
  left join public.rsvps r on r.guest_id = g.id
  where g.event_id = v_event_id
    and (lower(t.ticket_token) = v_cleaned_token or lower(g.invitation_token) = v_cleaned_token)
  limit 1;

  if v_ticket is null then
    select g.id as g_id, g.group_name, g.category, g.max_pax, g.event_id, g.invitation_token,
           r.pax_confirmed, r.status as rsvp_status
    into v_guest
    from public.guests g
    left join public.rsvps r on g.id = r.guest_id
    where g.event_id = v_event_id
      and lower(g.invitation_token) = v_cleaned_token
    limit 1;

    if v_guest is not null then
      insert into public.tickets (guest_id, ticket_token, is_checked_in, checked_in_at, scanned_by)
      values (v_guest.g_id, v_guest.invitation_token, true, now(), v_scanned_by)
      returning * into v_ticket;

      update public.guests set is_checked_in = true where id = v_guest.g_id;

      return json_build_object(
        'success', true,
        'message', 'Berhasil check-in (tiket baru otomatis dibuat).',
        'guest', json_build_object(
          'id', v_guest.g_id,
          'group_name', v_guest.group_name,
          'category', coalesce(v_guest.category, 'Umum'),
          'max_pax', v_guest.max_pax,
          'pax_confirmed', coalesce(v_guest.pax_confirmed, v_guest.max_pax),
          'ticket_token', v_guest.invitation_token
        )
      );
    else
      return json_build_object(
        'success', false,
        'message', 'Tiket tidak ditemukan. Periksa kembali kode atau QR tamu.',
        'guest', null
      );
    end if;
  end if;

  if v_ticket.is_checked_in = true then
    update public.guests set is_checked_in = true where id = v_ticket.g_id;

    return json_build_object(
      'success', false,
      'message', 'Peringatan: Tiket ini sudah pernah melakukan check-in!',
      'guest', json_build_object(
        'id', v_ticket.g_id,
        'group_name', v_ticket.group_name,
        'category', coalesce(v_ticket.category, 'Umum'),
        'max_pax', v_ticket.max_pax,
        'pax_confirmed', coalesce(v_ticket.pax_confirmed, v_ticket.max_pax),
        'checked_in_at', v_ticket.checked_in_at
      )
    );
  end if;

  update public.tickets
  set is_checked_in = true, checked_in_at = now(), scanned_by = v_scanned_by
  where id = v_ticket.id;

  update public.guests set is_checked_in = true where id = v_ticket.g_id;

  return json_build_object(
    'success', true,
    'message', 'Berhasil check-in.',
    'guest', json_build_object(
      'id', v_ticket.g_id,
      'group_name', v_ticket.group_name,
      'category', coalesce(v_ticket.category, 'Umum'),
      'max_pax', v_ticket.max_pax,
      'pax_confirmed', coalesce(v_ticket.pax_confirmed, v_ticket.max_pax),
      'ticket_token', v_ticket.ticket_token
    )
  );
end;
$fn$;

revoke execute on function public.check_in_guest(text) from public;
grant execute on function public.check_in_guest(text) to authenticated;


-- ============================================================
-- 3. Hapus policy yang membuka seluruh tabel ke anon
--    (semuanya `using (true)` / `with check (true)`)
-- ============================================================

drop policy if exists "Tamu bisa membaca data sendiri via token" on public.guests;
drop policy if exists "Tamu bisa melihat tiket sendiri" on public.tickets;
drop policy if exists "Tamu bisa memperbarui RSVP" on public.rsvps;
drop policy if exists "Tamu bisa membuat RSVP" on public.rsvps;
drop policy if exists "Petugas terautentikasi bisa check-in tiket" on public.tickets;
drop policy if exists "Publik bisa membaca ucapan" on public.wishes;
drop policy if exists "Publik bisa mengirim ucapan" on public.wishes;


-- ============================================================
-- 4. wishes: dashboard tetap bisa membaca ucapan acaranya sendiri
--    (akses tamu sudah lewat RPC get_event_wishes / send_wish)
-- ============================================================

create policy "Klien bisa membaca ucapan acaranya"
  on public.wishes for select to authenticated
  using (event_id in (
    select e.id from public.events e
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));


-- ============================================================
-- 5. Cabut akses anon/PUBLIC dari RPC pemilik acara
-- ============================================================

revoke execute on function public.check_in_guest(text) from public;
revoke execute on function public.delete_guest_by_client(uuid) from public;
revoke execute on function public.events_rotate_scanner_code(uuid) from public;
revoke execute on function public.get_client_dashboard_data() from public;
revoke execute on function public.get_scanner_guests(uuid) from public;
revoke execute on function public.list_client_guests(text, text[], text[], text[], text, text, text, integer, integer) from public;
revoke execute on function public.process_check_in(text) from public;
revoke execute on function public.add_guest_by_client(text, text, integer, text, text, text) from public;
revoke execute on function public.update_guest_by_client(uuid, text, text, integer, text, text, boolean, boolean, text, text) from public;
revoke execute on function public.update_guest_sent_status(uuid, boolean) from public;

grant execute on function public.check_in_guest(text) to authenticated;
grant execute on function public.delete_guest_by_client(uuid) to authenticated;
grant execute on function public.events_rotate_scanner_code(uuid) to authenticated;
grant execute on function public.get_client_dashboard_data() to authenticated;
grant execute on function public.get_scanner_guests(uuid) to authenticated;
grant execute on function public.list_client_guests(text, text[], text[], text[], text, text, text, integer, integer) to authenticated;
grant execute on function public.process_check_in(text) to authenticated;
grant execute on function public.add_guest_by_client(text, text, integer, text, text, text) to authenticated;
grant execute on function public.update_guest_by_client(uuid, text, text, integer, text, text, boolean, boolean, text, text) to authenticated;
grant execute on function public.update_guest_sent_status(uuid, boolean) to authenticated;


-- ============================================================
-- 6. get_invitation_details: tambah guest_id & event_id
--    (dipakai frontend; sebelumnya bergantung pada policy bocor)
--    Harus DI DROP dulu karena return type berubah.
-- ============================================================

drop function if exists public.get_invitation_details(text);

create function public.get_invitation_details(p_token text)
returns table(
  event_title text, client_name text, event_caption text, event_date timestamptz,
  event_location text, group_name text, max_pax integer, rsvp_status text,
  pax_confirmed integer, is_checked_in boolean, invitation_token text,
  ticket_token text, session_name text, session_time text,
  guest_id uuid, event_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_clean text;
begin
  v_clean := lower(trim(p_token));
  v_clean := regexp_replace(v_clean, '[‐‑‒–—―−]', '-', 'g');

  return query
  select
    coalesce(e.title, 'Undangan Pernikahan'),
    coalesce(c.name, 'Mempelai'),
    coalesce(e.caption, 'Tanpa Mengurangi Rasa Hormat...'),
    e.event_date,
    coalesce(e.location, 'Lokasi Acara'),
    g.group_name,
    g.max_pax,
    r.status,
    coalesce(r.pax_confirmed, g.max_pax),
    coalesce(t.is_checked_in, false),
    g.invitation_token,
    t.ticket_token,
    g.session,
    case when g.session = e.session_2_name then e.session_2_time else e.session_1_time end,
    g.id,
    g.event_id
  from public.guests g
  left join public.events e on g.event_id = e.id
  left join public.clients c on e.client_id = c.id
  left join public.tickets t on t.guest_id = g.id
  left join public.rsvps r on r.guest_id = g.id
  where lower(trim(g.invitation_token)) = v_clean
     or lower(trim(t.ticket_token)) = v_clean
     or lower(trim(g.id::text)) = v_clean
  limit 1;
end;
$fn$;

revoke all on function public.get_invitation_details(text) from public;
grant execute on function public.get_invitation_details(text) to anon, authenticated;


-- ============================================================
-- Verifikasi setelah dijalankan (harus begini hasilnya):
--
--   anon GET /rest/v1/guests?select=*        -> []
--   anon GET /rest/v1/tickets?select=*       -> []
--   anon GET /rest/v1/rsvps?select=*         -> []
--   anon GET /rest/v1/wishes?select=*        -> []
--   anon rpc get_scanner_guests              -> []
--   anon rpc check_in_guest                  -> "Akses ditolak. Petugas wajib login."
--   anon rpc delete_guest_by_client          -> "Unauthorized"
--   anon rpc get_invitation_details          -> tetap 200, ada guest_id/event_id
--   anon rpc get_event_wishes                -> tetap 200
--   anon rpc scanner_list_guests(kode valid) -> tetap 200
-- ============================================================
