-- Store a client-supplied Maps link separately from the venue text.
begin;

alter table public.events add column if not exists maps_url text;
-- NULL denotes an existing event. New events without a supplied link store an empty string.
alter table public.events alter column maps_url set default '';

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
  if v_url !~ '^https://((maps\.app\.goo\.gl|share\.google)/[^[:space:]]+|goo\.gl/maps/[^[:space:]]*|maps\.google\.(com|co\.id)/[^[:space:]]*|(www\.)?google\.(com|co\.id)/maps([/?#][^[:space:]]*)?)$' then
    return json_build_object('success', false, 'message', 'Tautan Google Maps tidak valid.');
  end if;

  v_result := public.create_event(p_title, p_event_date, p_location, p_couple_name, p_slug, p_sessions, p_couple);
  if coalesce((v_result->>'success')::boolean, false) then
    update public.events set maps_url = v_url where id = (v_result->>'event_id')::uuid;
  end if;
  return v_result;
end;
$$;

revoke execute on function public.create_event_with_map(text,date,text,text,text,jsonb,jsonb,text) from public, anon;
grant execute on function public.create_event_with_map(text,date,text,text,text,jsonb,jsonb,text) to authenticated;

-- Reuse the same token validation as the existing invitation and preview endpoints.
create or replace function public.get_event_maps_url(p_token text, p_preview boolean)
returns text language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_event uuid;
begin
  if p_preview then
    select g.event_id into v_event from public.get_event_preview(p_token) g limit 1;
  else
    select g.event_id into v_event from public.get_invitation_details(p_token) g limit 1;
  end if;
  return (select e.maps_url from public.events e where e.id = v_event);
end;
$$;

revoke execute on function public.get_event_maps_url(text,boolean) from public;
grant execute on function public.get_event_maps_url(text,boolean) to anon, authenticated;

commit;
