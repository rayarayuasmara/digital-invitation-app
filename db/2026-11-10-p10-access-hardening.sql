-- RayaRayu — P10: tutup jalur tulis langsung dan validasi RPC publik
--
-- Terapkan setelah P9. Semua write aplikasi tetap melalui RPC SECURITY DEFINER,
-- kecuali tiga kolom events yang memang diedit langsung oleh dashboard dan
-- clients.phone. Grants kolom membatasi UPDATE agar status paket/admin,
-- publikasi, masa aktif, kode scanner, RSVP, tiket, dan token tidak bisa
-- diubah langsung lewat PostgREST.

begin;

-- ---------------------------------------------------------------
-- 1. RLS: baca sesuai pemilik; tidak ada ALL policy untuk tabel inti
-- ---------------------------------------------------------------

drop policy if exists "Allow client full access" on public.clients;
drop policy if exists clients_owner_select on public.clients;
drop policy if exists clients_owner_update_profile on public.clients;
create policy clients_owner_select on public.clients
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy clients_owner_update_profile on public.clients
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Allow events access" on public.events;
drop policy if exists events_owner_select on public.events;
drop policy if exists events_owner_update_dashboard_fields on public.events;
create policy events_owner_select on public.events
  for select to authenticated
  using (client_id in (
    select c.id from public.clients c where c.user_id = (select auth.uid())
  ));
create policy events_owner_update_dashboard_fields on public.events
  for update to authenticated
  using (client_id in (
    select c.id from public.clients c where c.user_id = (select auth.uid())
  ))
  with check (client_id in (
    select c.id from public.clients c where c.user_id = (select auth.uid())
  ));

drop policy if exists "Allow guests access" on public.guests;
drop policy if exists guests_owner_select on public.guests;
create policy guests_owner_select on public.guests
  for select to authenticated
  using (event_id in (
    select e.id from public.events e
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));

drop policy if exists "Allow rsvps access" on public.rsvps;
drop policy if exists rsvps_owner_select on public.rsvps;
create policy rsvps_owner_select on public.rsvps
  for select to authenticated
  using (guest_id in (
    select g.id from public.guests g
    join public.events e on e.id = g.event_id
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));

drop policy if exists "Allow tickets access" on public.tickets;
drop policy if exists tickets_owner_select on public.tickets;
create policy tickets_owner_select on public.tickets
  for select to authenticated
  using (guest_id in (
    select g.id from public.guests g
    join public.events e on e.id = g.event_id
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));

drop policy if exists "Klien bisa membaca ucapan acaranya" on public.wishes;
create policy wishes_owner_select on public.wishes
  for select to authenticated
  using (event_id in (
    select e.id from public.events e
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));

drop policy if exists client_addons_own on public.client_addons;
create policy client_addons_own on public.client_addons
  for select to authenticated
  using (exists (
    select 1 from public.clients c
    where c.id = client_addons.client_id
      and c.user_id = (select auth.uid())
  ));

drop policy if exists orders_own on public.orders;
create policy orders_own on public.orders
  for select to authenticated
  using (exists (
    select 1 from public.clients c
    where c.id = orders.client_id
      and c.user_id = (select auth.uid())
  ));

