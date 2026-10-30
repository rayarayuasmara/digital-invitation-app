-- RayaRayu — P5: slug di level acara + nama mempelai terpisah dari akun
-- DITERAPKAN 2026-10-30.
--
-- Kenapa:
--   1. Slug tadinya di `clients`, jadi akun dengan banyak acara memakai satu
--      slug untuk semuanya. Padahal tiap acara punya pasangan berbeda.
--   2. Judul undangan mengambil `clients.name`. Untuk akun WO, nama yang
--      tercetak adalah nama WO-nya, bukan nama mempelai.
--
-- Aturan slug:
--   - unik global, huruf kecil/angka/strip, 3–40 karakter
--   - otomatis dibuat dari nama mempelai kalau kosong
--   - TIDAK bisa diubah setelah undangan diterbitkan (tautan sudah tersebar)
--
-- Catatan: `create_event` di-DROP lalu dibuat ulang karena menambah parameter
-- (p_couple_name, p_slug). Tanpa DROP, Postgres menyisakan versi lama sebagai
-- overload dan pemanggilan 7 argumen jadi ambigu.

begin;

alter table public.events add column if not exists slug text;
alter table public.events add column if not exists couple_name text;

create or replace function public.slugify(p_text text)
returns text language sql immutable
as $$
  select btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'), '-')
$$;

create or replace function public.unique_event_slug(p_base text, p_ignore uuid default null)
returns text language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_base text := left(nullif(public.slugify(p_base), ''), 34);
  v_try text;
  v_i int := 1;
begin
  if v_base is null then v_base := 'acara'; end if;
  v_try := v_base;
  while exists (
    select 1 from public.events e
     where e.slug = v_try and (p_ignore is null or e.id <> p_ignore)
  ) loop
    v_i := v_i + 1;
    if v_i > 200 then
      return v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end if;
    v_try := v_base || '-' || v_i;
  end loop;
  return v_try;
end;
$$;

-- Backfill nama mempelai dari nama akun (perilaku lama dipertahankan).
update public.events e
   set couple_name = c.name
  from public.clients c
 where c.id = e.client_id
   and (e.couple_name is null or btrim(e.couple_name) = '');

-- Backfill slug dari slug akun, dengan penomoran kalau satu akun punya
-- beberapa acara.
do $$
declare
  r record;
begin
  for r in
    select e.id, coalesce(c.slug, e.title) as base
      from public.events e
      join public.clients c on c.id = e.client_id
     where e.slug is null
     order by e.created_at
  loop
    update public.events set slug = public.unique_event_slug(r.base) where id = r.id;
  end loop;
end;
$$;

create unique index if not exists events_slug_key
  on public.events (slug) where slug is not null;

create or replace function public.events_guard_slug()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v text;
begin
  -- Tautan yang sudah beredar tidak boleh mati.
  if tg_op = 'UPDATE' and old.published_at is not null
     and new.slug is distinct from old.slug then
    raise exception 'Slug undangan tidak bisa diubah setelah undangan diterbitkan.';
  end if;

  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.unique_event_slug(coalesce(new.couple_name, new.title, 'acara'), new.id);
    return new;
  end if;

  v := public.slugify(new.slug);
  if length(v) < 3 then
    raise exception 'Slug undangan minimal 3 karakter (huruf kecil, angka, strip).';
  end if;
  new.slug := left(v, 40);

  if exists (select 1 from public.events e where e.slug = new.slug and e.id <> new.id) then
    raise exception 'Slug "%" sudah dipakai acara lain.', new.slug;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_events_guard_slug on public.events;
create trigger trg_events_guard_slug
  before insert or update on public.events
  for each row execute function public.events_guard_slug();

drop function if exists public.create_event(text, date, text, text, text, text, text);

create function public.create_event(
  p_title text, p_event_date date, p_location text,
  p_session_1_name text default null, p_session_1_time text default null,
  p_session_2_name text default null, p_session_2_time text default null,
  p_couple_name text default null, p_slug text default null
)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_client public.clients%rowtype;
  v_limit int;
  v_count int;
  v_id uuid;
  v_slug text;
  v_title text := btrim(coalesce(p_title, ''));
  v_couple text;
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
    into v_limit from public.plans p where p.code = v_client.tier;
  v_limit := coalesce(v_limit, v_client.event_limit, 1);

  select count(*) into v_count from public.events where client_id = v_client.id;
  if v_count >= v_limit then
    return json_build_object('success', false, 'message', 'Batas acara untuk paket Anda sudah tercapai.');
  end if;

  v_couple := nullif(btrim(coalesce(p_couple_name, '')), '');
  v_slug := nullif(public.slugify(p_slug), '');
  if v_slug is not null then
    if length(v_slug) < 3 then
      return json_build_object('success', false, 'message', 'Slug minimal 3 karakter.');
    end if;
    if exists (select 1 from public.events where slug = v_slug) then
      return json_build_object('success', false,
        'message', 'Slug "' || v_slug || '" sudah dipakai acara lain. Coba yang lain.');
    end if;
  end if;

  insert into public.events (client_id, title, event_date, location,
                             session_1_name, session_1_time, session_2_name, session_2_time,
                             couple_name, slug)
  values (v_client.id, v_title, p_event_date::timestamptz,
          nullif(btrim(coalesce(p_location, '')), ''),
          v_s1n, nullif(btrim(coalesce(p_session_1_time, '')), ''),
          v_s2n, nullif(btrim(coalesce(p_session_2_time, '')), ''),
          coalesce(v_couple, v_client.name), v_slug)
  returning id, slug into v_id, v_slug;

  return json_build_object('success', true, 'event_id', v_id, 'slug', v_slug);
end;
$$;

-- Undangan publik: pakai nama mempelai acara, bukan nama akun.
-- (Dijalankan terpisah setelah blok ini; isi fungsi tidak berubah selain
--  `coalesce(c.name, ...)` menjadi `coalesce(e.couple_name, c.name, ...)`.)
--
-- create or replace function public.get_invitation_details(p_token text) ...

commit;

-- ============================================================
-- Verifikasi yang dijalankan saat penerapan
-- ============================================================
--
--   select title, slug, couple_name from public.events order by created_at;
--   -> rudi-irul | Rudi & Irul
--      andra     | Andra
--
--   insert ... couple_name 'Budi & Ani'  -> slug otomatis 'budi-ani'
--   update slug acara yang sudah terbit -> DITOLAK
--     "Slug undangan tidak bisa diubah setelah undangan diterbitkan."
--   update slug ke slug acara lain      -> DITOLAK
--     'Slug "rudi-irul" sudah dipakai acara lain.'
--
-- ============================================================
-- Catatan penerapan
-- ============================================================
-- `get_invitation_details` dibuat ulang terpisah (CREATE OR REPLACE, tipe
-- kembalian sama) karena isinya berubah. Frontend tidak perlu diubah: kolom
-- `client_name` sekarang berisi nama mempelai.
