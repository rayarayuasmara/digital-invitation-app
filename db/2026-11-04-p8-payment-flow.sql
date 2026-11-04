-- RayaRayu — P8: alur pesanan & pembayaran (transfer manual)
--
-- Tujuan: tombol "Upgrade" tidak lagi berhenti di chat WhatsApp.
-- Alurnya:
--   1. Klien buat pesanan  -> orders.status = 'pending', dapat kode RR-XXXXXX
--   2. Klien transfer + unggah bukti -> status = 'waiting'
--   3. Admin (pemilik) memeriksa -> 'paid' (paket aktif) atau 'cancelled'
--
-- Kenapa manual dulu: payment gateway (Midtrans/Xendit) butuh badan usaha
-- dan biaya per transaksi. Untuk volume sekarang, transfer + verifikasi
-- manual masih yang paling murah. Kolom provider/provider_ref/paid_at
-- sudah disiapkan supaya gateway bisa masuk nanti tanpa ubah skema.
--
-- Catatan: orders SUDAH punya policy SELECT untuk pemilik. INSERT/UPDATE
-- sengaja hanya lewat RPC SECURITY DEFINER.

begin;

-- ---------------------------------------------------------------
-- 1. Kolom pesanan
-- ---------------------------------------------------------------
alter table public.orders
  add column if not exists order_code text,
  add column if not exists proof_url text,
  add column if not exists note text,
  add column if not exists reviewed_at timestamptz;

create unique index if not exists orders_code_key
  on public.orders (order_code) where order_code is not null;

create index if not exists orders_status_idx on public.orders (status, created_at desc);

-- Status baru: 'waiting' (bukti sudah diunggah) dan 'cancelled'.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','waiting','paid','failed','expired','refunded','cancelled'));

-- ---------------------------------------------------------------
-- 2. Instruksi pembayaran (bisa diubah tanpa deploy)
-- ---------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

insert into public.app_settings (key, value)
values ('payment', jsonb_build_object(
  'bank', 'BCA',
  'account', '0000000000',
  'holder', 'RayaRayu',
  'note', 'Tulis kode pesanan pada berita transfer.'
))
on conflict (key) do nothing;

-- ---------------------------------------------------------------
-- 3. Helper admin
-- ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role from public.clients where user_id = auth.uid()), '') = 'admin'
$$;

