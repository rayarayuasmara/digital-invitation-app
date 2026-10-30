-- RayaRayu — P6: tautan pratinjau per acara
-- DITERAPKAN 2026-10-30.
--
-- Kenapa: pemilik harus bisa melihat undangannya SEBELUM diterbitkan.
-- Sebelumnya tautan tamu diblokir selama draf, dan tombol share di dashboard
-- menyalin tautan yang tidak valid.
--
-- Desain:
--   - events.preview_token: 20 karakter acak (31^20 ≈ 10^29), bukan 10 seperti
--     token tamu, karena tautan ini boleh dibagikan ke keluarga.
--   - URL: /pratinjau/<slug>/<token>  (rewrite di vercel.json)
--   - Menampilkan tamu palsu "Nama Tamu", pax 2, tanpa RSVP/ucapan/tiket.
--   - Berlaku untuk draf maupun yang sudah terbit.
--   - Tidak memakan kuota tamu karena tidak membuat baris guests.

begin;

alter table public.events add column if not exists preview_token text;

update public.events
   set preview_token = public.gen_invitation_token(20)
 where preview_token is null;

alter table public.events alter column preview_token set default public.gen_invitation_token(20);
alter table public.events alter column preview_token set not null;

create unique index if not exists events_preview_token_key
  on public.events (preview_token);

-- Disengaja bisa dipanggil anon: tautan pratinjau dibagikan tanpa login.
create or replace function public.get_event_preview(p_token text)
returns table (
  event_title text, client_name text, event_caption text, event_date timestamptz,
  event_location text, group_name text, max_pax integer, rsvp_status text,
  pax_confirmed integer, is_checked_in boolean, invitation_token text, ticket_token text,
  session_name text, session_time text, guest_id uuid, event_id uuid,
  is_published boolean, expires_at timestamptz, is_expired boolean, watermark boolean, theme_id text
)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_clean text;
begin
  v_clean := btrim(lower(p_token));

  return query
  select
    coalesce(e.title, 'Undangan Pernikahan'),
    coalesce(e.couple_name, c.name, 'Mempelai'),
    coalesce(e.caption, 'Tanpa Mengurangi Rasa Hormat...'),
    e.event_date,
    coalesce(e.location, 'Lokasi Acara'),
    'Nama Tamu'::text,
    2,
    null::text,
    2,
    false,
    null::text,
    null::text,
    e.session_1_name,
    e.session_1_time,
    null::uuid,
    e.id,
    true,
    ent.expires_at,
    false,
    coalesce(ent.watermark, true),
    coalesce(e.theme_id, 'classic')
  from public.events e
  left join public.clients c on c.id = e.client_id
  left join lateral public.event_entitlements(e.id) ent on true
  where e.preview_token = v_clean
  limit 1;
end;
$$;

-- Ganti token = matikan tautan pratinjau lama.
create or replace function public.rotate_preview_token(p_event_id uuid)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_new text;
begin
  if not exists (
    select 1 from public.events e
      join public.clients c on c.id = e.client_id
     where e.id = p_event_id and c.user_id = auth.uid()
  ) then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  v_new := public.gen_invitation_token(20);
  update public.events set preview_token = v_new where id = p_event_id;
  return json_build_object('success', true, 'preview_token', v_new);
end;
$$;

revoke execute on function public.rotate_preview_token(uuid) from public, anon;
grant  execute on function public.rotate_preview_token(uuid) to authenticated;
grant  execute on function public.get_event_preview(text) to anon, authenticated;

commit;

-- ============================================================
-- Verifikasi saat penerapan
-- ============================================================
--
--   select title, slug, preview_token, length(preview_token)
--     from public.events order by created_at;
--   -> 20 karakter acak per acara
--
--   select event_title, client_name, group_name, max_pax, is_published,
--          is_expired, watermark, theme_id
--     from public.get_event_preview('<token>');
--   -> group_name "Nama Tamu", max_pax 2, is_published true
--
--   has_function_privilege('anon','public.get_event_preview(text)','execute') -> true
--   has_function_privilege('anon','public.rotate_preview_token(uuid)','execute') -> false
