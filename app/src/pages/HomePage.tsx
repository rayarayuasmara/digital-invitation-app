import { Gauge } from '@/components/arc/gauge/gauge'
import type { DashboardData } from '@/lib/dashboard'

type Props = { data: DashboardData }

export function HomePage({ data }: Props) {
  const { event, stats, categories } = data
  const quotaUsed = stats.max_quota > 0 ? Math.round((stats.total_guests / stats.max_quota) * 100) : 0

  return (
    <>
      <h1 className="page-title">Beranda</h1>
      <p className="page-sub">{event?.title}</p>

      <section className="bento" aria-label="Ringkasan tamu">
        <div className="card bento-hero">
          <Gauge
            label="Total tamu"
            value={quotaUsed}
            detail={`${stats.total_guests} dari ${stats.max_quota} kuota`}
          />
          <dl className="split">
            <div>
              <dt>Digital</dt>
              <dd>{stats.digital}</dd>
            </div>
            <div>
              <dt>Cetak</dt>
              <dd>{stats.cetak}</dd>
            </div>
          </dl>
        </div>

        <div className="card bento-tile">
          <p className="stat-label">Hadir</p>
          <p className="stat-value">{stats.hadir}</p>
          <p className="stat-note">{stats.hadir_pax} orang</p>
        </div>

        <div className="card bento-tile">
          <p className="stat-label">Sudah check-in</p>
          <p className="stat-value">{stats.checked_in}</p>
          <p className="stat-note">dari {stats.attending} hadir</p>
        </div>

        <div className="card bento-tile bento-wide">
          <div>
            <p className="stat-label">Belum terkirim</p>
            <p className="stat-value">{stats.unsent}</p>
          </div>
          <p className="stat-note" style={{ textAlign: 'right' }}>{stats.pending} menunggu RSVP</p>
        </div>
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
