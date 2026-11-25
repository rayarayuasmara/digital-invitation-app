export function MissingSupabaseConfig() {
  return (
    <main id="main-content" role="alert" style={{ padding: 24 }}>
      <h1>Konfigurasi Supabase belum lengkap</h1>
      <p>Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local.</p>
    </main>
  )
}
