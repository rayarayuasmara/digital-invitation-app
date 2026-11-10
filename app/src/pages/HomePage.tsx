import { Gauge } from '@/components/arc/gauge/gauge'
import type { DashboardData } from '@/lib/dashboard'

type Props = { data: DashboardData }

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export function HomePage({ data }: Props) {
  const { event, stats, categories } = data

  return (
    <>
      <h1 className="page-title">Beranda</h1>
      <p className="page-sub">{event?.title}</p>

      <section className="stat-grid" aria-label="Ringkasan tamu">
        <div className="card stat-card">
          <p className="stat-label">Total tamu</p>
          <p className="stat-value">{stats.total_guests}</p>
          <p className="stat-note">Kuota {stats.max_quota}</p>
        </div>

        <div className="card stat-card">
          <Gauge
            label="Hadir"
            value={percent(stats.hadir, stats.total_guests)}
            detail={`${stats.hadir} tamu · ${stats.hadir_pax} orang`}
          />
        </div>

        <div className="card stat-card">
          <Gauge
            label="Sudah check-in"
            value={percent(stats.checked_in, stats.attending)}
            detail={`${stats.checked_in} dari ${stats.attending} hadir`}
          />
        </div>

        <div className="card stat-card">
          <Gauge
            label="Belum terkirim"
            value={percent(stats.unsent, stats.total_guests)}
            detail={`${stats.unsent} tamu belum dikirim`}
            thresholds={[
              { from: 0, tone: 'success', label: 'Semua terkirim' },
              { from: 20, tone: 'warning', label: 'Perlu dikirim' },
              { from: 50, tone: 'danger', label: 'Banyak tertunda' },
            ]}
          />
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
