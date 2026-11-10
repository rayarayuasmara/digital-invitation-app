-- RayaRayu — P11: simpan profil undangan lewat RPC pemilik
--
-- P10 membatasi UPDATE langsung pada events ke kolom dashboard yang aman.
-- Wizard Undangan perlu menyimpan judul, mempelai, slug, jadwal, lokasi,
-- tema, caption, dan sesi secara atomik melalui satu RPC yang memeriksa owner.

begin;

create or replace function public.save_event_profile(
  p_event_id uuid,
  p_title text,
  p_couple_name text,
  p_slug text,
  p_event_date timestamptz,
  p_location text,
  p_caption text,
  p_theme_id text,
  p_sessions jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_event public.events%rowtype;
  v_sessions_result json;
  v_title text := btrim(coalesce(p_title, ''));
  v_couple text := btrim(coalesce(p_couple_name, ''));
  v_slug text := public.slugify(p_slug);
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  select e.* into v_event
    from public.events e
    join public.clients c on c.id = e.client_id
   where e.id = p_event_id and c.user_id = auth.uid()
   for update of e;
  if v_event.id is null then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;

  if v_title = '' then
    return json_build_object('success', false, 'message', 'Judul undangan wajib diisi.');
  end if;
  if v_couple = '' then
    return json_build_object('success', false, 'message', 'Nama mempelai wajib diisi.');
  end if;
  if p_event_date is null then
    return json_build_object('success', false, 'message', 'Tanggal acara wajib diisi.');
  end if;
  if btrim(coalesce(p_location, '')) = '' then
    return json_build_object('success', false, 'message', 'Lokasi acara wajib diisi.');
  end if;
  if v_slug is null or length(v_slug) < 3 then
    return json_build_object('success', false, 'message', 'Slug tautan minimal 3 karakter.');
  end if;
  if coalesce(p_theme_id, 'classic') <> 'classic' then
    return json_build_object('success', false, 'message', 'Tema tersebut belum tersedia.');
  end if;

  -- Simpan sesi lebih dulu dalam transaksi yang sama; jika validasi atau
  -- trigger slug gagal setelahnya, seluruh perubahan akan di-rollback.
  v_sessions_result := public.save_event_sessions(p_event_id, p_sessions);
  if not coalesce((v_sessions_result->>'success')::boolean, false) then
    raise exception '%', coalesce(v_sessions_result->>'message', 'Sesi tidak valid.');
  end if;

  update public.events
     set title = v_title,
         couple_name = v_couple,
         slug = v_slug,
         event_date = p_event_date,
         location = nullif(btrim(coalesce(p_location, '')), ''),
         caption = nullif(btrim(coalesce(p_caption, '')), ''),
         theme_id = 'classic'
   where id = p_event_id;

  return json_build_object('success', true, 'event_id', p_event_id,
    'sessions', v_sessions_result->'sessions');
end;
$function$;

revoke execute on function public.save_event_profile(uuid, text, text, text, timestamptz, text, text, text, jsonb)
  from public, anon;
grant execute on function public.save_event_profile(uuid, text, text, text, timestamptz, text, text, text, jsonb)
  to authenticated;

commit;
