# digital-invitation-app

Undangan pernikahan digital RayaRayu. Empat halaman statis:

| File | URL | Isi |
|---|---|---|
| `index.html` | `/` | Landing page |
| `dashboard.html` | `/dashboard` | Panel klien (login) |
| `scanner.html` | `/scanner` | Check-in petugas (kode akses) |
| `invitation.html` | `/{slug}/{token}` | Undangan tamu |

Tidak ada build step. Deploy lewat Vercel dari branch `main`, rewrite di
`vercel.json`.

Perubahan database (policy, RPC, index, token) dicatat di
[`db/README.md`](db/README.md) — baca itu sebelum menyentuh Supabase.

## Sebelum mengubah

- Frontend memanggil Supabase langsung. Nama dan parameter RPC adalah kontrak
  API; mengubahnya memutus halaman tanpa error build.
- Jangan menambah policy `using (true)` untuk role `public` pada tabel mana pun.
- `opencode.json` memuat token GitHub dan tidak masuk git.
