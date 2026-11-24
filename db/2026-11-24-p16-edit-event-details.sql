-- Edit acara milik klien tanpa mengubah slug, status publikasi, atau paket.
-- Terapkan setelah p15.
begin;

create or replace function public.save_event_details(
  p_event_id uuid, p_title text, p_date date, p_location text, p_maps_url text, p_sessions jsonb
)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_event public.events%rowtype;
  v_title text := btrim(coalesce(p_title, ''));
  v_location text := btrim(coalesce(p_location, ''));
  v_maps text := btrim(p_maps_url);
  v_sessions json;
begin
  select e.* into v_event
    from public.events e
    join public.clients c on c.id = e.client_id
   where e.id = p_event_id and c.user_id = auth.uid()
   for update of e;
  if not found then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;

  if length(v_title) not between 1 and 160 or length(v_location) not between 1 and 300 or p_date is null or not isfinite(p_date) then
    return json_build_object('success', false, 'message', 'Periksa judul, tanggal, dan lokasi acara.');
  end if;
  if v_maps <> '' and (length(v_maps) > 2048 or v_maps !~ '^https://((maps\.app\.goo\.gl|share\.google)/[^[:space:]]+|goo\.gl/maps/[^[:space:]]*|maps\.google\.(com|co\.id)/[^[:space:]]*|(www\.)?google\.(com|co\.id)/maps([/?#][^[:space:]]*)?)$') then
    return json_build_object('success', false, 'message', 'Tautan Google Maps tidak valid.');
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
         maps_url = coalesce(v_maps, v_event.maps_url)
   where id = p_event_id;

  return json_build_object('success', true);
end;
$$;

revoke execute on function public.save_event_details(uuid,text,date,text,text,jsonb) from public, anon;
grant execute on function public.save_event_details(uuid,text,date,text,text,jsonb) to authenticated;

commit;
