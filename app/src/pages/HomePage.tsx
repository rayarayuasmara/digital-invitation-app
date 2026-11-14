import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, Clock, History, MapPin, MessageSquareText } from 'lucide-react'
import { AnimatedCounter } from '@/components/arc/animated-counter/animated-counter'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { Card, CardHeader } from '@/components/arc/card'
import { ChatThread } from '@/components/arc/chat-thread/chat-thread'
import { Countdown, toEpoch } from '@/components/arc/countdown/countdown'
import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import { NotificationCenter } from '@/components/arc/notification-center/notification-center'
import type { NotificationItem } from '@/components/arc/notification-center/notification-center'
import { DonutChart } from '@/components/charts/donut-chart'
import {
  DonutChartCenter,
  DonutChartLegend,
  DonutChartPlot,
} from '@/components/charts/donut-chart'
import { DigitSwap } from '@/components/motion/digit-swap'
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

/** One stable author id per guest, so a guest's wishes group into the same conversation. */
function wishAuthor(w: Wish) {
  return w.guest_id ?? `name:${(w.guest_name ?? 'tamu').trim().toLowerCase()}`
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
  const { event, stats, categories, guests } = data
  const total = stats.total_guests
  const eventId = event!.id

  const [seen, setSeen] = useState<string | null>(event?.wishes_seen_at ?? null)
  const [wishes, setWishes] = useState<Wish[] | null>(null)
  const [wishTotal, setWishTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [notifSeen, setNotifSeen] = useState(() => Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0))
  const [rsvpFocus, setRsvpFocus] = useState<string | null>(null)

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

  const wishParticipants = useMemo(() => {
    const people = new Map<string, string>()
    for (const w of wishes ?? []) {
      const id = wishAuthor(w)
      if (!people.has(id)) people.set(id, w.guest_name || 'Tamu')
    }
    return [...people].map(([id, name]) => ({ id, name }))
  }, [wishes])

  const wishMessages = useMemo(
    () => (wishes ?? []).map(w => ({
      id: w.id,
      authorId: wishAuthor(w),
      text: w.message,
      createdAt: w.created_at,
    })),
    [wishes],
  )

  /** Every RSVP reply and check-in, newest first, for the activity feed. */
  const activity = useMemo(() => {
    type Activity = { id: string; kind: 'rsvp' | 'checkin'; at: string; name: string; text: string; detail: string; tone: 'success' | 'warning' | 'danger' | 'info' }
    const items: Activity[] = []
    for (const g of guests) {
      if (g._rsvp_at && (g.rsvp_status === 'hadir' || g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen')) {
        const attending = g.rsvp_status === 'hadir'
        items.push({
          id: `rsvp:${g.id}`,
          kind: 'rsvp',
          at: g._rsvp_at,
          name: g.group_name,
          text: attending ? 'Hadir' : 'Tidak hadir',
          detail: `RSVP · ${g.max_pax} pax`,
          tone: attending ? 'success' : 'danger',
        })
      }
      if (g._checkin_at) {
        items.push({
          id: `checkin:${g.id}`,
          kind: 'checkin',
          at: g._checkin_at,
          name: g.group_name,
          text: 'Check-in',
          detail: `Masuk · ${g.max_pax} pax`,
          tone: 'info',
        })
      }
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [guests])

  // Show the latest few of each kind so check-ins are never buried under a run of RSVPs.
  const activityFeed = useMemo(() => {
    const rsvps = activity.filter(item => item.kind === 'rsvp').slice(0, 4)
    const checkins = activity.filter(item => item.kind === 'checkin').slice(0, 4)
    return [...rsvps, ...checkins].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [activity])

  // Share of confirmed guests who have already checked in, capped so walk-ins never show over 100%.
  const checkinPct = stats.attending > 0
    ? Math.min(100, Math.round((stats.checked_in / stats.attending) * 100))
    : 0

  const quotaFree = Math.max(0, stats.max_quota - total)
  const quotaPct = stats.max_quota > 0 ? Math.min(100, Math.round((total / stats.max_quota) * 100)) : 0

  const sessionText = (event?.sessions ?? [])
    .filter(s => s.time_text)
    .map(s => `${s.name} ${s.time_text}`)
    .join(' · ')

  // Countdown uses the same target parsing so the hero badge and the digits never disagree.
  const msToEvent = event?.event_date
    ? toEpoch(event.event_date, 'Asia/Jakarta') - Date.now()
    : 0
  const daysToEvent = Math.floor(msToEvent / 86_400_000)
  const heroBadge = msToEvent <= 0 ? 'Selesai' : daysToEvent <= 0 ? 'Hari ini' : `H-${daysToEvent}`
  const heroBadgeLabel = msToEvent <= 0 ? 'Acara selesai' : daysToEvent <= 0 ? 'Hari ini' : `${daysToEvent} hari lagi`

  return (
    <div className="home-page">
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

      {/* Bento Grid Layout */}
      <div className="bento-grid">
        {/* Hero: one invitation-ticket panel for the event, its details and the countdown */}
        <Card variant="default" padding="none" className="bento-hero event-hero">
          <div className="event-hero-top">
            <span className="event-hero-eyebrow">
              <span className="event-hero-ping" aria-hidden />
              Acara
            </span>
            <span className="event-hero-badge" aria-label={heroBadgeLabel}>{heroBadge}</span>
          </div>

          <h2 className="event-hero-title">{event?.title}</h2>

          <ul className="event-hero-facts">
            <li>
              <CalendarDays size={15} strokeWidth={1.75} aria-hidden />
              <span>{formatDate(event?.event_date ?? null)}</span>
            </li>
            {sessionText && (
              <li>
                <Clock size={15} strokeWidth={1.75} aria-hidden />
                <span>{sessionText}</span>
              </li>
            )}
            {event?.location && (
              <li>
                <MapPin size={15} strokeWidth={1.75} aria-hidden />
                <span>{event.location}</span>
              </li>
            )}
          </ul>

          <div className="event-hero-countdown">
            <span className="event-hero-countdown-label">Menuju hari H</span>
            <Countdown
              target={event?.event_date ?? new Date().toISOString()}
              timeZone="Asia/Jakarta"
              variant="large"
              label="Menuju hari H"
              completeLabel="Acara sudah berlangsung"
              units={['days', 'hours', 'minutes', 'seconds']}
            />
          </div>
        </Card>

        {/* RSVP donut - right under the event, above the quota */}
        <Card variant="default" padding="md" className="bento-rsvp">
          <CardHeader title="Status RSVP" description="Konfirmasi kehadiran" />
          <div className="rsvp-chart" data-beui>
            <DonutChart
              segments={rsvp}
              label="Status RSVP tamu"
              labels={{ label: 'Status RSVP tamu', total: 'Total tamu' }}
              formatValue={value => value.toLocaleString('id-ID')}
              activeId={rsvpFocus}
              onActiveChange={setRsvpFocus}
              selectedId={rsvpFocus}
              onSelect={id => setRsvpFocus(current => current === id ? null : id)}
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
                      <b>{Math.round(segment.share * 100)}%</b>
                      <span>{segment.value}</span>
                    </span>
                  )}
                />
              </div>
            </DonutChart>
          </div>
        </Card>

        {/* Quota meter - spans 2 columns */}
        <Card variant="default" padding="md" className="bento-quota quota-card">
          <div className="quota-head">
            <p className="stat-label">Kuota undangan</p>
            <Badge size="sm" pill>Sisa {quotaFree.toLocaleString('id-ID')}</Badge>
          </div>
          <p className="quota-used">
            <AnimatedCounter value={total} locale="id-ID" />
            <span>dari {stats.max_quota.toLocaleString('id-ID')} terpakai</span>
          </p>
          <div className="quota-bar" role="img" aria-label={`${total} dari ${stats.max_quota} undangan terpakai`}>
            <span style={{ width: `${quotaPct}%` }} />
          </div>
          <div className="quota-split">
            <span>Digital <b>{stats.digital}</b></span>
            <span>Cetak <b>{stats.cetak}</b></span>
          </div>
        </Card>

        {/* Action tiles - compact, side by side */}
        {stats.unsent > 0 && (
          <button type="button" className="bento-action" onClick={() => onOpenGuests('belum_terkirim')}>
            <span className="bento-action-label">Belum terkirim</span>
            <span className="bento-action-value">{stats.unsent}</span>
            <ChevronRight size={16} className="bento-action-icon" aria-hidden />
          </button>
        )}
        {stats.pending > 0 && (
          <button type="button" className="bento-action" onClick={() => onOpenGuests('pending')}>
            <span className="bento-action-label">Pending</span>
            <span className="bento-action-value">{stats.pending}</span>
            <ChevronRight size={16} className="bento-action-icon" aria-hidden />
          </button>
        )}

        {/* Attendance metrics - 2 tiles */}
        <Card variant="default" padding="md" className="bento-stat">
          <p className="stat-label">Orang hadir</p>
          <p className="bento-stat-value"><AnimatedCounter value={stats.hadir_pax} locale="id-ID" /></p>
          <p className="stat-note">dari {stats.attending} tamu</p>
        </Card>
        <Card variant="default" padding="md" className="bento-stat">
          <p className="stat-label">Check-in</p>
          <p className="bento-stat-value"><AnimatedCounter value={stats.checked_in} locale="id-ID" /></p>
          <p className="stat-note">{checkinPct}% tamu hadir</p>
        </Card>

        {/* RSVP and check-in history */}
        <Card variant="default" padding="md" className="bento-activity" aria-labelledby="activity-title">
          <CardHeader
            title={
              <span className="wish-title">
                <History size={20} aria-hidden />
                <span id="activity-title">Riwayat tamu</span>
              </span>
            }
            description={`${activity.filter(item => item.kind === 'rsvp').length} RSVP · ${activity.filter(item => item.kind === 'checkin').length} check-in`}
          />
          {activity.length === 0 ? (
            <p className="activity-empty">Belum ada tamu yang RSVP atau check-in.</p>
          ) : (
            <ol className="activity-list">
              {activityFeed.map(item => (
                <li key={item.id} className="activity-item">
                  <Avatar name={item.name} size="sm" />
                  <div className="activity-copy">
                    <p className="activity-name">{item.name}</p>
                    <p className="activity-detail">{item.detail} · {timeAgo(item.at)}</p>
                  </div>
                  <Badge size="sm" pill tone={item.tone}>{item.text}</Badge>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Categories - full width */}
        {orderedCategories.length > 0 && (
          <Card variant="default" padding="md" className="bento-categories">
            <UsageMeter
              label="Kategori tamu"
              segments={orderedCategories.map(c => ({ id: c.category, label: c.category, value: c.total }))}
              limit={total}
              unit="tamu"
              decimals={0}
              composition
              caption={`${total} tamu · ${orderedCategories.length} kategori`}
            />
          </Card>
        )}

        {/* Wishes - compact card grid */}
        <Card variant="default" padding="md" className="bento-wishes" aria-labelledby="ucapan-title">
          <CardHeader
            title={
              <span className="wish-title">
                <MessageSquareText size={20} aria-hidden />
                <span>Ucapan</span>
              </span>
            }
            description={`${wishTotal} ucapan masuk`}
            action={unread > 0 && (
              <button type="button" onClick={markSeen} className="wish-unread" aria-label={`${unread} ucapan belum dibaca, tandai sudah dibaca`}>
                <Badge tone="info" size="sm" pill>{unread} belum dibaca</Badge>
              </button>
            )}
          />
          <div className="wish-chat">
            {error && <p role="alert" className="wish-empty" style={{ color: 'var(--red-ink)' }}>{error}</p>}
            {!error && wishes === null && <p className="wish-empty">Memuat ucapan…</p>}
            {wishes && wishes.length === 0 && <p className="wish-empty">Belum ada ucapan masuk.</p>}
            {wishes && wishes.length > 0 && (
              <ChatThread
                participants={wishParticipants}
                currentUserId="host"
                messages={wishMessages}
                composer={false}
                allowAttachments={false}
                reactions={[]}
                locale="id-ID"
                label="Ucapan tamu"
                labels={{ addReaction: 'Beri reaksi' }}
                className="wish-chat-thread"
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
