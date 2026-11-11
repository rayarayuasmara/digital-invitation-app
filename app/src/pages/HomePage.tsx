import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter'
import { Badge } from '@/components/arc/badge/badge'
import { Countdown } from '@/components/arc/countdown/countdown'
import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { NotificationCenter } from '@/components/arc/notification-center/notification-center'
import type { NotificationItem } from '@/components/arc/notification-center/notification-center'
import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import type { UsageMeterSegment } from '@/components/arc/usage-meter/usage-meter'
import { WishThread } from '@/components/WishThread'
import type { DashboardData } from '@/lib/dashboard'
import type { Guest } from '@/lib/guests'
import { fetchWishes, markWishesSeen } from '@/lib/wishes'
import type { Wish } from '@/lib/wishes'

type Props = { data: DashboardData; notify: (message: string) => void }

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
const WISH_LIMIT = 50
const NOTIF_SEEN_KEY = 'rr_notif_seen'
/** The usage meter reads clearly with at most four segments. */
const METER_SEGMENTS = 4

function timeAgo(iso: string) {
  const min = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'Baru saja'
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}

/**
 * The notification centre is the one place for everything that happened: new wishes, RSVP replies and
 * check-ins today. Order and upgrade notices will slot into the same list.
 */
function buildNotifications(wishes: Wish[], guests: Guest[], seen: string | null, notifSeen: number): NotificationItem[] {
  const seenWish = seen ? new Date(seen).getTime() : 0
  const items: { at: number; item: NotificationItem }[] = []

  for (const w of wishes) {
    const at = new Date(w.created_at).getTime()
    items.push({
      at,
      item: {
        id: `wish:${w.id}`,
        title: `Ucapan baru dari ${w.guest_name || 'Tamu'}`,
        description: w.message.length > 80 ? `${w.message.slice(0, 80)}…` : w.message,
        time: timeAgo(w.created_at),
        read: at <= seenWish,
        tone: 'info',
      },
    })
  }

  for (const g of guests) {
    if (g._rsvp_at && (g.rsvp_status === 'hadir' || g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen')) {
      const at = new Date(g._rsvp_at).getTime()
      const attending = g.rsvp_status === 'hadir'
      items.push({
        at,
        item: {
          id: `rsvp:${g.id}`,
          title: `${g.group_name} ${attending ? 'akan hadir' : 'tidak bisa hadir'}`,
          description: `Konfirmasi RSVP · ${g.max_pax} orang`,
          time: timeAgo(g._rsvp_at),
          read: at <= notifSeen,
          tone: attending ? 'success' : 'warning',
        },
      })
    }
    if (g._checkin_at) {
      const at = new Date(g._checkin_at).getTime()
      items.push({
        at,
        item: {
          id: `checkin:${g.id}`,
          title: `${g.group_name} sudah check-in`,
          description: `${g.max_pax} orang masuk`,
          time: timeAgo(g._checkin_at),
          read: at <= notifSeen,
          tone: 'success',
        },
      })
    }
  }

  return items.sort((a, b) => b.at - a.at).slice(0, 40).map(x => x.item)
}

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
  const [notifSeen, setNotifSeen] = useState(() => Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0))

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

  const notifications = useMemo(
    () => buildNotifications(wishes ?? [], guests, seen, notifSeen),
    [wishes, guests, seen, notifSeen],
  )

  const onNotificationsOpen = (open: boolean) => {
    if (!open) return
    const now = Date.now()
    localStorage.setItem(NOTIF_SEEN_KEY, String(now))
    setNotifSeen(now)
  }

  const rsvp = [
    { key: 'hadir', label: 'Hadir', value: stats.hadir, color: 'var(--green-ink)' },
    { key: 'tidak', label: 'Tidak hadir', value: stats.absen, color: 'var(--red-ink)' },
    { key: 'pending', label: 'Pending', value: stats.pending, color: '#e8a33d' },
  ]

  /** Top categories fill the meter; the tail folds into one segment so the bar stays readable on a phone. */
  const segments = useMemo<UsageMeterSegment[]>(() => {
    const ordered = [...categories].sort((a, b) => b.total - a.total)
    if (ordered.length <= METER_SEGMENTS) {
      return ordered.map(c => ({ id: c.category, label: c.category, value: c.total }))
    }
    const head = ordered.slice(0, METER_SEGMENTS - 1).map(c => ({ id: c.category, label: c.category, value: c.total }))
    const tail = ordered.slice(METER_SEGMENTS - 1)
    return [...head, { id: '__rest', label: 'Kategori lain', value: tail.reduce((sum, c) => sum + c.total, 0) }]
  }, [categories])

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Beranda</h1>
          <p className="page-sub">{event?.title}</p>
        </div>
        <div className="page-head-actions">
          <NotificationCenter
            notifications={notifications}
            label="Notifikasi"
            onOpenChange={onNotificationsOpen}
          />
        </div>
      </div>

      <section className="card countdown-card" aria-label="Hitung mundur acara">
        <Countdown
          target={event?.event_date ?? new Date().toISOString()}
          timeZone="Asia/Jakarta"
          variant="compact"
          label="Menuju hari H"
          completeLabel="Acara sudah berlangsung"
          units={['days', 'hours', 'minutes']}
        />
      </section>

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
        <p className="stat-label" style={{ marginBottom: 12 }}>Status RSVP</p>
        <DonutChart
          label="Status RSVP tamu"
          totalLabel="Tamu"
          data={rsvp.map(r => ({ key: r.key, label: r.label, value: r.value, color: r.color }))}
        />
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <UsageMeter
          label="Kategori tamu"
          segments={segments}
          limit={Math.max(stats.max_quota, total, 1)}
          unit="tamu"
          decimals={0}
          freeLabel="Sisa kuota"
        />
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

      <section id="ucapan" className="card wish-card" style={{ marginTop: 12 }} aria-labelledby="ucapan-title">
        <div className="wish-head">
          <div className="wish-title">
            <MessageSquareText size={20} aria-hidden />
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
    </>
  )
}
