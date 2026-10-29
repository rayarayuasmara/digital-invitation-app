-- RayaRayu — P1 lanjutan: perbaiki tamu tanpa tiket di scanner
-- Diterapkan 2026-10-29 setelah smoke test produksi.
--
-- MASALAH
-- scanner_list_guests mengisi `ref` hanya dari tickets.id. Tamu yang belum
-- punya baris tiket (8 dari 22) mendapat ref null, sehingga tombolnya mati
-- di /scanner. Petugas tidak bisa check-in mereka dari daftar; hanya bisa
-- lewat scan QR.
--
-- PERBAIKAN
--   ref = coalesce(tickets.id, guests.id)
--   scanner_check_in menerima id tamu selain id tiket / token.
--   get_invitation_details berhenti menerima id tamu sebagai token, supaya
--   id tamu yang terlihat petugas tidak bisa dipakai membuka undangan.
--
-- Catatan: id tamu sudah lama diterima get_invitation_details. Tidak ada
-- satu pun link yang memakainya (sudah diperiksa: 0 kecocokan), jadi
-- penghapusan ini tidak memutus tautan apa pun.

begin;

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
    'ref', coalesce(t.id::text, g.id::text),
    'has_ticket', t.id is not null,
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
      and (g.id::text = v_input or lower(g.invitation_token) = v_input)
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

-- get_invitation_details: buang pencocokan id tamu
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
  limit 1;
end;
$fn$;

revoke all on function public.get_invitation_details(text) from public;
revoke execute on function public.get_invitation_details(text) from anon;
revoke execute on function public.get_invitation_details(text) from authenticated;
grant execute on function public.get_invitation_details(text) to anon, authenticated;

commit;

-- Verifikasi:
--   scanner_list_guests(kode) -> 22 tamu, 0 ref null (8 tanpa tiket)
--   scanner_check_in(kode, id tamu tanpa tiket) -> success
--   get_invitation_details(id tamu)  -> 0 baris
--   get_invitation_details(token)    -> 1 baris
--   /scanner live -> 22 baris, 0 tombol mati