drop policy if exists event_sessions_owner on public.event_sessions;
create policy event_sessions_owner on public.event_sessions
  for select to authenticated
  using (exists (
    select 1 from public.events e
    join public.clients c on c.id = e.client_id
    where e.id = event_sessions.event_id
      and c.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------
-- 2. Hak tabel: default deny writes; kolom dashboard yang diperlukan saja
-- ---------------------------------------------------------------

revoke all privileges on table
  public.clients, public.events, public.guests, public.rsvps, public.tickets,
  public.wishes, public.plans, public.addons, public.client_addons,
  public.orders, public.app_settings, public.event_sessions
from public, anon, authenticated;

grant select on table
  public.clients, public.events, public.guests, public.rsvps, public.tickets,
  public.wishes, public.client_addons, public.orders, public.app_settings,
  public.event_sessions
to authenticated;

-- Katalog paket memang dibaca halaman publik.
grant select on table public.plans, public.addons to anon, authenticated;

-- Dashboard masih menyimpan nomor WA dan tiga field non-sensitif acara secara
-- langsung. Hak kolom + policy owner mencegah UPDATE kolom lain.
grant update (phone) on table public.clients to authenticated;
grant update (caption, wishes_seen_at, wa_templates)
  on table public.events to authenticated;

-- ---------------------------------------------------------------
-- 3. Hak EXECUTE: hanya fungsi yang memang dipakai publik tetap anonim
-- ---------------------------------------------------------------

revoke execute on function public.create_event(text, date, text, text, text, jsonb)
  from public, anon;
grant execute on function public.create_event(text, date, text, text, text, jsonb)
  to authenticated;

-- Helper/trigger bukan endpoint RPC. Trigger tetap berjalan tanpa grant
-- EXECUTE langsung kepada pemanggil API.
revoke execute on function public.events_guard_slug() from public, anon, authenticated;
revoke execute on function public.sync_client_plan_limits() from public, anon, authenticated;
revoke execute on function public.unique_event_slug(text, uuid) from public, anon, authenticated;

-- Semua fungsi di bawah ini hanya memakai built-in pg_catalog.
alter function public.slugify(text) set search_path = pg_catalog;

-- ---------------------------------------------------------------
-- 4. Validasi RSVP dan ucapan ditegakkan di database, bukan hanya UI
-- ---------------------------------------------------------------

create or replace function public.submit_rsvp(
  p_invitation_token text,
  p_status text,
  p_pax integer
)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_guest record;
  v_ent record;
begin
  if coalesce(btrim(p_invitation_token), '') = '' then
    return json_build_object('success', false, 'message', 'Token undangan tidak valid.');
  end if;
  if p_status is null or p_status not in ('hadir', 'tidak_hadir') then
    return json_build_object('success', false, 'message', 'Status RSVP tidak valid.');
  end if;

  select g.* into v_guest
    from public.guests g
   where lower(g.invitation_token) = lower(btrim(p_invitation_token))
   limit 1;
  if v_guest.id is null then
    return json_build_object('success', false, 'message', 'Undangan tidak ditemukan.');
  end if;

  if p_status = 'hadir' and (p_pax is null or p_pax < 1 or p_pax > v_guest.max_pax) then
    return json_build_object('success', false, 'message',
      format('Jumlah tamu harus antara 1 dan %s.', v_guest.max_pax));
  end if;
  if p_status = 'tidak_hadir' and p_pax is distinct from 0 then
    return json_build_object('success', false, 'message', 'Jumlah tamu harus 0 jika tidak hadir.');
  end if;

  select * into v_ent from public.event_entitlements(v_guest.event_id);
  if v_ent.is_published is not true then
    return json_build_object('success', false, 'message', 'Undangan belum diterbitkan.');
  end if;
  if coalesce(v_ent.is_expired, false) then
    return json_build_object('success', false, 'message', 'Masa aktif undangan telah berakhir.');
  end if;

  insert into public.rsvps (guest_id, status, pax_confirmed, session, category, updated_at)
  values (v_guest.id, p_status, p_pax, v_guest.session,
          coalesce(v_guest.category, 'Umum'), now())
  on conflict (guest_id) do update
    set status = excluded.status,
        pax_confirmed = excluded.pax_confirmed,
        session = excluded.session,
        category = excluded.category,
        updated_at = now();

  if p_status = 'hadir' then
    insert into public.tickets (guest_id, ticket_token, is_checked_in)
    values (v_guest.id, v_guest.invitation_token, false)
    on conflict (guest_id) do nothing;
  end if;

  return json_build_object('success', true, 'message', 'RSVP berhasil disimpan!',
    'guest_id', v_guest.id, 'token', v_guest.invitation_token);
end;
$function$;

create or replace function public.send_wish(p_token text, p_message text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_guest record;
  v_ent record;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if v_message = '' or char_length(v_message) > 300 then
    return jsonb_build_object('success', false,
      'message', 'Ucapan wajib diisi dan maksimal 300 karakter.');
  end if;

  select g.id, g.group_name, g.event_id into v_guest
    from public.guests g
   where lower(g.invitation_token) = lower(btrim(coalesce(p_token, '')))
   limit 1;
  if v_guest.event_id is null then
    return jsonb_build_object('success', false, 'message', 'Undangan tidak ditemukan.');
  end if;

  select * into v_ent from public.event_entitlements(v_guest.event_id);
  if v_ent.is_published is not true then
    return jsonb_build_object('success', false, 'message', 'Undangan belum diterbitkan.');
  end if;
  if coalesce(v_ent.is_expired, false) then
    return jsonb_build_object('success', false, 'message', 'Masa aktif undangan telah berakhir.');
  end if;

  insert into public.wishes (event_id, guest_id, guest_name, message)
  values (v_guest.event_id, v_guest.id, v_guest.group_name, v_message);

  return jsonb_build_object('success', true, 'message', 'Ucapan berhasil dikirim.');
end;
$function$;

-- Pertahankan kontrak endpoint: kedua RPC memang dipanggil tanpa login.
revoke execute on function public.submit_rsvp(text, text, integer) from public;
grant execute on function public.submit_rsvp(text, text, integer) to anon, authenticated;
revoke execute on function public.send_wish(text, text) from public;
grant execute on function public.send_wish(text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 5. Index untuk foreign key yang ditandai Supabase Performance Advisor
-- ---------------------------------------------------------------

create index if not exists client_addons_addon_code_idx
  on public.client_addons (addon_code);
create index if not exists orders_addon_code_idx
  on public.orders (addon_code);
create index if not exists orders_event_id_idx
  on public.orders (event_id);
create index if not exists orders_plan_code_idx
  on public.orders (plan_code);

-- Gagalkan migrasi jika grants lama masih memberi hak tulis tabel secara luas.
do $guard$
declare
  v_table text;
begin
  foreach v_table in array array[
    'public.clients', 'public.events', 'public.guests', 'public.rsvps',
    'public.tickets', 'public.wishes', 'public.plans', 'public.addons',
    'public.client_addons', 'public.orders', 'public.app_settings',
    'public.event_sessions'
  ] loop
    if has_table_privilege('anon', v_table, 'INSERT')
       or has_table_privilege('anon', v_table, 'UPDATE')
       or has_table_privilege('anon', v_table, 'DELETE') then
      raise exception 'P10: role anon masih punya hak tulis pada %', v_table;
    end if;
    if has_table_privilege('authenticated', v_table, 'INSERT')
       or has_table_privilege('authenticated', v_table, 'UPDATE')
       or has_table_privilege('authenticated', v_table, 'DELETE') then
      raise exception 'P10: role authenticated masih punya hak tulis tabel pada %', v_table;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.clients', 'UPDATE')
     or has_column_privilege('authenticated', 'public.clients', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.clients', 'tier', 'UPDATE')
     or has_column_privilege('authenticated', 'public.events', 'expires_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.events', 'published_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.events', 'scanner_code', 'UPDATE') then
    raise exception 'P10: kolom sensitif masih dapat diubah langsung';
  end if;

  if not has_column_privilege('authenticated', 'public.clients', 'phone', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.events', 'caption', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.events', 'wishes_seen_at', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.events', 'wa_templates', 'UPDATE') then
    raise exception 'P10: hak UPDATE kolom dashboard yang dibutuhkan hilang';
  end if;
end;
$guard$;

commit;

-- Verifikasi grants (phone/caption/wishes_seen_at/wa_templates adalah satu-
-- satunya hak UPDATE langsung yang boleh dimiliki authenticated):
--   select has_table_privilege('authenticated','public.clients','UPDATE');
--     -- false
--   select has_column_privilege('authenticated','public.clients','phone','UPDATE');
--     -- true
--   select has_column_privilege('authenticated','public.clients','role','UPDATE');
--     -- false
--   select has_column_privilege('authenticated','public.events','expires_at','UPDATE');
--     -- false
--   select has_column_privilege('authenticated','public.events','wa_templates','UPDATE');
--     -- true
-- Uji sebagai akun klien: ubah phone / wa_templates berhasil; ubah role,
-- tier, published_at, expires_at, scanner_code, RSVP, dan ticket ditolak.
