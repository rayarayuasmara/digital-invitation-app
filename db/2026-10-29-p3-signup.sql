-- RayaRayu — P3: pendaftaran klien mandiri
-- Diterapkan 2026-10-29.
--
-- Alur: tamu/klien mendaftar lewat halaman dashboard (Supabase Auth signUp).
-- Trigger di auth.users otomatis membuat baris public.clients, jadi tidak ada
-- lagi langkah manual membuat akun + klien + slug.
--
-- Slug dibuat dari nama: huruf kecil, spasi jadi tanda hubung, maksimal 40
-- karakter. Kalau sudah dipakai, ditambah -2, -3, ... Kalau sampai -50,
-- ditambah 6 karakter acak.
--
-- PERHATIAN konfigurasi (bukan SQL):
--   1. Supabase Auth -> Providers -> Email harus aktif.
--   2. "Confirm email" menentukan perilaku signup:
--        - aktif  : signUp tidak mengembalikan session; pengguna harus klik
--                   tautan di email dulu. Butuh SMTP.
--        - nonaktif: langsung masuk dan dashboard terbuka.
--   3. SMTP bawaan Supabase punya kuota kirim sangat kecil untuk plan gratis
--      (beberapa email per jam). Tanpa SMTP sendiri, pendaftaran akan sering
--      gagal dengan pesan "email rate limit exceeded". Pakai Resend/Brevo
--      (ada tier gratis) lalu isi di Auth -> SMTP Settings.
--   4. Domain email divalidasi GoTrue. example.com dan domain tanpa MX
--      ditolak dengan "Email address ... is invalid".

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_name text;
  v_email text;
  v_base text;
  v_slug text;
  v_i int := 1;
begin
  -- Jangan buat dua kali kalau baris klien sudah ada.
  if exists (select 1 from public.clients where user_id = new.id) then
    return new;
  end if;

  v_email := lower(coalesce(new.email, ''));
  v_name := btrim(coalesce(new.raw_user_meta_data->>'name', ''));
  if v_name = '' then
    v_name := coalesce(nullif(split_part(v_email, '@', 1), ''), 'Klien');
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

  insert into public.clients (user_id, name, email, slug, role)
  values (new.id, v_name, nullif(v_email, ''), v_slug, 'client');

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger berjalan sebagai pemilik tabel; role API tidak perlu akses langsung.
revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;

-- Verifikasi:
--   select tgname from pg_trigger
--    where tgrelid = 'auth.users'::regclass and not tgisinternal;
--   -> on_auth_user_created
--
-- Uji tanpa mengirim email (langsung ke auth.users):
--   insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
--                           email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
--                           created_at, updated_at)
--   values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
--           'authenticated','authenticated','uji@domainanda.com',
--           crypt('rahasia123', gen_salt('bf')), now(),
--           '{"provider":"email","providers":["email"]}'::jsonb,
--           '{"name":"Nama Uji"}'::jsonb, now(), now());
--   -> public.clients otomatis berisi slug "nama-uji"
--   Hapus lagi: delete from public.clients where email='uji@domainanda.com';
--               delete from auth.users where email='uji@domainanda.com';
