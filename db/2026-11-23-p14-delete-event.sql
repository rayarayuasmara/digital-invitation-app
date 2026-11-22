-- RayaRayu — P14: hapus acara milik klien sendiri
--
-- Tombol "Hapus acara" di bottom sheet akun memakai RPC ini. Kepemilikan
-- diperiksa lewat clients.user_id = auth.uid(), jadi id acara milik klien lain
-- tidak bisa dihapus walaupun id-nya diketahui.
--
-- Tabel anak sudah punya ON DELETE CASCADE (event_sessions, guests, wishes,
-- client_addons), sedangkan orders memakai ON DELETE SET NULL sehingga riwayat
-- pembayaran tetap tersimpan tanpa acara.

begin;

create or replace function public.delete_event(p_event_id uuid)
returns json language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_deleted uuid;
begin
  if auth.uid() is null then
    return json_build_object('success', false, 'message', 'Unauthorized');
  end if;

  delete from public.events e
  using public.clients c
  where e.id = p_event_id
    and c.id = e.client_id
    and c.user_id = auth.uid()
  returning e.id into v_deleted;

  if v_deleted is null then
    return json_build_object('success', false, 'message', 'Acara tidak ditemukan.');
  end if;

  return json_build_object('success', true, 'message', 'Acara dihapus.');
end;
$$;

revoke execute on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated;

commit;
