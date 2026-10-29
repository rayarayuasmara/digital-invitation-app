-- RayaRayu — P1: index & RLS initplan
-- Diterapkan 2026-10-29.
--
-- Isi:
--   1. Buang 4 index duplikat / berlebih
--   2. Tambah index untuk foreign key yang belum tertutup
--   3. Tulis ulang 5 policy RLS supaya auth.uid() dievaluasi sekali per query,
--      bukan sekali per baris (lint `auth_rls_initplan`)
--
-- Rollback index (kalau perlu):
--   create index guests_token_idx     on public.guests (lower(invitation_token));
--   create index guests_event_idx     on public.guests (event_id);
--   create unique index rsvps_guest_uidx   on public.rsvps (guest_id);
--   create unique index tickets_guest_uidx on public.tickets (guest_id);
--   drop index public.clients_user_id_idx;
--   drop index public.events_client_id_idx;
--   drop index public.wishes_guest_id_idx;
--   drop index public.tickets_scanned_by_idx;

begin;

-- ============================================================
-- 1. Index duplikat / berlebih
-- ============================================================

-- Sama persis dengan guests_invitation_token_lower_key (yang unique).
drop index if exists public.guests_token_idx;

-- (event_id) sudah jadi kolom depan di 4 index komposit:
-- guests_event_category_idx, guests_event_created_idx, guests_event_name_idx,
-- guests_event_session_idx. Index tunggal ini tidak menambah apa pun.
drop index if exists public.guests_event_idx;

-- Duplikat dari unique constraint rsvps_guest_id_key / tickets_guest_id_key.
-- Constraint-nya yang dipertahankan, index tambahan yang dibuang.
drop index if exists public.rsvps_guest_uidx;
drop index if exists public.tickets_guest_uidx;

-- ============================================================
-- 2. Index untuk foreign key
--    Tanpa ini, hapus/ubah baris induk memicu seq scan ke tabel anak,
--    dan policy RLS ikut memindai tanpa index.
-- ============================================================

create index if not exists clients_user_id_idx   on public.clients (user_id);
create index if not exists events_client_id_idx  on public.events (client_id);
create index if not exists wishes_guest_id_idx   on public.wishes (guest_id);
create index if not exists tickets_scanned_by_idx on public.tickets (scanned_by);

-- ============================================================
-- 3. Policy RLS: auth.uid() -> (select auth.uid())
--
-- Tanpa subselect, Postgres bisa memanggil auth.uid() untuk setiap baris
-- yang diperiksa. Dengan (select ...), hasilnya stabil dan dihitung sekali.
-- ============================================================

drop policy if exists "Allow client full access" on public.clients;
create policy "Allow client full access"
  on public.clients as permissive for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Allow events access" on public.events;
create policy "Allow events access"
  on public.events as permissive for all to public
  using (client_id in (
    select c.id from public.clients c where c.user_id = (select auth.uid())
  ));

drop policy if exists "Allow guests access" on public.guests;
create policy "Allow guests access"
  on public.guests as permissive for all to public
  using (event_id in (
    select e.id from public.events e
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));

drop policy if exists "Allow rsvps access" on public.rsvps;
create policy "Allow rsvps access"
  on public.rsvps as permissive for all to public
  using (guest_id in (
    select g.id from public.guests g
    join public.events e on e.id = g.event_id
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));

drop policy if exists "Allow tickets access" on public.tickets;
create policy "Allow tickets access"
  on public.tickets as permissive for all to public
  using (guest_id in (
    select g.id from public.guests g
    join public.events e on e.id = g.event_id
    join public.clients c on c.id = e.client_id
    where c.user_id = (select auth.uid())
  ));

commit;

-- Verifikasi (dilakukan sebelum & sesudah, hasil harus sama):
--   set local role authenticated + jwt sub = pemilik
--   clients 1 | events 1 | guests 22 | rsvps 21 | tickets 13 | wishes 12
--   set local role anon
--   clients 0 | events 0 | guests 0 | wishes 0
