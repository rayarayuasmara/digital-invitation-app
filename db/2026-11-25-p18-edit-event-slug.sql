-- RayaRayu — P18: ubah alamat tautan selama undangan masih draf
--
-- Editor detail acara perlu mengubah slug sebelum undangan diterbitkan.
-- Trigger events_guard_slug() sudah menolak perubahan setelah publish, jadi
-- fungsi ini hanya menambahkan slug ke penyimpanan yang sudah ada agar
-- perubahan judul, tanggal, lokasi, sesi, dan slug terjadi satu transaksi.
-- Parameter p_slug opsional: pemanggil lama dengan enam argumen tetap jalan.

begin;

drop function public.save_event_details(uuid, text, date, text, text, jsonb);

create function public.save_event_details(
  p_event_id uuid,
  p_title text,
  p_date date,
  p_location text,
  p_maps_url text,
  p_sessions jsonb,
  p_slug text default null
)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_location text := btrim(coalesce(p_location, ''));
  v_maps text := btrim(p_maps_url);
  v_slug text := nullif(public.slugify(p_slug), '');
  v_sessions json;
begin
  select e.* into v_event
    from public.events e join public.clients c on c.id = e.client_id
   where e.id = p_event_id and c.user_id = auth.uid()
   for update of e;
  if not found then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;
  if length(v_title) not between 1 and 160 or length(v_location) not between 1 and 300 or p_date is null or not isfinite(p_date) then
    return json_build_object('success', false, 'message', 'Periksa judul, tanggal, dan lokasi acara.');
  end if;
  if v_maps <> '' and not public.is_event_location_url(v_maps) then
    return json_build_object('success', false, 'message', 'Tautan lokasi tidak valid.');
  end if;
  if p_slug is not null then
    if v_slug is null or length(v_slug) not between 5 and 40 then
      return json_build_object('success', false, 'message', 'Alamat tautan harus 5–40 karakter.');
    end if;
    if v_event.published_at is not null and v_slug is distinct from v_event.slug then
      return json_build_object('success', false, 'message', 'Alamat tautan tidak bisa diubah setelah undangan terbit.');
    end if;
    if v_slug is distinct from v_event.slug
       and exists (select 1 from public.events e where e.slug = v_slug) then
      return json_build_object('success', false, 'message', 'Alamat tautan sudah dipakai. Coba yang lain.');
    end if;
  end if;
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' then
    return json_build_object('success', false, 'message', 'Data sesi tidak valid.');
  end if;
  if jsonb_array_length(p_sessions) not between 1 and 3 or exists (
    select 1 from jsonb_array_elements(p_sessions) s
     where length(coalesce(s->>'name', '')) > 80 or length(coalesce(s->>'time_text', '')) > 80
        or (nullif(s->>'id', '') is not null and (s->>'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
  ) or exists (
    select 1 from jsonb_array_elements(p_sessions) s
     where nullif(s->>'id', '') is not null
     group by lower(s->>'id') having count(*) > 1
  ) then
    return json_build_object('success', false, 'message', 'Periksa data sesi acara.');
  end if;
  v_sessions := public.save_event_sessions(p_event_id, p_sessions);
  if not coalesce((v_sessions->>'success')::boolean, false) then
    return v_sessions;
  end if;
  update public.events
     set title = v_title,
         location = v_location,
         event_date = case when (v_event.event_date at time zone 'Asia/Jakarta')::date = p_date
                           then v_event.event_date else p_date::timestamp at time zone 'Asia/Jakarta' end,
         maps_url = coalesce(v_maps, v_event.maps_url),
         slug = coalesce(v_slug, v_event.slug)
   where id = p_event_id;
  return json_build_object('success', true, 'slug', coalesce(v_slug, v_event.slug));
end;
$$;

revoke execute on function public.save_event_details(uuid, text, date, text, text, jsonb, text) from public, anon;
grant execute on function public.save_event_details(uuid, text, date, text, text, jsonb, text) to authenticated;

commit;