-- ---------------------------------------------------------------
-- 4. Klien: buat pesanan
-- ---------------------------------------------------------------
create or replace function public.create_order(p_event_id uuid, p_plan_code text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_event    public.events%rowtype;
  v_plan     public.plans%rowtype;
  v_current  public.plans%rowtype;
  v_open     public.orders%rowtype;
  v_code     text;
  v_id       uuid;
begin
  select e.* into v_event
    from public.events e
    join public.clients c on c.id = e.client_id
   where e.id = p_event_id and c.user_id = auth.uid();

  if v_event.id is null then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;

  select * into v_plan from public.plans
   where code = p_plan_code and is_active and price > 0;

  if v_plan.code is null then
    return json_build_object('success', false, 'message', 'Paket tidak tersedia.');
  end if;

  -- Tidak boleh turun paket.
  select * into v_current
    from public.plans p
   where p.code = coalesce((select tier from public.clients where id = v_event.client_id), 'free');

  if v_current.sort_order > v_plan.sort_order then
    return json_build_object('success', false, 'message', 'Paket ini lebih rendah dari paket yang aktif.');
  end if;
  if v_current.code = v_plan.code then
    return json_build_object('success', false, 'message', 'Paket ini sudah aktif.');
  end if;

  -- Satu pesanan terbuka per acara: klik dua kali tidak membuat dua tagihan.
  select * into v_open from public.orders
   where event_id = p_event_id and status in ('pending', 'waiting')
   order by created_at desc limit 1;

  if v_open.id is not null then
    return json_build_object(
      'success', true,
      'reused', true,
      'order', json_build_object(
        'id', v_open.id, 'code', v_open.order_code, 'plan_code', v_open.plan_code,
        'amount', v_open.amount, 'status', v_open.status, 'proof_url', v_open.proof_url
      ),
      'payment', (select value from public.app_settings where key = 'payment')
    );
  end if;

  loop
    v_code := 'RR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.orders where order_code = v_code);
  end loop;

  insert into public.orders (client_id, event_id, plan_code, amount, status, provider, order_code)
  values (v_event.client_id, p_event_id, v_plan.code, v_plan.price, 'pending', 'manual', v_code)
  returning id into v_id;

  return json_build_object(
    'success', true,
    'reused', false,
    'order', json_build_object(
      'id', v_id, 'code', v_code, 'plan_code', v_plan.code, 'plan_name', v_plan.name,
      'amount', v_plan.price, 'status', 'pending'
    ),
    'payment', (select value from public.app_settings where key = 'payment')
  );
end;
$$;

-- ---------------------------------------------------------------
-- 5. Klien: lampirkan bukti transfer
-- ---------------------------------------------------------------
create or replace function public.attach_order_proof(p_order_id uuid, p_path text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders%rowtype;
begin
  if coalesce(btrim(p_path), '') = '' then
    return json_build_object('success', false, 'message', 'Berkas bukti belum diunggah.');
  end if;

  select o.* into v_order
    from public.orders o
    join public.clients c on c.id = o.client_id
   where o.id = p_order_id and c.user_id = auth.uid();

  if v_order.id is null then
    return json_build_object('success', false, 'message', 'Pesanan tidak ditemukan.');
  end if;
  if v_order.status not in ('pending', 'waiting') then
    return json_build_object('success', false, 'message', 'Pesanan ini sudah diproses.');
  end if;

  update public.orders
     set proof_url = p_path, status = 'waiting'
   where id = p_order_id;

  return json_build_object('success', true, 'status', 'waiting');
end;
$$;

-- ---------------------------------------------------------------
-- 6. Klien: batalkan pesanan sendiri
-- ---------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.orders o
     set status = 'cancelled', note = 'Dibatalkan oleh pemesan'
    from public.clients c
   where o.id = p_order_id
     and c.id = o.client_id
     and c.user_id = auth.uid()
     and o.status in ('pending', 'waiting');

  if not found then
    return json_build_object('success', false, 'message', 'Pesanan tidak bisa dibatalkan.');
  end if;
  return json_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------
-- 7. Admin: daftar pesanan menunggu
-- ---------------------------------------------------------------
create or replace function public.admin_list_orders()
returns table (
  id uuid, order_code text, plan_code text, amount integer, status text,
  proof_url text, note text, created_at timestamptz,
  client_name text, client_email text, event_title text, event_slug text,
  event_published boolean, event_expires timestamptz
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  return query
  select o.id, o.order_code, o.plan_code, o.amount, o.status,
         o.proof_url, o.note, o.created_at,
         c.name, c.email, e.title, e.slug,
         (e.published_at is not null), e.expires_at
    from public.orders o
    left join public.clients c on c.id = o.client_id
    left join public.events  e on e.id = o.event_id
   where o.status in ('pending', 'waiting')
   order by (o.status = 'waiting') desc, o.created_at asc;
end;
$$;

-- ---------------------------------------------------------------
-- 8. Admin: aktifkan pesanan
-- ---------------------------------------------------------------
create or replace function public.admin_activate_order(p_order_id uuid)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_plan  public.plans%rowtype;
  v_days  int;
  v_grace int;
  v_exp   timestamptz;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    return json_build_object('success', false, 'message', 'Pesanan tidak ditemukan.');
  end if;
  if v_order.status not in ('pending', 'waiting') then
    return json_build_object('success', false, 'message', 'Pesanan sudah diproses.');
  end if;

  select * into v_plan from public.plans where code = v_order.plan_code;

  update public.clients
     set tier = v_plan.code, plan_started_at = now()
   where id = v_order.client_id;

  -- Masa aktif dihitung ulang dari sekarang, karena acara mungkin sudah
  -- berjalan dengan paket Free. Rumusnya sama dengan publish_event().
  if v_order.event_id is not null then
    v_days  := coalesce((v_plan.limits->>'active_days')::int, 60);
    v_grace := coalesce((v_plan.limits->>'grace_days')::int, 7);

    update public.events
       set expires_at = least(
             now() + (v_days || ' days')::interval,
             greatest(coalesce(event_date, now()), now()) + (v_grace || ' days')::interval,
             now() + interval '365 days'
           )
     where id = v_order.event_id
       and published_at is not null
       returning expires_at into v_exp;
  end if;

  update public.orders
     set status = 'paid', paid_at = now(), reviewed_at = now()
   where id = p_order_id;

  return json_build_object(
    'success', true, 'plan', v_plan.code,
    'expires_at', coalesce(v_exp, (select expires_at from public.events where id = v_order.event_id))
  );
end;
$$;

-- ---------------------------------------------------------------
-- 9. Admin: tolak pesanan
-- ---------------------------------------------------------------
create or replace function public.admin_reject_order(p_order_id uuid, p_note text default null)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  update public.orders
     set status = 'cancelled', reviewed_at = now(), note = coalesce(p_note, 'Ditolak admin')
   where id = p_order_id and status in ('pending', 'waiting');

  if not found then
    return json_build_object('success', false, 'message', 'Pesanan sudah diproses.');
  end if;
  return json_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------
-- 10. Hak akses
-- ---------------------------------------------------------------
revoke execute on function public.create_order(uuid, text)        from public, anon;
revoke execute on function public.attach_order_proof(uuid, text)  from public, anon;
revoke execute on function public.cancel_order(uuid)              from public, anon;
revoke execute on function public.admin_list_orders()             from public, anon;
revoke execute on function public.admin_activate_order(uuid)      from public, anon;
revoke execute on function public.admin_reject_order(uuid, text)  from public, anon;
revoke execute on function public.is_admin()                      from public, anon;

grant execute on function public.create_order(uuid, text)        to authenticated;
grant execute on function public.attach_order_proof(uuid, text)  to authenticated;
grant execute on function public.cancel_order(uuid)              to authenticated;
grant execute on function public.admin_list_orders()             to authenticated;
grant execute on function public.admin_activate_order(uuid)      to authenticated;
grant execute on function public.admin_reject_order(uuid, text)  to authenticated;
grant execute on function public.is_admin()                      to authenticated;

-- ---------------------------------------------------------------
-- 11. Storage: bukti transfer (privat)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

drop policy if exists proof_insert_own on storage.objects;
create policy proof_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists proof_read_own on storage.objects;
create policy proof_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Supaya klien bisa mengganti / menghapus bukti yang salah unggah.
drop policy if exists proof_delete_own on storage.objects;
create policy proof_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;

-- ============================================================
-- Verifikasi
-- ============================================================
--   select key, value from public.app_settings where key = 'payment';
--   -> GANTI bank/account/holder ke rekening asli sebelum dipakai:
--      update public.app_settings
--         set value = '{"bank":"BCA","account":"1234567890","holder":"Nama Kamu","note":"..."}'::jsonb,
--             updated_at = now()
--       where key = 'payment';
--
--   -- Jadikan akun kamu admin (sekali saja):
--   update public.clients set role = 'admin'
--    where user_id = (select id from auth.users where email = 'email-kamu@contoh.com');
--
--   -- Cek order masuk:
--   select order_code, plan_code, amount, status, proof_url, created_at
--     from public.orders order by created_at desc limit 10;
