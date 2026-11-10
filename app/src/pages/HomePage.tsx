import type { DashboardData } from '@/lib/dashboard'

type Props = { data: DashboardData }

export function HomePage({ data }: Props) {
  const { event, stats, categories } = data
  const tiles = [
    { label: 'Total tamu', value: stats.total_guests, note: `Kuota ${stats.max_quota}` },
    { label: 'Hadir', value: stats.hadir, note: `${stats.hadir_pax} orang` },
    { label: 'Sudah check-in', value: stats.checked_in, note: `${stats.checked_pax} orang` },
    { label: 'Belum terkirim', value: stats.unsent, note: `${stats.pending} menunggu RSVP` },
  ]

  return (
    <>
      <h1 className="page-title">Beranda</h1>
      <p className="page-sub">{event?.title}</p>

      <section className="stat-grid" aria-label="Ringkasan tamu">
        {tiles.map(t => (
          <div key={t.label} className="card">
            <p className="stat-label">{t.label}</p>
            <p className="stat-value">{t.value}</p>
            <p className="stat-note">{t.note}</p>
          </div>
        ))}
      </section>

      <h2 className="section-title">Kategori tamu</h2>
      <ul className="list">
        {categories.map(c => (
          <li key={c.category} className="list-row" style={{ cursor: 'default' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="name">{c.category}</p>
              <p className="meta">{c.total} tamu · {c.pax} orang</p>
            </div>
            <span className="badge badge-ok">{c.hadir} hadir</span>
          </li>
        ))}
      </ul>
    </>
  )
}
