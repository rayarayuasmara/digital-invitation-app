-- RayaRayu — P0 hardening, TAHAP 1: penambahan objek baru.
-- Aman dijalankan lebih dulu: tidak menghapus policy, tidak mencabut akses.
-- Frontend lama tetap jalan setelah migrasi ini.
--
-- Rollback: drop function scanner_* / get_event_rsvp_summary /
--           events_rotate_scanner_code, lalu drop column events.scanner_code.

begin;

-- ============================================================
-- 1. Kode akses petugas per acara
-- ============================================================

alter table public.events add column if not exists scanner_code text;

create unique index if not exists events_scanner_code_key
  on public.events (scanner_code)
  where scanner_code is not null;

comment on column public.events.scanner_code is
  'Kode akses untuk /scanner. Hanya memberi akses baca daftar tamu + check-in pada acara ini.';


-- ============================================================
-- 2. Buat / ganti kode petugas (hanya pemilik acara)
-- ============================================================

create or replace function public.events_rotate_scanner_code(p_event_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_event_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  join public.clients c on c.id = e.client_id
  where c.user_id = auth.uid()
    and (p_event_id is null or e.id = p_event_id)
  limit 1;

  if v_event_id is null then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;

  -- 16 hex = 64 bit acak. Cukup kuat untuk kode yang dibagikan ke petugas.
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

  update public.events set scanner_code = v_code where id = v_event_id;

  return json_build_object('success', true, 'event_id', v_event_id, 'code', v_code);
end;
$fn$;

revoke all on function public.events_rotate_scanner_code(uuid) from public;
grant execute on function public.events_rotate_scanner_code(uuid) to authenticated;


-- ============================================================
-- 3. Info acara untuk kode petugas (tanpa data klien)
-- ============================================================

create or replace function public.scanner_event_info(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_code text := btrim(coalesce(p_code, ''));
  v_result json;
begin
  if v_code = '' then
    return json_build_object('success', false, 'message', 'Kode akses kosong.');
  end if;

  select json_build_object(
    'success', true,
    'event_title', coalesce(e.title, 'Acara'),
    'event_date', e.event_date,
    'event_location', coalesce(e.location, ''),
    'session_1_name', e.session_1_name,
    'session_1_time', e.session_1_time,
    'session_2_name', e.session_2_name,
    'session_2_time', e.session_2_time
  )
  into v_result
  from public.events e
  where e.scanner_code = v_code;

  return coalesce(v_result, json_build_object('success', false, 'message', 'Kode akses tidak valid.'));
end;
$fn$;

revoke all on function public.scanner_event_info(text) from public;
grant execute on function public.scanner_event_info(text) to anon, authenticated;


-- ============================================================
-- 4. Daftar tamu untuk petugas
--    Tidak mengembalikan: phone, invitation_token, ticket_token, id tamu.
--    `ref` = tickets.id, dipakai untuk check-in tanpa membocorkan token undangan.
-- ============================================================

create or replace function public.scanner_list_guests(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_event_id uuid;
  v_result json;
begin
  select e.id into v_event_id
  from public.events e
  where e.scanner_code = btrim(coalesce(p_code, ''));

  if v_event_id is null then
    return json_build_object('success', false, 'message', 'Kode akses tidak valid atau sudah diganti.');
  end if;

  select json_agg(json_build_object(
    'ref', t.id,
    'group_name', g.group_name,
    'category', coalesce(g.category, 'Umum'),
    'max_pax', g.max_pax,
    'pax_confirmed', coalesce(r.pax_confirmed, g.max_pax),
    'rsvp_status', coalesce(r.status, 'pending'),
    'is_checked_in', coalesce(t.is_checked_in, false),
    'checked_in_at', t.checked_in_at,
    'session', g.session
  ) order by g.group_name asc)
  into v_result
  from public.guests g
  left join public.tickets t on t.guest_id = g.id
  left join public.rsvps r on r.guest_id = g.id
  where g.event_id = v_event_id;

  return json_build_object('success', true, 'guests', coalesce(v_result, '[]'::json));
end;
$fn$;

revoke all on function public.scanner_list_guests(text) from public;
grant execute on function public.scanner_list_guests(text) to anon, authenticated;


-- ============================================================
-- 5. Check-in untuk petugas
--    p_input boleh: tickets.id (ref), ticket_token, atau invitation_token.
--    Hanya bisa menyentuh tamu pada acara pemilik kode.
-- ============================================================

create or replace function public.scanner_check_in(p_code text, p_input text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_event_id uuid;
  v_input text := lower(btrim(coalesce(p_input, '')));
  v_ticket record;
  v_guest record;
begin
  select e.id into v_event_id
  from public.events e
  where e.scanner_code = btrim(coalesce(p_code, ''));

  if v_event_id is null then
    return json_build_object('success', false, 'message', 'Kode akses tidak valid atau sudah diganti.');
  end if;

  if v_input = '' then
    return json_build_object('success', false, 'message', 'Kode tiket kosong.');
  end if;

  select t.id, t.guest_id, t.is_checked_in, t.checked_in_at,
         g.group_name, g.category, g.max_pax, g.session,
         r.status as rsvp_status, r.pax_confirmed
  into v_ticket
  from public.tickets t
  join public.guests g on g.id = t.guest_id
  left join public.rsvps r on r.guest_id = g.id
  where g.event_id = v_event_id
    and (t.id::text = v_input
         or lower(t.ticket_token) = v_input
         or lower(g.invitation_token) = v_input)
  limit 1;

  if v_ticket.guest_id is null then
    select g.id, g.group_name, g.category, g.max_pax, g.invitation_token, g.session,
           r.status as rsvp_status, r.pax_confirmed
    into v_guest
    from public.guests g
    left join public.rsvps r on r.guest_id = g.id
    where g.event_id = v_event_id
      and lower(g.invitation_token) = v_input
    limit 1;

    if v_guest.id is null then
      return json_build_object('success', false, 'message', 'Tiket tidak terdaftar pada acara ini.');
    end if;

    insert into public.tickets (guest_id, ticket_token, is_checked_in, checked_in_at)
    values (v_guest.id, v_guest.invitation_token, true, now());

    update public.guests set is_checked_in = true where id = v_guest.id;

    return json_build_object(
      'success', true,
      'message', 'Check-in berhasil.',
      'guest', json_build_object(
        'group_name', v_guest.group_name,
        'category', coalesce(v_guest.category, 'Umum'),
        'max_pax', v_guest.max_pax,
        'pax_confirmed', coalesce(v_guest.pax_confirmed, v_guest.max_pax),
        'rsvp_status', coalesce(v_guest.rsvp_status, 'pending'),
        'session', v_guest.session
      )
    );
  end if;

  if v_ticket.is_checked_in then
    return json_build_object(
      'success', false,
      'already_checked_in', true,
      'message', 'Tiket sudah digunakan pada ' || to_char(coalesce(v_ticket.checked_in_at, now()), 'HH24:MI') || '.',
      'guest', json_build_object(
        'group_name', v_ticket.group_name,
        'category', coalesce(v_ticket.category, 'Umum'),
        'max_pax', v_ticket.max_pax,
        'pax_confirmed', coalesce(v_ticket.pax_confirmed, v_ticket.max_pax),
        'rsvp_status', coalesce(v_ticket.rsvp_status, 'pending'),
        'session', v_ticket.session,
        'checked_in_at', v_ticket.checked_in_at
      )
    );
  end if;

  update public.tickets
  set is_checked_in = true, checked_in_at = now()
  where id = v_ticket.id;

  update public.guests set is_checked_in = true where id = v_ticket.guest_id;

  return json_build_object(
    'success', true,
    'message', 'Check-in berhasil.',
    'guest', json_build_object(
      'group_name', v_ticket.group_name,
      'category', coalesce(v_ticket.category, 'Umum'),
      'max_pax', v_ticket.max_pax,
      'pax_confirmed', coalesce(v_ticket.pax_confirmed, v_ticket.max_pax),
      'rsvp_status', coalesce(v_ticket.rsvp_status, 'pending'),
      'session', v_ticket.session
    )
  );
end;
$fn$;

revoke all on function public.scanner_check_in(text, text) from public;
grant execute on function public.scanner_check_in(text, text) to anon, authenticated;


-- ============================================================
-- 6. Ringkasan RSVP untuk halaman undangan
--    Dipakai loadSummary(). Hanya nama + status + pax, tanpa phone.
-- ============================================================

create or replace function public.get_event_rsvp_summary(p_token text)
returns table(guest_name text, rsvp_status text, pax_confirmed integer, max_pax integer)
language sql
security definer
set search_path = public, pg_temp
as $fn$
  with ev as (
    select g.event_id
    from public.guests g
    where lower(btrim(g.invitation_token)) = lower(btrim(p_token))
    limit 1
  )
  select g.group_name, r.status, coalesce(r.pax_confirmed, g.max_pax), g.max_pax
  from public.guests g
  join ev on ev.event_id = g.event_id
  left join public.rsvps r on r.guest_id = g.id;
$fn$;

revoke all on function public.get_event_rsvp_summary(text) from public;
grant execute on function public.get_event_rsvp_summary(text) to anon, authenticated;


-- ============================================================
-- 7. delete_guest_by_client: tambah cek pemilik
-- ============================================================

create or replace function public.delete_guest_by_client(p_guest_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_deleted uuid;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  delete from public.guests g
  using public.events e, public.clients c
  where g.id = p_guest_id
    and e.id = g.event_id
    and c.id = e.client_id
    and c.user_id = auth.uid()
  returning g.id into v_deleted;

  if v_deleted is null then
    return json_build_object('success', false, 'message', 'Tamu tidak ditemukan.');
  end if;

  return json_build_object('success', true, 'message', 'Tamu berhasil dihapus');
end;
$fn$;


-- ============================================================
-- 8. Kunci search_path fungsi yang masih mutable
-- ============================================================

alter function public.check_in_guest(text)          set search_path = public, pg_temp;
alter function public.get_event_wishes(text)        set search_path = public, pg_temp;
alter function public.send_wish(text, text)         set search_path = public, pg_temp;
alter function public.process_check_in(text)        set search_path = public, pg_temp;
alter function public.rsvp_fill_guest_meta()        set search_path = public, pg_temp;
alter function public.sync_rsvp_guest_meta()        set search_path = public, pg_temp;

commit;
