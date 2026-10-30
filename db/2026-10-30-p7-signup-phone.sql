-- RayaRayu — P7: nomor WhatsApp saat daftar
-- DITERAPKAN 2026-10-30.
--
-- Keputusan produk: WA opsional saat daftar, diwajibkan saat mau upgrade.
-- Kolom `clients.phone` sudah ada sejak awal, hanya belum pernah diisi.
--
-- Normalisasi: 0812… -> 62812…, hanya digit, harus cocok ^62[0-9]{8,14}$.
-- Nomor tidak unik — pasangan sering memakai nomor yang sama.
-- Nomor tidak pernah keluar lewat RPC publik (get_invitation_details,
-- get_event_preview hanya mengembalikan nama).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_email text;
  v_phone text;
  v_base text;
  v_slug text;
  v_i int := 1;
begin
  if exists (select 1 from public.clients where user_id = new.id) then
    return new;
  end if;

  v_email := lower(coalesce(new.email, ''));
  v_name := btrim(coalesce(new.raw_user_meta_data->>'name', ''));
  if v_name = '' then
    v_name := coalesce(nullif(split_part(v_email, '@', 1), ''), 'Klien');
  end if;

  v_phone := regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g');
  if v_phone like '0%' then
    v_phone := '62' || substr(v_phone, 2);
  elsif v_phone like '8%' then
    v_phone := '62' || v_phone;
  end if;
  if v_phone !~ '^62[0-9]{8,14}$' then
    v_phone := '';
  end if;

  v_base := lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := btrim(v_base, '-');
  if v_base = '' then v_base := 'klien'; end if;
  v_base := left(v_base, 40);

  v_slug := v_base;
  while exists (select 1 from public.clients c where c.slug = v_slug) loop
    v_i := v_i + 1;
    if v_i > 50 then
      v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      exit;
    end if;
    v_slug := v_base || '-' || v_i;
  end loop;

  insert into public.clients (user_id, name, email, phone, slug, role)
  values (new.id, v_name, nullif(v_email, ''), nullif(v_phone, ''), v_slug, 'client');

  return new;
end;
$$;

-- Verifikasi:
--   Daftar akun baru dengan options.data = {name, phone: '0812…'}
--   -> select name, phone from public.clients order by created_at desc limit 1;
--      phone tersimpan sebagai 62812…
--
-- Catatan: frontend mengirim phone lewat signUp({ options: { data: { name, phone } } }).
-- Kalau trigger tidak membaca raw_user_meta_data->>'phone', nilainya hilang tanpa error.
