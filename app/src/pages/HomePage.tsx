import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, ChartPie, CircleArrowRight, ExternalLink, MailQuestion, Tag, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import type { BadgeTone } from '@/components/arc/badge/badge'
import { Card } from '@/components/arc/card'
import { CopyButton } from '@/components/arc/copy-button/copy-button'
import { Gauge } from '@/components/arc/gauge/gauge'
import { Countdown } from '@/components/arc/countdown/countdown'
import { ExpandableCard } from '@/components/arc/expandable-card/expandable-card'
import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import {
  DonutChart,
  DonutChartCenter,
  DonutChartLegend,
  DonutChartPlot,
} from '@/components/charts/donut-chart'
import { DigitSwap } from '@/components/motion/digit-swap'
import { PageHeader } from '@/components/PageHeader'
import type { DashboardData } from '@/lib/dashboard'
import { timeAgo } from '@/lib/notifications'
import type { GuestStatus } from '@/pages/GuestsPanel'

type Props = {
  data: DashboardData
  notify: (message: string) => void
  /** Jump to the Tamu tab with a status filter already applied. */
  onOpenGuests: (status: GuestStatus) => void
  onOpenAccount: () => void
}


const historyLabel: Record<string, string> = { checkin: 'Check-in', hadir: 'Hadir', absen: 'Absen' }
const historyTone: Record<string, BadgeTone> = { checkin: 'info', hadir: 'success', absen: 'danger' }

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

/** beUI donut: how guest RSVP replies split between attending, absent and pending. */
function RsvpComposition({ hadir, absen, pending }: { hadir: number; absen: number; pending: number }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const segments = [
    { id: 'hadir', name: 'Hadir', value: hadir, color: 'var(--rsvp-hadir)' },
    { id: 'tidak', name: 'Absen', value: absen, color: 'var(--rsvp-tidak)' },
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
  pax: number
  invitation_type: 'digital' | 'cetak'
}

export function HomePage({ data, notify, onOpenGuests, onOpenAccount }: Props) {
  const { event, stats, guests, categories } = data
  const total = stats.total_guests


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
          pax: g.max_pax,
          invitation_type: g.invitation_type === 'cetak' ? 'cetak' : 'digital',
        })
      }
      if (g._checkin_at) {
        items.push({
          id: `checkin:${g.id}`,
          kind: 'checkin',
          at: g._checkin_at,
          name: g.group_name,
          pax: g.max_pax,
          invitation_type: g.invitation_type === 'cetak' ? 'cetak' : 'digital',
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

  const previewUrl = event?.preview_token
    ? `${window.location.origin}/pratinjau/${event.slug}/${event.preview_token}`
    : ''

  const openPreview = () => {
    if (!previewUrl) return notify('Tautan pratinjau belum tersedia.')
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  const coupleName = event?.couple_name?.trim() || event?.title || 'Acara'
  const sessionText = (event?.sessions ?? [])
    .filter(s => s.time_text)
    .map(s => `${s.name} ${(s.time_text ?? '').replace(/\s*WIB\b/gi, '')}`)
    .join(' · ')
  const tierLabel = (stats.tier || 'trial').replace(/^\w/, letter => letter.toUpperCase())
  const belumRsvp = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length
  const quotaFree = Math.max(0, stats.max_quota - total)
  const isLive = Boolean(event?.slug)

  return (
    <div className="home-page">
      <PageHeader title="Beranda" account={{ name: data.client.name, onOpen: onOpenAccount }} />

      <div className="home-stack">
        {/* Hero: who the day is for, plus the two facts a host checks most. */}
        <Card variant="default" padding="md" className="home-hero">
          <div className="home-hero-top">
            <div className="home-hero-copy">
              <p className="home-hero-halo">Hari Berbahagia</p>
              <h2 className="home-hero-title">{coupleName}</h2>
            </div>
            <span className={`home-tier ${isLive ? 'is-live' : 'is-draft'}`}>
              <span className="home-tier-dot" aria-hidden />
              {isLive ? 'Live' : 'Belum live'}
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
              <div className="home-event-actions">
                <CopyButton
                  value={previewUrl}
                  label="Salin tautan"
                  onCopied={() => notify('Tautan pratinjau disalin')}
                />
                <button type="button" className="home-event-preview" onClick={openPreview}>
                  <ExternalLink size={14} strokeWidth={2} aria-hidden />
                  Preview
                </button>
              </div>
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
              onClick={() => onOpenGuests('pending')}
              ariaLabel="Lihat undangan yang belum RSVP"
            >
              <div className="home-invites-head">
                <div className="home-tile-head">
                  <h3>Pending</h3>
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

        {/* Plan quota, with the current package and an upgrade path. */}
        <Card variant="default" padding="md" className="home-quota-card" aria-labelledby="quota-card-title">
          <div className="home-quota-card-body">
            <div className="home-quota-card-copy">
              <h3 id="quota-card-title">Kuota undangan</h3>
              <p className="home-quota-card-line">
                <b>{quotaFree.toLocaleString('id-ID')}</b> tersisa
              </p>
              <p className="home-quota-card-note">
                {total.toLocaleString('id-ID')} dari {stats.max_quota.toLocaleString('id-ID')} terpakai
              </p>
              <button type="button" className="home-quota-upgrade" onClick={() => notify('Hubungi admin untuk upgrade paket.')}>
                Upgrade paket
              </button>
            </div>
            <div className="home-quota-card-side">
              <Gauge
                value={total}
                max={stats.max_quota}
                label="Kuota undangan"
                detail={`${total.toLocaleString('id-ID')} dari ${stats.max_quota.toLocaleString('id-ID')}`}
              />
              <Badge
                size="md"
                pill
                className="home-tier-badge"
                icon={<BadgeCheck size={14} strokeWidth={2} aria-hidden />}
              >
                {tierLabel}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Latest RSVP replies and check-ins. */}
        <Card variant="default" padding="md" className="home-history" aria-labelledby="history-title">
          <div className="home-card-head">
            <h3 id="history-title">Histori RSVP</h3>
            <button type="button" className="home-link home-history-more" onClick={() => onOpenGuests('semua')}>
              Lihat semua
              <CircleArrowRight size={16} strokeWidth={1.9} aria-hidden />
            </button>
          </div>
          {historyFeed.length === 0 ? (
            <p className="home-history-empty">Belum ada tamu yang RSVP atau check-in.</p>
          ) : (
            <ol className="home-history-list">
              {historyFeed.map(item => (
                <li key={item.id} className="home-history-row">
                  <span className="home-history-avatar">
                    <Avatar name={item.name} size="lg" />
                  </span>
                  <div className="home-history-copy">
                    <p className="home-history-name">{item.name}</p>
                    <div className="home-history-meta">
                      <Badge size="sm" pill tone={historyTone[item.kind]}>{historyLabel[item.kind]}</Badge>
                      <Badge size="sm" pill>{item.pax} pax</Badge>
                      <Badge size="sm" pill>{item.invitation_type === 'cetak' ? 'Cetak' : 'Digital'}</Badge>
                    </div>
                  </div>
                  <time className="home-history-time" dateTime={item.at}>{timeAgo(item.at)}</time>
                </li>
              ))}
            </ol>
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

      </div>
    </div>
  )
}
