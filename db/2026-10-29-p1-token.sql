-- RayaRayu — P1: perkuat token undangan (link yang disebar ke tamu)
-- Diterapkan 2026-10-29.
--
-- Masalah: token lama `encode(gen_random_bytes(4),'hex')` = 8 hex = 32 bit.
-- Token ini adalah bagian link yang dikirim ke tamu: /{slug}/{token}
-- Satu token bocor membuka: undangan tamu, ubah RSVP tamu, kirim ucapan
-- atas nama tamu, baca semua ucapan acara, dan baca nama + status RSVP
-- seluruh tamu acara.
--
-- Perbaikan: 10 karakter dari alfabet 31 simbol = 49,5 bit.
-- Semua pencarian token memakai lower(), jadi alfabet huruf kecil saja.
-- Karakter mirip dibuang (i, l, o, 0, 1) supaya tidak salah ketik.
--
-- 8 hex  = 32 bit
-- 10 chr = 49,5 bit  (naik ~130.000 kali)
--
-- Kolom invitation_token bertipe text dan pencariannya exact match,
-- jadi token lama (8 karakter) tetap berfungsi. Tidak ada link mati.

begin;

-- ============================================================
-- 1. Pembuat token
-- ============================================================

create or replace function public.gen_invitation_token(p_len integer default 10)
returns text
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  v_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789'; -- 31 simbol
  v_len integer := greatest(6, least(32, coalesce(p_len, 10)));
  v_out text := '';
  v_byte integer;
begin
  while length(v_out) < v_len loop
    -- Byte acak kriptografis dari pgcrypto (extensions), bukan random() biasa.
    v_byte := get_byte(extensions.gen_random_bytes(1), 0);
    -- 31 * 8 = 248. Byte di atasnya dibuang supaya sebaran tetap rata
    -- (tanpa ini, huruf awal alfabet jadi lebih sering muncul).
    if v_byte < 248 then
      v_out := v_out || substr(v_alphabet, (v_byte % 31) + 1, 1);
    end if;
  end loop;
  return v_out;
end;
$fn$;

-- Supabase memberi grant EXECUTE ke anon & authenticated secara otomatis
-- untuk setiap fungsi baru di schema public. `revoke ... from public` saja
-- TIDAK menghapus grant itu — harus dicabut per role.
revoke all on function public.gen_invitation_token(integer) from public;
revoke execute on function public.gen_invitation_token(integer) from anon;
revoke execute on function public.gen_invitation_token(integer) from authenticated;

-- ============================================================
-- 2. Cegah token kembar
-- ============================================================

create unique index if not exists guests_invitation_token_lower_key
  on public.guests (lower(invitation_token));

-- ============================================================
-- 3. add_guest_by_client pakai token baru
-- ============================================================

create or replace function public.add_guest_by_client(p_group_name text, p_category text, p_max_pax integer, p_phone text, p_invitation_type text, p_session text default null)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_ev public.events%rowtype;
  v_new_guest_id uuid;
  v_token text;
  v_type text;
  v_cetak boolean;
  v_session text;
  v_cat text;
begin
  select e.* into v_ev
  from public.events e
  join public.clients c on c.id = e.client_id
  where c.user_id = auth.uid()
  limit 1;
  if v_ev.id is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  v_type := coalesce(nullif(p_invitation_type, ''), 'digital');
  v_session := coalesce(nullif(btrim(p_session), ''), v_ev.session_1_name);
  v_cat := coalesce(nullif(btrim(p_category), ''), 'Umum');
  if v_type not in ('digital', 'cetak') then
    return json_build_object('success', false, 'message', 'Tipe undangan tidak valid.');
  end if;
  if v_session not in (v_ev.session_1_name, v_ev.session_2_name) then
    return json_build_object('success', false, 'message', 'Sesi tidak valid.');
  end if;
  if btrim(coalesce(p_group_name, '')) = '' or coalesce(p_max_pax, 0) < 1 then
    return json_build_object('success', false, 'message', 'Nama dan kuota pax wajib diisi.');
  end if;

  for i in 1..8 loop
    v_token := public.gen_invitation_token(10);
    exit when not exists (
      select 1 from public.guests g where lower(g.invitation_token) = v_token
    );
    v_token := null;
  end loop;
  if v_token is null then
    return json_build_object('success', false, 'message', 'Gagal membuat tautan undangan. Coba lagi.');
  end if;

  v_cetak := (v_type = 'cetak');

  insert into public.guests (event_id, group_name, category, max_pax, phone, invitation_type, session,
                             invitation_token, is_sent, is_checked_in)
  values (v_ev.id, btrim(p_group_name), v_cat, p_max_pax, nullif(btrim(coalesce(p_phone, '')), ''),
          v_type, v_session, v_token, v_cetak, false)
  returning id into v_new_guest_id;

  if v_cetak then
    insert into public.rsvps (guest_id, status, pax_confirmed, session, category, updated_at)
    values (v_new_guest_id, 'hadir', p_max_pax, v_session, v_cat, now());
    insert into public.tickets (guest_id, ticket_token, is_checked_in)
    values (v_new_guest_id, v_token, false)
    on conflict (guest_id) do nothing;
  end if;

  return json_build_object('success', true, 'guest_id', v_new_guest_id);
end;
$fn$;

revoke execute on function public.add_guest_by_client(text, text, integer, text, text, text) from public;
grant execute on function public.add_guest_by_client(text, text, integer, text, text, text) to authenticated;

-- ============================================================
-- 3b. Cabut akses anon dari fungsi trigger
--     (hanya dipanggil oleh trigger, tidak lewat API)
--     Grant-nya datang dari default privileges Supabase, bukan dari public.
-- ============================================================

revoke execute on function public.events_sync_session_names() from anon, authenticated, public;
revoke execute on function public.rsvp_fill_guest_meta() from anon, authenticated, public;
revoke execute on function public.sync_rsvp_guest_meta() from anon, authenticated, public;

-- ============================================================
-- 4. Ganti token tamu yang belum dikirim saja
--    (link yang sudah beredar tidak boleh mati)
-- ============================================================

create temp table _rot as
select g.id, public.gen_invitation_token(10) as new_token
from public.guests g
where not g.is_sent
  and g.invitation_token ~ '^[0-9a-f]{8}$';

update public.guests g
set invitation_token = r.new_token
from _rot r
where g.id = r.id;

drop table _rot;

commit;

-- Hasil di project awwraxmftlbekclwdrix:
--   Nanad: 49898081 -> fhddf64cqd
--   Bandit tetap 'ae344fc9c4b3' (token 12 karakter, kemungkinan diisi manual)
--   19 tamu lain tetap memakai token lama yang sudah dikirim
--
-- Verifikasi:
--   anon rpc get_invitation_details('fhddf64cqd') -> 200, data Nanad
--   anon rpc get_invitation_details('49898081')   -> []
--   anon rpc get_invitation_details('e0bb0d8f')   -> 200 (token lama tetap jalan)
