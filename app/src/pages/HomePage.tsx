import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, ChartPie, Check, CircleArrowRight, MailQuestion, MessageSquareText, QrCode, Tag, UsersRound, X } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { Card, CardHeader } from '@/components/arc/card'
import { ChatThread } from '@/components/arc/chat-thread/chat-thread'
import { Countdown } from '@/components/arc/countdown/countdown'
import { ExpandableCard } from '@/components/arc/expandable-card/expandable-card'
import { ScrollArea } from '@/components/arc/scroll-area/scroll-area'
import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import { NotificationCenter } from '@/components/arc/notification-center/notification-center'
import type { NotificationItem } from '@/components/arc/notification-center/notification-center'
import {
  DonutChart,
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

/** beUI donut: how guest RSVP replies split between attending, absent and pending. */
function RsvpComposition({ hadir, absen, pending }: { hadir: number; absen: number; pending: number }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const segments = [
    { id: 'hadir', name: 'Hadir', value: hadir, color: 'var(--rsvp-hadir)' },
    { id: 'tidak', name: 'Tidak hadir', value: absen, color: 'var(--rsvp-tidak)' },
    { id: 'pending', name: 'Pending', value: pending, color: 'var(--rsvp-pending)' },
  ]

  // Tapping anywhere outside the legend clears the pinned segment.
  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (event: PointerEvent) => {
      const legend = wrap.current?.querySelector('.home-total-legend')
      if (!legend || !legend.contains(event.target as Node)) setPinned(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [pinned])

  return (
    <div ref={wrap} className={`home-total-chart${pinned ? ' is-pinned' : ''}`} data-beui>
      <DonutChart
        segments={segments}
        label="Status RSVP tamu"
        labels={{ label: 'Status RSVP tamu', total: 'RSVP' }}
        thickness={18}
        gap={2}
        activeId={hovered ?? pinned}
        onActiveChange={setHovered}
        onSelect={id => setPinned(current => (current === id ? null : id))}
        selectedId={pinned}
      >
        <DonutChartPlot className="home-total-plot">
          <DonutChartCenter className="home-total-center" totalLabel="RSVP">
            {(segment, total) => (
              <>
                <span className="home-total-value">{(segment?.value ?? total).toLocaleString('id-ID')}</span>
                <span className="home-total-caption">{segment ? segment.name : 'RSVP'}</span>
              </>
            )}
          </DonutChartCenter>
        </DonutChartPlot>
        <DonutChartLegend
          className="home-total-legend"
          renderValue={segment => (
            <>
              <span className="home-legend-pct">
                {(segment.share * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%
              </span>
              <span className="home-legend-total">{segment.value.toLocaleString('id-ID')}</span>
            </>
          )}
        />
      </DonutChart>
    </div>
  )
}

type HistoryItem = {
  id: string
  kind: 'checkin' | 'hadir' | 'absen'
  at: string
  name: string
  detail: string
}

export function HomePage({ data, notify, onOpenGuests }: Props) {
  const { event, stats, guests, categories } = data
  const total = stats.total_guests
  const eventId = event!.id

  const [seen, setSeen] = useState<string | null>(event?.wishes_seen_at ?? null)
  const [wishes, setWishes] = useState<Wish[] | null>(null)
  const [wishTotal, setWishTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [notifSeen, setNotifSeen] = useState(() => Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0))
  const wishScroll = useRef<HTMLDivElement>(null)

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

  // The thread reads newest-last, so park the scroll area at the latest wish.
  useEffect(() => {
    const node = wishScroll.current
    if (!node) return
    node.scrollTop = node.scrollHeight
    node.dispatchEvent(new Event('scroll'))
  }, [wishes])

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

  /** Every RSVP reply and check-in, newest first, for the history list. */
  const history = useMemo(() => {
    const items: HistoryItem[] = []
    for (const g of guests) {
      if (g._rsvp_at && (g.rsvp_status === 'hadir' || g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen')) {
        const attending = g.rsvp_status === 'hadir'
        items.push({
          id: `rsvp:${g.id}`,
          kind: attending ? 'hadir' : 'absen',
          at: g._rsvp_at,
          name: g.group_name,
          detail: `${attending ? 'Konfirmasi hadir' : 'Tidak bisa hadir'} · ${g.max_pax} pax`,
        })
      }
      if (g._checkin_at) {
        items.push({
          id: `checkin:${g.id}`,
          kind: 'checkin',
          at: g._checkin_at,
          name: g.group_name,
          detail: `Check-in di pintu · ${g.max_pax} pax`,
        })
      }
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [guests])

  const historyFeed = useMemo(() => history.slice(0, 10), [history])

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => b.total - a.total),
    [categories],
  )

  const coupleName = event?.couple_name?.trim() || event?.title || 'Acara'
  const sessionText = (event?.sessions ?? [])
    .filter(s => s.time_text)
    .map(s => `${s.name} ${(s.time_text ?? '').replace(/\s*WIB\b/gi, '')}`)
    .join(' · ')
  const tierLabel = (stats.tier || 'trial').replace(/^\w/, letter => letter.toUpperCase())
  const belumRsvp = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length

  return (
    <div className="home-page">
      <div className="page-head home-head">
        <h1 className="page-title home-title">Beranda</h1>
        <div className="page-head-actions">
          <NotificationCenter
            notifications={notifications}
            label="Notifikasi"
            onOpenChange={onNotificationsOpen}
          />
        </div>
      </div>

      <div className="home-stack">
        {/* Hero: who the day is for, plus the two facts a host checks most. */}
        <Card variant="default" padding="md" className="home-hero">
          <div className="home-hero-top">
            <div className="home-hero-copy">
              <p className="home-hero-halo">Halo</p>
              <h2 className="home-hero-title">{coupleName}</h2>
            </div>
            <span className="home-tier">
              <BadgeCheck size={14} strokeWidth={2} aria-hidden />
              {tierLabel}
            </span>
          </div>
          <div className="home-event-info">
            <ExpandableCard
              className="home-event-card"
              title="Tanggal"
              description={formatDate(event?.event_date ?? null)}
            >
              <dl className="home-event-details">
                {sessionText && (
                  <div>
                    <dt>Waktu</dt>
                    <dd>{sessionText}</dd>
                  </div>
                )}
                <div>
                  <dt>Lokasi</dt>
                  <dd>{event?.location || '-'}</dd>
                </div>
              </dl>
            </ExpandableCard>
          </div>

          <div className="home-hero-countdown">
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

        {/* RSVP split and the invitation quota at a glance. */}
        <div className="home-stats">
          <Card variant="default" padding="md" className="home-total" aria-labelledby="rsvp-title">
            <div className="home-tile-head">
              <h3 id="rsvp-title">Status RSVP</h3>
              <ChartPie size={18} strokeWidth={1.75} aria-hidden />
            </div>
            <RsvpComposition hadir={stats.hadir} absen={stats.absen} pending={stats.pending} />
          </Card>

          <div className="home-stats-side">
            <Card variant="default" padding="md" className="home-invites" aria-labelledby="invites-title">
              <div className="home-invites-head">
                <div className="home-tile-head">
                  <h3 id="invites-title">Tamu</h3>
                  <UsersRound size={20} strokeWidth={1.75} aria-hidden />
                </div>
                <div className="home-invites-body">
                  <div className="home-invites-number">
                    <DigitSwap value={stats.hadir_pax} className="home-invites-total" />
                    <span className="home-invites-chip">Pax</span>
                  </div>
                  <p className="home-invites-caption">dari RSVP Hadir</p>
                </div>
              </div>
            </Card>

            <Card
              variant="default"
              padding="md"
              className="home-rsvp-empty"
              onClick={() => onOpenGuests('belum_rsvp')}
              ariaLabel="Lihat undangan yang belum RSVP"
            >
              <div className="home-invites-head">
                <div className="home-tile-head">
                  <h3>Belum RSVP</h3>
                  <MailQuestion size={20} strokeWidth={1.75} aria-hidden />
                </div>
                <div className="home-invites-body">
                  <div className="home-invites-number">
                    <DigitSwap value={belumRsvp} className="home-invites-total" />
                  </div>
                  <p className="home-invites-caption">Undangan</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Latest RSVP replies and check-ins. */}
        <Card variant="default" padding="md" className="home-history" aria-labelledby="history-title">
          <div className="home-card-head">
            <h3 id="history-title">Histori RSVP</h3>
            <button type="button" className="home-link" onClick={() => onOpenGuests('semua')}>
              Lihat semua
              <CircleArrowRight size={16} strokeWidth={1.9} aria-hidden />
            </button>
          </div>
          {historyFeed.length === 0 ? (
            <p className="home-history-empty">Belum ada tamu yang RSVP atau check-in.</p>
          ) : (
            <ScrollArea className="home-history-scroll" maxHeight={340} label="Histori RSVP">
              <ol className="home-history-list">
                {historyFeed.map(item => (
                  <li key={item.id} className="home-history-row">
                    <span className="home-history-avatar">
                      <Avatar name={item.name} size="lg" />
                      <span className={`home-history-badge is-${item.kind}`} aria-hidden>
                        {item.kind === 'checkin' ? <QrCode size={9} strokeWidth={2.4} /> : item.kind === 'hadir' ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                      </span>
                    </span>
                    <div className="home-history-copy">
                      <p className="home-history-name">{item.name}</p>
                      <p className="home-history-detail">{item.detail}</p>
                    </div>
                    <span className="home-history-time">{timeAgo(item.at)}</span>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          )}
        </Card>

        {/* Guest categories, sized against the whole guest list. */}
        {orderedCategories.length > 0 && (
          <Card variant="default" padding="md" className="home-categories">
            <UsageMeter
              label="Kategori tamu"
              segments={orderedCategories.map(c => ({ id: c.category, label: c.category, value: c.total }))}
              limit={total}
              unit="tamu"
              decimals={0}
              composition
              caption={`tamu · ${orderedCategories.length} kategori`}
              action={<Tag size={18} strokeWidth={1.75} aria-hidden />}
            />
          </Card>
        )}

        {/* Ucapan - a read-only chat thread so guest messages read as one conversation. */}
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
              <ScrollArea
                className="wish-scroll"
                maxHeight={340}
                viewportRef={wishScroll}
                label="Ucapan tamu"
              >
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
              </ScrollArea>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
