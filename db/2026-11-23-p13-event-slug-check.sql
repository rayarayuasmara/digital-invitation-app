-- RayaRayu — P13: cek ketersediaan alamat tautan (slug) saat onboarding
--
-- Frontend memanggil fungsi ini saat klien mengetik alamat tautan. Hanya
-- mengembalikan apakah slug sudah dipakai, tanpa membuka data acara lain.
-- Aturan normalisasi memakai slugify() yang sama dengan create_event().

begin;

create or replace function public.check_event_slug_available(p_slug text)
returns json language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_slug text := nullif(public.slugify(p_slug), '');
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  if v_slug is null or length(v_slug) < 3 then
    return json_build_object('success', true, 'slug', coalesce(v_slug, ''), 'available', false);
  end if;

  return json_build_object(
    'success', true,
    'slug', v_slug,
    'available', not exists (select 1 from public.events e where e.slug = v_slug)
  );
end;
$$;

revoke execute on function public.check_event_slug_available(text) from public, anon;
grant execute on function public.check_event_slug_available(text) to authenticated;

commit;
