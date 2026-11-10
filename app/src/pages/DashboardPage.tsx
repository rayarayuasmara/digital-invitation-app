import { useEffect, useState } from 'react'
import { Button } from '@/components/arc/button/button'
import { useAuth } from '@/lib/auth'
import { fetchDashboard } from '@/lib/dashboard'
import type { DashboardData } from '@/lib/dashboard'

const brandButton = {
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: 'var(--accent-foreground)',
} as const

export function DashboardPage() {
  const { signOut } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat data.'))
  }, [])

  if (error) {
    return (
      <main style={pageStyle}>
        <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>
        <Button variant="secondary" onClick={() => signOut()}>Keluar</Button>
      </main>
    )
  }

  if (!data) return <main style={pageStyle}><p style={{ color: 'var(--text-secondary)' }}>Memuat…</p></main>

  if (!data.event) {
    return (
      <main style={pageStyle}>
        <p style={{ color: 'var(--text-secondary)' }}>Belum ada acara. Onboarding akan menyusul di tahap berikutnya.</p>
        <Button variant="secondary" onClick={() => signOut()}>Keluar</Button>
      </main>
    )
  }

  const { event, stats, categories } = data
  const tiles = [
    { label: 'Total tamu', value: stats.total_guests, note: `Kuota ${stats.max_quota}` },
    { label: 'Hadir', value: stats.hadir, note: `${stats.hadir_pax} orang` },
    { label: 'Sudah check-in', value: stats.checked_in, note: `${stats.checked_pax} orang` },
    { label: 'Belum terkirim', value: stats.unsent, note: `${stats.pending} menunggu RSVP` },
  ]

  return (
    <main style={{ ...pageStyle, alignItems: 'stretch', justifyContent: 'flex-start', padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{event.title}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>{event.location}</p>
        </div>
        <Button variant="secondary" onClick={() => signOut()}>Keluar</Button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 24 }}>
        {tiles.map(t => (
          <div key={t.label} style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 16, background: 'var(--surface)' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>{t.label}</p>
            <p style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 600 }}>{t.value}</p>
            <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>{t.note}</p>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>Kategori tamu</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {categories.map(c => (
            <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
              <span>{c.category}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{c.total} tamu · {c.hadir} hadir</span>
            </div>
          ))}
        </div>
      </section>

      <p style={{ marginTop: 32 }}>
        <Button variant="primary" size="lg" style={brandButton} disabled>Scanner (segera)</Button>
      </p>
    </main>
  )
}

const pageStyle = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 24,
} as const
