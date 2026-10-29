-- RayaRayu — P3: kuota undangan per paket (penegakan di server)
-- Diterapkan 2026-10-29.
--
-- Sebelumnya kuota hanya angka hiasan: dashboard menampilkan 22/100 karena
-- `max_quota` ditulis mati 100, dan tidak ada pengecekan saat menambah tamu.
-- Sekarang batas disimpan per klien dan ditegakkan di RPC.
--
-- Paket:
--   free    -> 1 acara, 30 undangan
--   pro     -> 20 acara, 1000 undangan  (dipakai akun uji saat ini)
--
-- Kalau nanti harga berubah, cukup ubah guest_limit / event_limit per klien.
-- Tidak perlu mengubah fungsi.

begin;

alter table public.clients add column if not exists tier text not null default 'free';
alter table public.clients add column if not exists guest_limit integer not null default 30;
alter table public.clients add column if not exists event_limit integer not null default 1;

-- Akun yang sudah ada jangan ikut terbatas 30.
update public.clients set tier = 'pro', guest_limit = 1000, event_limit = 20
where tier = 'free';

commit;

-- ============================================================
-- Perubahan fungsi (catatan diff, bukan skrip mandiri)
-- ============================================================

-- 1. get_client_dashboard_data
--    Di dalam json_build_object untuk v_stats:
--      'max_quota', 100
--    menjadi
--      'max_quota', v_client.guest_limit,
--      'tier', v_client.tier
--    Frontend membaca stats.max_quota untuk angka "22/100" di kartu Kuota Tamu.

-- 2. create_event
--      if v_count >= 20 then
--        ... 'Batas 20 acara per akun sudah tercapai.'
--    menjadi
--      if v_count >= v_client.event_limit then
--        ... 'Batas acara untuk paket Anda sudah tercapai.'

-- 3. add_guest_by_client
--    Sebelum blok `v_cetak := (v_type = 'cetak');`, tambahkan:
--
--      if (select count(*) from public.guests g where g.event_id = v_ev.id)
--         >= (select c.guest_limit from public.clients c where c.id = v_ev.client_id) then
--        return json_build_object('success', false, 'message',
--          'Kuota undangan paket Anda sudah penuh. Upgrade untuk menambah tamu.');
--      end if;
--
--    Kuota dihitung per acara, bukan per akun. Untuk paket free yang hanya
--    boleh 1 acara, hasilnya sama.

-- ============================================================
-- Verifikasi (sudah dijalankan, hasilnya seperti di bawah)
-- ============================================================
--
-- Dengan guest_limit sementara 22 dan event_limit 1, di dalam transaksi:
--   add_guest_by_client(...)  -> "Kuota undangan paket Anda sudah penuh. Upgrade untuk menambah tamu."
--   create_event(...)         -> "Batas acara untuk paket Anda sudah tercapai."
--   get_client_dashboard_data -> stats.max_quota = 22
-- Lalu rollback; akun kembali ke guest_limit 1000, event_limit 20.
--
-- Yang belum ditegakkan:
--   - Import massal / duplikasi tamu di luar RPC (tidak ada endpoint lain).
--   - Penurunan paket saat tamu sudah melebihi batas baru. Tamu lama tetap
--     ada; hanya penambahan yang diblokir.
