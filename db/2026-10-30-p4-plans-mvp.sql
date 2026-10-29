-- RayaRayu — P4: fondasi monetisasi MVP (paket, masa aktif, publish, watermark)
-- DITERAPKAN 2026-10-30 (lihat catatan di akhir file).
--
-- Yang disiapkan (fitur yang dipakai MVP ditandai *):
--   plans *            harga + limit + fitur sebagai data
--   addons             katalog addon (belum ada UI)
--   client_addons      addon aktif per klien/acara
--   orders *           keranjang pembayaran (manual dulu, Midtrans nanti)
--   events.published_at *  null = draf, belum bisa dibuka tamu
--   events.expires_at *    batas masa aktif, null = tanpa batas (data lama)
--   events.theme_id        placeholder tema
--   clients.plan_started_at
--
-- Prinsip: semua penegakan membaca public.event_entitlements(), bukan kolom
-- yang berbeda-beda. Ganti harga = ubah isi public.plans, bukan kode.
--
-- Aman diulang: semua DDL pakai IF NOT EXISTS dan seed pakai ON CONFLICT.

begin;

-- ============================================================
-- 1. Katalog paket
-- ============================================================

create table if not exists public.plans (
  code        text primary key,
  name        text not null,
  price       integer not null default 0,
  billing     text not null default 'once' check (billing in ('once', 'monthly')),
  limits      jsonb not null default '{}'::jsonb,
  features    jsonb not null default '{}'::jsonb,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.plans (code, name, price, billing, sort_order, limits, features) values
  ('free', 'Free', 0, 'once', 10,
   '{"events":1,"guests":30,"pax":100,"themes":3,"photos":3,"sessions":1,"devices":1,"active_days":60,"grace_days":7}',
   '{"watermark":true,"export":"none","custom_domain":false,"custom_slug":false,"wa_templates":1,"bank_accounts":1,"auto_blast":false}'),

  ('silver', 'Silver', 99000, 'once', 20,
   '{"events":1,"guests":300,"pax":1000,"themes":10,"photos":20,"sessions":2,"devices":2,"active_days":90,"grace_days":30}',
   '{"watermark":false,"export":"csv","custom_domain":false,"custom_slug":true,"wa_templates":3,"bank_accounts":2,"auto_blast":false}'),

  ('gold', 'Gold', 199000, 'once', 30,
   '{"events":1,"guests":1000,"pax":4000,"themes":999,"photos":200,"sessions":2,"devices":5,"active_days":180,"grace_days":90}',
   '{"watermark":false,"export":"pdf","custom_domain":false,"custom_slug":true,"wa_templates":99,"bank_accounts":5,"auto_blast":true}'),

  -- Legacy: akun uji yang sudah ada ber-tier 'pro'. Jangan dihapus sebelum
  -- semua klien dipindahkan ke salah satu paket di atas.
  ('pro', 'Pro (legacy)', 0, 'once', 90,
   '{"events":20,"guests":1000,"pax":5000,"themes":999,"photos":999,"sessions":2,"devices":20,"active_days":3650,"grace_days":365}',
   '{"watermark":false,"export":"pdf","custom_domain":true,"custom_slug":true,"wa_templates":99,"bank_accounts":99,"auto_blast":true}')
on conflict (code) do update
  set name = excluded.name, price = excluded.price, billing = excluded.billing,
      sort_order = excluded.sort_order, limits = excluded.limits,
      features = excluded.features;

-- ============================================================
-- 2. Katalog addon (belum ada UI; resolver sudah menghitungnya)
-- ============================================================

create table if not exists public.addons (
  code       text primary key,
  name       text not null,
  price      integer not null default 0,
  meta       jsonb not null default '{}'::jsonb,
  is_active  boolean not null default true
);

insert into public.addons (code, name, price, meta) values
  ('guests100', '+100 tamu',        29000, '{"guests":100}'),
  ('extend30',  'Perpanjang 30 hari', 29000, '{"days":30}')
on conflict (code) do update
  set name = excluded.name, price = excluded.price, meta = excluded.meta;

create table if not exists public.client_addons (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  event_id    uuid references public.events(id) on delete cascade,
  addon_code  text not null references public.addons(code),
  qty         integer not null default 1 check (qty > 0),
  amount      integer not null default 0,
  starts_at   timestamptz not null default now(),
  expires_at  timestamptz,
  status      text not null default 'active' check (status in ('active', 'used', 'void')),
  order_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists client_addons_client_idx on public.client_addons (client_id);
create index if not exists client_addons_event_idx  on public.client_addons (event_id);

-- ============================================================
-- 3. Order / pembayaran (manual dulu, Midtrans nanti)
-- ============================================================

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  event_id      uuid references public.events(id) on delete set null,
  plan_code     text references public.plans(code),
  addon_code    text references public.addons(code),
  qty           integer not null default 1,
  amount        integer not null default 0,
  status        text not null default 'pending'
                check (status in ('pending', 'paid', 'failed', 'expired', 'refunded')),
  provider      text not null default 'manual',
  provider_ref  text,
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists orders_client_idx on public.orders (client_id);
create unique index if not exists orders_provider_ref_idx
  on public.orders (provider, provider_ref) where provider_ref is not null;

-- ============================================================
-- 4. Kolom baru + backfill
-- ============================================================

alter table public.events  add column if not exists published_at timestamptz;
alter table public.events  add column if not exists expires_at   timestamptz;
alter table public.events  add column if not exists theme_id     text not null default 'classic';
alter table public.clients add column if not exists plan_started_at timestamptz;

-- Data lama: anggap sudah terbit dan tanpa masa aktif. Tanpa ini semua
-- undangan yang sudah beredar akan tampil "belum diterbitkan".
update public.events
   set published_at = created_at
 where published_at is null;

update public.clients
   set plan_started_at = created_at
 where plan_started_at is null;

create index if not exists events_published_idx on public.events (published_at);

-- ============================================================
-- 5. Sinkronisasi limit klien dengan katalog paket
--    guest_limit / event_limit jadi turunan, bukan sumber kebenaran.
-- ============================================================

create or replace function public.sync_client_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans%rowtype;
begin
  select * into v_plan from public.plans where code = new.tier;
  if v_plan.code is null then
    return new;
  end if;
  new.guest_limit := coalesce((v_plan.limits->>'guests')::int, new.guest_limit);
  new.event_limit := coalesce((v_plan.limits->>'events')::int, new.event_limit);
  return new;
end;
$$;

drop trigger if exists trg_sync_client_plan on public.clients;
create trigger trg_sync_client_plan
  before insert or update of tier on public.clients
  for each row execute function public.sync_client_plan_limits();

-- Terapkan ke baris yang sudah ada.
update public.clients c
   set guest_limit = coalesce((p.limits->>'guests')::int, c.guest_limit),
       event_limit = coalesce((p.limits->>'events')::int, c.event_limit)
  from public.plans p
 where p.code = c.tier;

-- ============================================================
-- 6. Resolver: satu-satunya sumber kebenaran
-- ============================================================

create or replace function public.event_entitlements(p_event_id uuid)
returns table (
  plan_code    text,
  plan_name    text,
  guest_limit  integer,
  pax_limit    integer,
  event_limit  integer,
  published_at timestamptz,
  expires_at   timestamptz,
  is_published boolean,
  is_expired   boolean,
  watermark    boolean,
  theme_id     text,
  features     jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ev as (
    select e.id, e.client_id, e.event_date, e.published_at, e.expires_at, e.theme_id,
           coalesce(c.tier, 'free') as tier
      from public.events e
      left join public.clients c on c.id = e.client_id
     where e.id = p_event_id
  ),
  pl as (
    select p.code, p.name, p.limits, p.features
      from public.plans p
     where p.code = (select tier from ev)
  ),
  ad as (
    select coalesce(sum(((a.meta->>'guests')::int) * ca.qty), 0) as extra_guests,
           coalesce(sum(((a.meta->>'days')::int)  * ca.qty), 0) as extra_days
      from public.client_addons ca
      join public.addons a on a.code = ca.addon_code
     where ca.status = 'active'
       and ca.client_id = (select client_id from ev)
       and (ca.event_id is null or ca.event_id = p_event_id)
       and (ca.expires_at is null or ca.expires_at > now())
  ),
  base as (
    select ev.*, pl.code as p_code, pl.name as p_name, pl.limits, pl.features,
           ad.extra_guests, ad.extra_days,
           case when ev.expires_at is null then null
                else ev.expires_at + (ad.extra_days || ' days')::interval
           end as eff_expires
      from ev
      cross join ad
      left join pl on true
  )
  select
    coalesce(p_code, 'free')                                     as plan_code,
    coalesce(p_name, 'Free')                                     as plan_name,
    (coalesce((limits->>'guests')::int, 30) + extra_guests)::int as guest_limit,
    coalesce((limits->>'pax')::int, 100)                         as pax_limit,
    coalesce((limits->>'events')::int, 1)                        as event_limit,
    published_at,
    eff_expires                                                  as expires_at,
    published_at is not null                                     as is_published,
    (eff_expires is not null and now() > eff_expires)            as is_expired,
    coalesce((features->>'watermark')::boolean, true)            as watermark,
    coalesce(theme_id, 'classic')                                as theme_id,
    coalesce(features, '{}'::jsonb)                              as features
  from base;
$$;

-- Dipakai internal oleh RPC SECURITY DEFINER. Jangan dibuka ke anon.
-- CATATAN: fungsi baru otomatis punya EXECUTE untuk PUBLIC, jadi mencabut
-- dari anon/authenticated saja TIDAK cukup — harus dari PUBLIC juga.
revoke execute on function public.event_entitlements(uuid) from public, anon, authenticated;

-- ============================================================
-- 7. Terbitkan acara (momen konversi)
-- ============================================================

create or replace function public.publish_event(p_event_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ev    public.events%rowtype;
  v_days  int := 60;
  v_grace int := 7;
  v_exp   timestamptz;
begin
  select e.* into v_ev
    from public.events e
    join public.clients c on c.id = e.client_id
   where e.id = p_event_id and c.user_id = auth.uid();

  if v_ev.id is null then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;

  if v_ev.published_at is not null then
    return json_build_object('success', true, 'published_at', v_ev.published_at,
                             'expires_at', v_ev.expires_at, 'already' , true);
  end if;

  select coalesce((p.limits->>'active_days')::int, 60),
         coalesce((p.limits->>'grace_days')::int, 7)
    into v_days, v_grace
    from public.clients c
    left join public.plans p on p.code = c.tier
   where c.id = v_ev.client_id;

  -- Tiga batas sekaligus: durasi paket, tenggang setelah hari-H, dan
  -- pengaman kalau tanggal acara diisi jauh di masa depan.
  v_exp := least(
    now() + (v_days || ' days')::interval,
    coalesce(v_ev.event_date, now()) + (v_grace || ' days')::interval,
    now() + interval '365 days'
  );

  update public.events
     set published_at = now(), expires_at = v_exp
   where id = v_ev.id;

  return json_build_object('success', true, 'published_at', now(),
                           'expires_at', v_exp, 'already', false);
end;
$$;

-- ============================================================
-- 8. Aktivasi manual (MVP). Nanti dipanggil webhook Midtrans.
-- ============================================================

create or replace function public.set_client_plan(p_client_id uuid, p_plan_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans%rowtype;
begin
  select * into v_plan from public.plans where code = p_plan_code and is_active;
  if v_plan.code is null then
    return json_build_object('success', false, 'message', 'Paket tidak dikenal.');
  end if;

  -- Hanya admin, atau pemanggilan langsung dari SQL Editor / service role
  -- (auth.uid() null). Klien tidak boleh menaikkan paketnya sendiri.
  if auth.uid() is not null
     and coalesce((select role from public.clients where user_id = auth.uid()), '') <> 'admin' then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  update public.clients
     set tier = v_plan.code, plan_started_at = now()
   where id = p_client_id;

  if not found then
    return json_build_object('success', false, 'message', 'Klien tidak ditemukan.');
  end if;

  return json_build_object('success', true, 'plan', v_plan.code);
end;
$$;

revoke execute on function public.set_client_plan(uuid, text) from public, anon;
revoke execute on function public.publish_event(uuid) from public, anon;
grant  execute on function public.set_client_plan(uuid, text) to authenticated;
grant  execute on function public.publish_event(uuid) to authenticated;

-- ============================================================
-- 9. Undangan publik: tambah flag paket
--    RETURNS TABLE berubah -> wajib DROP + CREATE.
--    Kolom baru ditaruh di AKHIR agar frontend lama tetap jalan.
-- ============================================================

drop function if exists public.get_invitation_details(text);

create function public.get_invitation_details(p_token text)
returns table (
  event_title      text,
  client_name      text,
  event_caption    text,
  event_date       timestamptz,
  event_location   text,
  group_name       text,
  max_pax          integer,
  rsvp_status      text,
  pax_confirmed    integer,
  is_checked_in    boolean,
  invitation_token text,
  ticket_token     text,
  session_name     text,
  session_time     text,
  guest_id         uuid,
  event_id         uuid,
  is_published     boolean,
  expires_at       timestamptz,
  is_expired       boolean,
  watermark        boolean,
  theme_id         text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    g.event_id,
    coalesce(ent.is_published, e.published_at is not null),
    ent.expires_at,
    coalesce(ent.is_expired, false),
    coalesce(ent.watermark, true),
    coalesce(e.theme_id, 'classic')
  from public.guests g
  left join public.events e on g.event_id = e.id
  left join public.clients c on e.client_id = c.id
  left join public.tickets t on t.guest_id = g.id
  left join public.rsvps r on r.guest_id = g.id
  left join lateral public.event_entitlements(e.id) ent on true
  where lower(trim(g.invitation_token)) = v_clean
     or lower(trim(t.ticket_token)) = v_clean
  limit 1;
end;
$$;

-- ============================================================
-- 10. Penegakan kuota lewat resolver + blokir saat kedaluwarsa
--     (isi fungsi sama seperti P3, hanya sumber limit yang berubah)
-- ============================================================

create or replace function public.add_guest_by_client(
  p_group_name text,
  p_category text,
  p_max_pax integer,
  p_phone text,
  p_invitation_type text,
  p_session text default null,
  p_event_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ev public.events%rowtype;
  v_new_guest_id uuid;
  v_token text;
  v_type text;
  v_cetak boolean;
  v_session text;
  v_cat text;
  v_ent record;
begin
  select e.* into v_ev
  from public.events e
  join public.clients c on c.id = e.client_id
  where c.user_id = auth.uid() and (p_event_id is null or e.id = p_event_id)
  limit 1;
  if v_ev.id is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  v_type := coalesce(nullif(p_invitation_type, ''), 'digital');
  v_session := coalesce(nullif(btrim(p_session), ''), v_ev.session_1_name);
  v_cat := coalesce(nullif(btrim(p_category), ''), 'Umum');
  if v_type not in ('digital', 'cetak') then
    return json_build_object('success', false, 'message', 'Tipe undangan tidak valid.');
  end if;
  if v_session not in (v_ev.session_1_name, v_ev.session_2_name) then
    return json_build_object('success', false, 'message', 'Sesi tidak valid.');
  end if;
  if btrim(coalesce(p_group_name, '')) = '' or coalesce(p_max_pax, 0) < 1 then
    return json_build_object('success', false, 'message', 'Nama dan kuota pax wajib diisi.');
  end if;

  select * into v_ent from public.event_entitlements(v_ev.id);

  if coalesce(v_ent.is_expired, false) then
    return json_build_object('success', false, 'message',
      'Masa aktif paket sudah berakhir. Perpanjang untuk menambah tamu.');
  end if;

  if (select count(*) from public.guests g where g.event_id = v_ev.id)
     >= coalesce(v_ent.guest_limit, 0) then
    return json_build_object('success', false, 'message',
      'Kuota undangan paket Anda sudah penuh. Upgrade untuk menambah tamu.');
  end if;

  for i in 1..8 loop
    v_token := public.gen_invitation_token(10);
    exit when not exists (
      select 1 from public.guests g where lower(g.invitation_token) = v_token
    );
    v_token := null;
  end loop;
  if v_token is null then
    return json_build_object('success', false, 'message', 'Gagal membuat tautan undangan. Coba lagi.');
  end if;

  v_cetak := (v_type = 'cetak');

  insert into public.guests (event_id, group_name, category, max_pax, phone, invitation_type, session,
                             invitation_token, is_sent, is_checked_in)
  values (v_ev.id, btrim(p_group_name), v_cat, p_max_pax, nullif(btrim(coalesce(p_phone, '')), ''),
          v_type, v_session, v_token, v_cetak, false)
  returning id into v_new_guest_id;

  if v_cetak then
    insert into public.rsvps (guest_id, status, pax_confirmed, session, category, updated_at)
    values (v_new_guest_id, 'hadir', p_max_pax, v_session, v_cat, now());
    insert into public.tickets (guest_id, ticket_token, is_checked_in)
    values (v_new_guest_id, v_token, false)
    on conflict (guest_id) do nothing;
  end if;

  return json_build_object('success', true, 'guest_id', v_new_guest_id);
end;
$$;

-- ============================================================
-- 11. Batas jumlah acara dari katalog paket
-- ============================================================

create or replace function public.create_event(
  p_title text,
  p_event_date date,
  p_location text,
  p_session_1_name text default null,
  p_session_1_time text default null,
  p_session_2_name text default null,
  p_session_2_time text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client public.clients%rowtype;
  v_limit int;
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

  select coalesce((p.limits->>'events')::int, v_client.event_limit)
    into v_limit
    from public.plans p
   where p.code = v_client.tier;
  v_limit := coalesce(v_limit, v_client.event_limit, 1);

  select count(*) into v_count from public.events where client_id = v_client.id;
  if v_count >= v_limit then
    return json_build_object('success', false, 'message', 'Batas acara untuk paket Anda sudah tercapai.');
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
$$;

-- ============================================================
-- 12. RLS untuk tabel baru
-- ============================================================

alter table public.plans         enable row level security;
alter table public.addons        enable row level security;
alter table public.client_addons enable row level security;
alter table public.orders        enable row level security;

drop policy if exists plans_read  on public.plans;
create policy plans_read  on public.plans  for select using (true);

drop policy if exists addons_read on public.addons;
create policy addons_read on public.addons for select using (true);

-- Addon & order: hanya pemilik akun. Tidak ada policy insert/update —
-- penulisan lewat RPC SECURITY DEFINER atau service role.
drop policy if exists client_addons_own on public.client_addons;
create policy client_addons_own on public.client_addons for select
  using (exists (select 1 from public.clients c where c.id = client_addons.client_id and c.user_id = auth.uid()));

drop policy if exists orders_own on public.orders;
create policy orders_own on public.orders for select
  using (exists (select 1 from public.clients c where c.id = orders.client_id and c.user_id = auth.uid()));

commit;

-- ============================================================
-- Verifikasi (jalankan setelah commit)
-- ============================================================
--
--   select code, price, limits->>'guests' as tamu, features->>'watermark' as wm
--     from public.plans order by sort_order;
--
--   select e.title, e.published_at, e.expires_at, ent.*
--     from public.events e, public.event_entitlements(e.id) ent;
--
--   -- Harus FALSE untuk pemanggil anon:
--   select has_function_privilege('anon', 'public.event_entitlements(uuid)', 'execute');
--
--   -- Undangan lama harus tetap terbuka:
--   select count(*) from public.events where published_at is null;  -- harus 0
--
-- Uji terbitkan (login sebagai klien):
--   select public.publish_event('<event_id>');
--   -> expires_at = min(publish + active_days, event_date + grace, now + 365 hari)
--
-- Uji naik paket (SQL Editor / service role):
--   select public.set_client_plan('<client_id>', 'silver');
--   select guest_limit, event_limit from public.clients where id = '<client_id>';
--   -> 300 / 1
--
-- Uji kuota: turunkan sementara lalu rollback
--   begin;
--   update public.plans set limits = jsonb_set(limits, '{guests}', '1') where code = 'free';
--   select public.add_guest_by_client('Uji', 'Umum', 1, null, 'digital');
--   -> "Kuota undangan paket Anda sudah penuh. Upgrade untuk menambah tamu."
--   rollback;
--
-- ============================================================
-- Catatan penerapan (2026-10-30)
-- ============================================================
-- Dijalankan pada project awwraxmftlbekclwdrix dalam satu transaksi.
-- Verifikasi saat itu:
--   plans = 4 (free, silver, gold, pro-legacy)
--   addons = 2 (guests100, extend30)
--   events.published_at kosong = 0  (backfill berhasil)
--   event_entitlements -> tier pro, guest_limit 1000, watermark false
--   get_invitation_details mengembalikan 5 kolom baru
--   trigger tier: free -> guest_limit 30, event_limit 1 (diuji lalu rollback)
--
-- Perbaikan yang ditemukan saat penerapan:
--   Fungsi baru otomatis diberi EXECUTE ke PUBLIC. `revoke ... from anon,
--   authenticated` tidak menghapus hak dari PUBLIC, sehingga anon masih bisa
--   memanggil. Harus `from public, anon` lalu `grant ... to authenticated`.
--
-- Tambahan setelah file ini: penjagaan di submit_rsvp() dan send_wish()
-- (menolak bila belum diterbitkan atau sudah kedaluwarsa). Definisi
-- terbarunya ada di database, belum disalin ke file ini.

-- ============================================================
-- Rollback (kalau perlu)
-- ============================================================
--   begin;
--   drop function if exists public.get_invitation_details(text);
--   -- pulihkan definisi lama dari db/backup/
--   drop trigger if exists trg_sync_client_plan on public.clients;
--   drop function if exists public.sync_client_plan_limits();
--   drop function if exists public.event_entitlements(uuid);
--   drop function if exists public.publish_event(uuid);
--   drop function if exists public.set_client_plan(uuid, text);
--   alter table public.clients drop column if exists plan_started_at;
--   alter table public.events  drop column if exists published_at, drop column if exists expires_at, drop column if exists theme_id;
--   drop table if exists public.orders;
--   drop table if exists public.client_addons;
--   drop table if exists public.addons;
--   drop table if exists public.plans;
--   commit;
