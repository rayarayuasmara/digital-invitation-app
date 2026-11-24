-- Allow HTTP(S) links from any host, without credentials. Existing columns and RPCs stay compatible.
begin;

create or replace function public.is_event_location_url(p_url text)
returns boolean language sql immutable strict
set search_path = pg_catalog
as $$
  select length(p_url) <= 2048
    and p_url ~* '^https?://([a-z0-9.-]+|\[[a-f0-9:.]+\])(:[0-9]{1,5})?([/?#][^[:space:]<>]*)?$'
    and strpos(p_url, chr(92)) = 0
    and p_url !~ '[[:cntrl:]]';
$$;
revoke execute on function public.is_event_location_url(text) from public, anon, authenticated;

create or replace function public.create_event_with_map(
  p_title text, p_event_date date, p_location text, p_couple_name text,
  p_slug text, p_sessions jsonb, p_couple jsonb, p_maps_url text
)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_result json;
  v_url text := btrim(coalesce(p_maps_url, ''));
begin
  if not public.is_event_location_url(v_url) then
    return json_build_object('success', false, 'message', 'Tautan lokasi tidak valid.');
  end if;
  v_result := public.create_event(p_title, p_event_date, p_location, p_couple_name, p_slug, p_sessions, p_couple);
  if coalesce((v_result->>'success')::boolean, false) then
    update public.events set maps_url = v_url where id = (v_result->>'event_id')::uuid;
  end if;
  return v_result;
end;
$$;

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

revoke execute on function public.create_event_with_map(text,date,text,text,text,jsonb,jsonb,text) from public, anon;
grant execute on function public.create_event_with_map(text,date,text,text,text,jsonb,jsonb,text) to authenticated;
revoke execute on function public.save_event_details(uuid,text,date,text,text,jsonb) from public, anon;
grant execute on function public.save_event_details(uuid,text,date,text,text,jsonb) to authenticated;

commit;
