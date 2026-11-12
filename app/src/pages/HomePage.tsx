import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, MapPin, MessageSquareText } from 'lucide-react'
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter'
import { Badge } from '@/components/arc/badge/badge'
import { Card, CardHeader } from '@/components/arc/card'
import { Countdown } from '@/components/arc/countdown/countdown'
import { NotificationCenter } from '@/components/arc/notification-center/notification-center'
import type { NotificationItem } from '@/components/arc/notification-center/notification-center'
import { DonutChart } from '@/components/charts/donut-chart'
import {
  DonutChartCenter,
  DonutChartLegend,
  DonutChartPlot,
} from '@/components/charts/donut-chart'
import { DigitSwap } from '@/components/motion/digit-swap'
import { WishThread } from '@/components/WishThread'
import type { DashboardData } from '@/lib/dashboard'
import type { Guest } from '@/lib/guests'
import type { GuestStatus } from '@/pages/GuestsPanel'
import { fetchWishes, markWishesSeen } from '@/lib/wishes'
import type { Wish } from '@/lib/wishes'

type Props = {
  data: DashboardData
  notify: (message: string) => void
  /** Jump to the Tamu tab with a status filter already applied. */
  onOpenGuests: (status: GuestStatus) => void
}

const WISH_LIMIT = 50
const NOTIF_SEEN_KEY = 'rr_notif_seen'

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

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

export function HomePage({ data, notify, onOpenGuests }: Props) {
  const { event, stats, categories, client, guests } = data
  const total = stats.total_guests
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
    { id: 'hadir', name: 'Hadir', value: stats.hadir, color: 'var(--green-ink)' },
    { id: 'tidak', name: 'Tidak hadir', value: stats.absen, color: 'var(--red-ink)' },
    { id: 'pending', name: 'Pending', value: stats.pending, color: '#e8a33d' },
  ]

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => b.total - a.total),
    [categories],
  )

  const sessionText = (event?.sessions ?? [])
    .filter(s => s.time_text)
    .map(s => `${s.name} ${s.time_text}`)
    .join(' · ')

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Beranda</h1>
        <div className="page-head-actions">
          <NotificationCenter
            notifications={notifications}
            label="Notifikasi"
            onOpenChange={onNotificationsOpen}
          />
        </div>
      </div>

      <Card variant="default" padding="md" className="event-card">
        <p className="stat-label">Acara</p>
        <p className="event-title">{event?.title}</p>
        <p className="event-meta">{formatDate(event?.event_date ?? null)}</p>
        {sessionText && <p className="event-meta">{sessionText}</p>}
        {event?.location && (
          <p className="event-meta event-location">
            <MapPin size={14} strokeWidth={1.75} aria-hidden />
            <span>{event.location}</span>
          </p>
        )}
        <div className="event-countdown">
          <span className="event-countdown-label">Menuju hari H</span>
          <Countdown
            target={event?.event_date ?? new Date().toISOString()}
            timeZone="Asia/Jakarta"
            variant="compact"
            label="Menuju hari H"
            completeLabel="Acara sudah berlangsung"
            units={['days', 'hours', 'minutes']}
          />
        </div>
        <p className="event-quota">
          <b>{total}</b> dari {stats.max_quota.toLocaleString('id-ID')} kuota
          <span className="event-quota-split"> · {stats.digital} digital · {stats.cetak} cetak</span>
        </p>
      </Card>

      <div className="action-grid" aria-label="Perlu tindakan">
        <button type="button" className="action-tile" onClick={() => onOpenGuests('belum_terkirim')}>
          <span className="action-tile-label">Belum terkirim</span>
          <span className="action-tile-value">{stats.unsent}</span>
          <span className="action-tile-hint">Lihat undangan <ChevronRight size={14} aria-hidden /></span>
        </button>
        <button type="button" className="action-tile" onClick={() => onOpenGuests('pending')}>
          <span className="action-tile-label">Pending</span>
          <span className="action-tile-value">{stats.pending}</span>
          <span className="action-tile-hint">Lihat tamu <ChevronRight size={14} aria-hidden /></span>
        </button>
      </div>

      <Card variant="default" padding="md" style={{ marginTop: 12 }}>
        <CardHeader title="Status RSVP" description="Distribusi konfirmasi kehadiran tamu" />
        <div className="rsvp-chart" data-beui>
          <DonutChart
            segments={rsvp}
            label="Status RSVP tamu"
            labels={{ label: 'Status RSVP tamu', total: 'Total tamu' }}
            formatValue={value => value.toLocaleString('id-ID')}
          >
            <div className="rsvp-chart-grid">
              <DonutChartPlot>
                <DonutChartCenter>
                  {(segment, total) => (
                    <>
                      <span className="donut-value">
                        <DigitSwap value={(segment?.value ?? total).toLocaleString('id-ID')} />
                      </span>
                      <span className="donut-caption">
                        {segment ? segment.name : 'Total tamu'}
                      </span>
                    </>
                  )}
                </DonutChartCenter>
              </DonutChartPlot>
              <DonutChartLegend
                renderValue={segment => (
                  <span className="donut-legend-value">
                    <b>{segment.value}</b>
                  </span>
                )}
              />
            </div>
          </DonutChart>
        </div>
      </Card>

      <div className="tiles" aria-label="Ringkasan kehadiran">
        <Card variant="default" padding="md" className="tile">
          <p className="stat-label">Orang hadir</p>
          <p className="tile-value"><AnimatedCounter value={stats.hadir_pax} locale="id-ID" /></p>
          <p className="stat-note">dari {stats.attending} tamu hadir</p>
        </Card>
        <Card variant="default" padding="md" className="tile">
          <p className="stat-label">Check-in</p>
          <p className="tile-value"><AnimatedCounter value={stats.checked_in} locale="id-ID" /></p>
          <p className="stat-note">dari {stats.attending} tamu hadir</p>
        </Card>
      </div>

      <Card variant="default" padding="md" style={{ marginTop: 12 }}>
        <CardHeader
          title="Kategori tamu"
          description={`${total} tamu · ${orderedCategories.length} kategori`}
        />
        <ul className="cat-chips">
          {orderedCategories.map(c => (
            <li key={c.category} className="cat-chip">
              <span>{c.category}</span>
              <b>{c.total}</b>
            </li>
          ))}
        </ul>
      </Card>

      <Card variant="default" padding="none" style={{ marginTop: 12 }} aria-labelledby="ucapan-title">
        <CardHeader
          title={<>
            <MessageSquareText size={20} aria-hidden />
            <span>Ucapan</span>
          </>}
          description={<span className="wish-total">{wishTotal}</span>}
          action={unread > 0 && (
            <button type="button" onClick={markSeen} className="wish-unread" aria-label={`${unread} ucapan belum dibaca, tandai sudah dibaca`}>
              <Badge tone="info" size="sm" pill>{unread} belum dibaca</Badge>
            </button>
          )}
        />
        <div className="wish-content">
          {error && <p role="alert" className="wish-empty" style={{ color: 'var(--red-ink)' }}>{error}</p>}
          {!error && wishes === null && <p className="wish-empty">Memuat ucapan…</p>}
          {wishes && wishes.length === 0 && <p className="wish-empty">Belum ada ucapan masuk.</p>}
          {wishes && wishes.length > 0 && (
            <WishThread wishes={wishes} guests={guests} hostName={client.name} seenAt={seen} />
          )}
        </div>
      </Card>
    </>
  )
}
