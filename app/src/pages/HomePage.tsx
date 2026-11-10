import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter'
import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import type { DashboardData } from '@/lib/dashboard'

type Props = { data: DashboardData }

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
export function HomePage({ data }: Props) {
  const { event, stats, categories } = data
  const total = stats.total_guests
  const quotaPct = pct(total, stats.max_quota)

  const rsvp = [
    { key: 'hadir', label: 'Hadir', value: stats.hadir, color: 'var(--green-ink)' },
    { key: 'tidak', label: 'Tidak hadir', value: stats.absen, color: 'var(--red-ink)' },
    { key: 'pending', label: 'Pending', value: stats.pending, color: '#e8a33d' },
  ]

  return (
    <>
      <h1 className="page-title">Beranda</h1>
      <p className="page-sub">{event?.title}</p>

      <section className="card hero">
        <p className="stat-label">Total tamu</p>
        <div className="hero-row">
          <span className="hero-number">{total}</span>
          <span className="hero-of">dari {stats.max_quota.toLocaleString('id-ID')} kuota</span>
        </div>
        <div className="meter" role="img" aria-label={`Kuota terpakai ${Math.round(quotaPct)} persen`}>
          <span style={{ width: `${Math.max(quotaPct, 1)}%` }} />
        </div>
        <div className="hero-split">
          <span><b>{stats.digital}</b> digital</span>
          <span><b>{stats.cetak}</b> cetak</span>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <p className="stat-label">Status RSVP</p>
        <div className="rsvp">
          <DonutChart
            label="Status RSVP tamu"
            size={168}
            thickness={20}
            totalLabel="Tamu"
            data={rsvp.map(r => ({ key: r.key, label: r.label, value: r.value, color: r.color }))}
          />
        </div>
      </section>

      <section className="tiles" aria-label="Ringkasan lain">
        <div className="card tile">
          <p className="stat-label">Hadir orang</p>
          <p className="tile-value"><AnimatedCounter value={stats.hadir_pax} locale="id-ID" /></p>
          <p className="stat-note">dari tamu hadir</p>
        </div>
        <div className="card tile">
          <p className="stat-label">Check-in</p>
          <p className="tile-value"><AnimatedCounter value={stats.checked_in} locale="id-ID" /></p>
          <p className="stat-note">dari {stats.attending} hadir</p>
        </div>
        <div className="card tile tile-warn">
          <p className="stat-label">Belum terkirim</p>
          <p className="tile-value"><AnimatedCounter value={stats.unsent} locale="id-ID" /></p>
          <p className="stat-note">undangan</p>
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
