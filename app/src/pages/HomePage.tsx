import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, MessageSquareText } from 'lucide-react'
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter'
import { Badge } from '@/components/arc/badge/badge'
import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { WishThread } from '@/components/WishThread'
import type { DashboardData } from '@/lib/dashboard'
import { fetchWishes, markWishesSeen } from '@/lib/wishes'
import type { Wish } from '@/lib/wishes'

type Props = { data: DashboardData; notify: (message: string) => void }

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
const WISH_LIMIT = 50

export function HomePage({ data, notify }: Props) {
  const { event, stats, categories, client, guests } = data
  const total = stats.total_guests
  const quotaPct = pct(total, stats.max_quota)
  const eventId = event!.id

  const [seen, setSeen] = useState<string | null>(event?.wishes_seen_at ?? null)
  const [wishes, setWishes] = useState<Wish[] | null>(null)
  const [wishTotal, setWishTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const sectionRef = useRef<HTMLElement>(null)

  const load = useCallback(async () => {
    try {
      const summary = await fetchWishes(eventId, seen, WISH_LIMIT)
      setWishes([...summary.wishes].reverse())
      setWishTotal(summary.total)
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

  const jumpToWishes = () => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const rsvp = [
    { key: 'hadir', label: 'Hadir', value: stats.hadir, color: 'var(--green-ink)' },
    { key: 'tidak', label: 'Tidak hadir', value: stats.absen, color: 'var(--red-ink)' },
    { key: 'pending', label: 'Pending', value: stats.pending, color: '#e8a33d' },
  ]

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Beranda</h1>
          <p className="page-sub">{event?.title}</p>
        </div>
        <button
          type="button"
          className="icon-btn bell"
          onClick={jumpToWishes}
          aria-label={unread > 0 ? `Notifikasi, ${unread} ucapan belum dibaca` : 'Notifikasi'}
        >
          <Bell size={18} aria-hidden />
          {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
        </button>
      </div>

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

      <section ref={sectionRef} id="ucapan" className="card wish-card" style={{ marginTop: 12 }} aria-labelledby="ucapan-title">
        <div className="wish-head">
          <div className="wish-title">
            <MessageSquareText size={18} aria-hidden />
            <h2 id="ucapan-title">Ucapan</h2>
            <span className="wish-total">{wishTotal}</span>
          </div>
          {unread > 0 && (
            <button type="button" onClick={markSeen} className="wish-unread" aria-label={`${unread} ucapan belum dibaca, tandai sudah dibaca`}>
              <Badge tone="info" size="sm" pill>{unread} belum dibaca</Badge>
            </button>
          )}
        </div>

        {error && <p role="alert" className="wish-empty" style={{ color: 'var(--red-ink)' }}>{error}</p>}
        {!error && wishes === null && <p className="wish-empty">Memuat ucapan…</p>}
        {wishes && wishes.length === 0 && <p className="wish-empty">Belum ada ucapan masuk.</p>}
        {wishes && wishes.length > 0 && (
          <WishThread wishes={wishes} guests={guests} hostName={client.name} seenAt={seen} />
        )}
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
