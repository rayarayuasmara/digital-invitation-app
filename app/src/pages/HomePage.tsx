import { useCallback, useEffect, useState } from 'react'
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter'
import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { WishThread } from '@/components/WishThread'
import type { DashboardData } from '@/lib/dashboard'
import { fetchWishes, markWishesSeen } from '@/lib/wishes'
import type { Wish } from '@/lib/wishes'

type Props = { data: DashboardData; notify: (message: string) => void }

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
const WISH_LIMIT = 50

function WishesCard({ eventId, seenAt, notify }: { eventId: string; seenAt: string | null; notify: (m: string) => void }) {
  const [wishes, setWishes] = useState<Wish[] | null>(null)
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [seen, setSeen] = useState(seenAt)

  const load = useCallback(async () => {
    try {
      const summary = await fetchWishes(eventId, seen, WISH_LIMIT)
      setWishes([...summary.wishes].reverse())
      setTotal(summary.total)
      setUnread(summary.unread)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ucapan belum bisa dimuat.')
    }
  }, [eventId, seen])

  useEffect(() => {
    load()
  }, [load])

  const markSeen = async () => {
    try {
      await markWishesSeen(eventId)
      setSeen(new Date().toISOString())
      notify('Ucapan ditandai sudah dibaca')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal menandai ucapan.')
    }
  }

  return (
    <section className="card" style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
      <div className="wish-head">
        <div>
          <p className="stat-label" style={{ margin: 0 }}>Ucapan</p>
          <p className="stat-note" style={{ margin: '2px 0 0' }}>{total} ucapan · hanya untuk dibaca</p>
        </div>
        {unread > 0 && (
          <button type="button" className="badge badge-ok" onClick={markSeen} style={{ border: 0, cursor: 'pointer' }}>
            {unread} baru · tandai dibaca
          </button>
        )}
      </div>

      {error && <p role="alert" className="wish-empty" style={{ color: 'var(--red-ink)' }}>{error}</p>}
      {!error && wishes === null && <p className="wish-empty">Memuat ucapan…</p>}
      {wishes && wishes.length === 0 && <p className="wish-empty">Belum ada ucapan masuk.</p>}
      {wishes && wishes.length > 0 && <WishThread wishes={wishes} />}
    </section>
  )
}

export function HomePage({ data, notify }: Props) {
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

      <WishesCard eventId={event!.id} seenAt={event?.wishes_seen_at ?? null} notify={notify} />

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
