import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCheck, RefreshCw } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { Button } from '@/components/arc/button/button'
import { ChatBubbleIcon } from '@/components/ChatBubbleIcon'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import type { DashboardData } from '@/lib/dashboard'
import { initialsName } from '@/lib/text'
import { fetchWishes, fetchWishesPage, markWishesSeen } from '@/lib/wishes'
import type { Wish } from '@/lib/wishes'

const WISH_LIMIT = 100

/** Only the clock time, in the event's time zone — the day already has its own heading. */
const timeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Jakarta',
  })

type Props = {
  data: DashboardData
  notify: (message: string) => void
  onOpenAccount: () => void
  /** Reloads the dashboard so the event's seen timestamp stays fresh. */
  onChanged: () => Promise<void>
  /** Called after the host marks everything read, so the tab badge clears. */
  onSeen: () => void
  filter: Filter
  onFilterChange: (filter: Filter) => void
}

type Filter = 'semua' | 'baru'

/** Guests are grouped by the Jakarta calendar day, which is the day the host experienced. */
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

function dayLabel(iso: string) {
  const today = dayKey(new Date().toISOString())
  const key = dayKey(iso)
  if (key === today) return 'Hari ini'
  if (key === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return 'Kemarin'
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Jakarta',
  })
}

export function WishesPage({ data, notify, onOpenAccount, onChanged, onSeen, filter, onFilterChange }: Props) {
  const event = data.event!
  const [wishes, setWishes] = useState<Wish[] | null>(null)
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [seenAt, setSeenAt] = useState<string | null>(event.wishes_seen_at ?? null)
  const [error, setError] = useState('')
  const [marking, setMarking] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const summary = await fetchWishes(event.id, seenAt, WISH_LIMIT)
      setWishes(summary.wishes)
      setTotal(summary.total)
      setUnread(summary.unread)
      setOffset(summary.wishes.length)
      setHasMore(summary.wishes.length < summary.total)
      setMoreError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ucapan belum bisa dimuat.')
    }
  }, [event.id, seenAt])

  const loadMore = async () => {
    if (loadingMore || !hasMore || marking) return
    setLoadingMore(true)
    setMoreError('')
    try {
      const next = await fetchWishesPage(event.id, WISH_LIMIT, offset)
      setOffset(offset + next.length)
      setHasMore(next.length === WISH_LIMIT && offset + next.length < total)
      setWishes(current => {
        const seen = new Set(current?.map(wish => wish.id))
        return [...(current ?? []), ...next.filter(wish => !seen.has(wish.id))]
      })
    } catch {
      setMoreError('Ucapan sebelumnya belum bisa dimuat. Coba lagi.')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    load()
  }, [load])

  const seenTime = seenAt ? new Date(seenAt).getTime() : 0
  const isUnread = (w: Wish) => new Date(w.created_at).getTime() > seenTime

  const visible = useMemo(
    () => (wishes ?? []).filter(w => (filter === 'baru' ? isUnread(w) : true)),
    // seenTime changes when the host marks everything read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wishes, filter, seenTime],
  )

  const groups = useMemo(() => {
    const result: { key: string; label: string; items: Wish[] }[] = []
    for (const wish of visible) {
      const key = dayKey(wish.created_at)
      const last = result[result.length - 1]
      if (last?.key === key) last.items.push(wish)
      else result.push({ key, label: dayLabel(wish.created_at), items: [wish] })
    }
    return result
  }, [visible])

  const markSeen = async () => {
    setMarking(true)
    try {
      const now = new Date().toISOString()
      await markWishesSeen(event.id)
      setSeenAt(now)
      setUnread(0)
      onFilterChange('semua')
      onSeen()
      await onChanged()
      notify('Semua ucapan ditandai sudah dibaca')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal menandai ucapan.')
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="wishes-page">
      <PageHeader
        title="Ucapan"
        subtitle={
          <p className="page-sub">
            {wishes === null
              ? 'Memuat ucapan…'
              : total === 0
                ? 'Belum ada ucapan masuk'
                : `${total} ucapan${unread > 0 ? ` · ${unread} belum dibaca` : ' · semua sudah dibaca'}`}
          </p>
        }
        account={{ name: data.client.name, onOpen: onOpenAccount }}
      />

      <div className="wishes-toolbar">
        <div className="status-tabs wishes-filter" data-beui>
          <Tabs value={filter} onValueChange={value => onFilterChange(value === 'baru' ? 'baru' : 'semua')} variant="segment"
            labels={{ scrollLeft: 'Gulir filter ke kiri', scrollRight: 'Gulir filter ke kanan' }}>
            <TabsList aria-label="Saring ucapan" className="rounded-full" wrapperClassName="rounded-full">
              <TabsTrigger value="semua" className="min-h-10 rounded-full text-interface-label" indicatorClassName="rounded-full">
                Semua <Badge size="sm" pill>{total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="baru" className="min-h-10 rounded-full text-interface-label" indicatorClassName="rounded-full">
                Belum dibaca{unread > 0 && <> <Badge size="sm" pill>{unread}</Badge></>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {unread > 0 && (
          <Button variant="accentOutline" size="sm" onClick={markSeen} disabled={loadingMore} loading={marking}>
            <CheckCheck size={16} strokeWidth={2.2} aria-hidden />
            {marking ? 'Menandai…' : 'Tandai dibaca'}
          </Button>
        )}
      </div>

      {error && (
        <div className="wishes-empty">
          <p role="alert" className="wishes-empty-copy">{error}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={15} strokeWidth={2.2} aria-hidden />
            Coba lagi
          </Button>
        </div>
      )}

      {!error && wishes === null && (
        <div className="wishes-loading" aria-live="polite">
          {[0, 1, 2].map(i => (
            <div key={i} className="wishes-skeleton" aria-hidden>
              <span className="wishes-skeleton-avatar" />
              <span className="wishes-skeleton-lines">
                <span />
                <span />
              </span>
            </div>
          ))}
          <span className="sr-only">Memuat ucapan…</span>
        </div>
      )}

      {!error && wishes !== null && visible.length === 0 && (
        <div className="wishes-empty">
          <span className="wishes-empty-icon" aria-hidden>
            <ChatBubbleIcon size={26} strokeWidth={1.8} />
          </span>
          <p className="wishes-empty-title">
            {filter === 'baru' ? 'Tidak ada ucapan baru' : 'Belum ada ucapan'}
          </p>
          <p className="wishes-empty-copy">
            {filter === 'baru'
              ? 'Semua ucapan sudah Anda baca.'
              : 'Ucapan dari tamu akan muncul di sini setelah mereka mengisi undangan.'}
          </p>
        </div>
      )}

      {groups.map(group => (
        <section key={group.key} className="wishes-day">
          <h2 className="wishes-day-label">{group.label}</h2>
          <div className="wishes-list">
            {group.items.map(wish => {
              const name = wish.guest_name?.trim() || 'Tamu'
              const fresh = isUnread(wish)
              return (
                 <article key={wish.id} className="wish-item">
                  <Avatar name={initialsName(name)} size="lg" className="wish-item-avatar" />
                  <div className="wish-item-body">
                    <div className="wish-item-meta">
                      <span className="wish-item-name">{name}</span>
                      <time className="wish-item-time" dateTime={wish.created_at}>{timeOfDay(wish.created_at)}</time>
                      {fresh && (
                        <>
                          <span className="wish-item-dot" aria-hidden />
                          <span className="sr-only">Belum dibaca</span>
                        </>
                      )}
                    </div>
                    <p className="wish-item-message">{wish.message}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {!error && wishes !== null && hasMore && (filter === 'semua' || visible.length < unread) && (
        <div className="wishes-more">
          <p role="status">Menampilkan {visible.length} dari {filter === 'baru' ? unread : total} ucapan{filter === 'baru' ? ' belum dibaca' : ''}.</p>
          {moreError && <p role="alert">{moreError}</p>}
          <Button type="button" variant="secondary" size="md" loading={loadingMore} disabled={marking} onClick={loadMore}>
            Muat ucapan sebelumnya
          </Button>
        </div>
      )}
    </div>
  )
}
