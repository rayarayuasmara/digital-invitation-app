-- RayaRayu — P12: data kedua mempelai untuk onboarding
--
-- Frame onboarding di Figma meminta nama lengkap, nama panggilan, serta nama
-- ayah dan ibu untuk masing-masing mempelai. Kolom baru disimpan di `events`
-- dan diisi lewat create_event(). Pemanggil lama tetap aman karena parameter
-- baru punya nilai default.

begin;

alter table public.events
  add column if not exists groom_name text,
  add column if not exists groom_nickname text,
  add column if not exists groom_father text,
  add column if not exists groom_mother text,
  add column if not exists bride_name text,
  add column if not exists bride_nickname text,
  add column if not exists bride_father text,
  add column if not exists bride_mother text;

-- Signature berubah, jadi versi lama harus dibuang lebih dulu. Kalau tidak,
-- PostgREST melihat dua overload dengan default dan panggilan menjadi ambigu.
drop function if exists public.create_event(text, date, text, text, text, jsonb);

create function public.create_event(
  p_title text, p_event_date date, p_location text,
  p_couple_name text default null, p_slug text default null,
  p_sessions jsonb default null, p_couple jsonb default '{}'::jsonb
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
  v_sessions jsonb := coalesce(p_sessions, '[{"name":"Akad","time_text":null}]'::jsonb);
  v_n int;
  v_res json;
  v_person jsonb := coalesce(p_couple, '{}'::jsonb);
  v_groom text := nullif(btrim(coalesce(v_person->>'groom_name', '')), '');
  v_bride text := nullif(btrim(coalesce(v_person->>'bride_name', '')), '');
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  select * into v_client from public.clients where user_id = auth.uid();
  if v_client.id is null then
    return json_build_object('success', false, 'message', 'Akun klien tidak ditemukan.');
  end if;

  if v_title = '' then return json_build_object('success', false, 'message', 'Judul acara wajib diisi.'); end if;
  if p_event_date is null then return json_build_object('success', false, 'message', 'Tanggal acara wajib diisi.'); end if;

  v_n := jsonb_array_length(v_sessions);
  if v_n < 1 then return json_build_object('success', false, 'message', 'Minimal satu sesi.'); end if;
  if v_n > 3 then return json_build_object('success', false, 'message', 'Maksimal tiga sesi.'); end if;

  select coalesce((p.limits->>'events')::int, v_client.event_limit)
    into v_limit from public.plans p where p.code = v_client.tier;
  v_limit := coalesce(v_limit, v_client.event_limit, 1);

  select count(*) into v_count from public.events where client_id = v_client.id;
  if v_count >= v_limit then
    return json_build_object('success', false, 'message', 'Batas acara untuk paket Anda sudah tercapai.');
  end if;

  v_couple := nullif(btrim(coalesce(p_couple_name, '')), '');
  if v_couple is null and (v_groom is not null or v_bride is not null) then
    v_couple := concat_ws(' & ', v_groom, v_bride);
  end if;
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

  insert into public.events (
    client_id, title, event_date, location, couple_name, slug,
    groom_name, groom_nickname, groom_father, groom_mother,
    bride_name, bride_nickname, bride_father, bride_mother
  ) values (
    v_client.id, v_title, p_event_date::timestamptz,
    nullif(btrim(coalesce(p_location, '')), ''),
    coalesce(v_couple, v_client.name), v_slug,
    v_groom, nullif(btrim(coalesce(v_person->>'groom_nickname', '')), ''),
    nullif(btrim(coalesce(v_person->>'groom_father', '')), ''),
    nullif(btrim(coalesce(v_person->>'groom_mother', '')), ''),
    v_bride, nullif(btrim(coalesce(v_person->>'bride_nickname', '')), ''),
    nullif(btrim(coalesce(v_person->>'bride_father', '')), ''),
    nullif(btrim(coalesce(v_person->>'bride_mother', '')), '')
  )
  returning id, slug into v_id, v_slug;

  v_res := public.save_event_sessions(v_id, v_sessions);
  if not coalesce((v_res->>'success')::boolean, false) then
    raise exception '%', coalesce(v_res->>'message', 'Sesi tidak valid.');
  end if;

  return json_build_object('success', true, 'event_id', v_id, 'slug', v_slug);
end;
$$;

revoke execute on function public.create_event(text, date, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.create_event(text, date, text, text, text, jsonb, jsonb) to authenticated;

commit;
