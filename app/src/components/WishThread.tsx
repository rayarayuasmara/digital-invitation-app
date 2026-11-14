import { Fragment, useEffect, useRef } from 'react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import type { BadgeTone } from '@/components/arc/badge/badge'
import type { Guest } from '@/lib/guests'
import type { Wish } from '@/lib/wishes'

type Props = {
  /** Oldest first. */
  wishes: Wish[]
  guests: Guest[]
  hostName: string
  seenAt: string | null
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })

function dayLabel(iso: string) {
  const day = dayKey(iso)
  const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
  const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })
  if (day === today) return 'Hari ini'
  if (day === yesterday) return 'Kemarin'
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

function statusOf(guest: Guest | undefined): { text: string; tone: BadgeTone } | null {
  if (!guest) return null
  if (guest.is_checked_in) return { text: 'Check-in', tone: 'info' }
  if (guest.rsvp_status === 'hadir') return { text: 'Hadir', tone: 'success' }
  if (guest.rsvp_status === 'tidak_hadir' || guest.rsvp_status === 'absen') return { text: 'Tidak hadir', tone: 'danger' }
  if (!guest.is_sent) return { text: 'Belum terkirim', tone: 'neutral' }
  return { text: 'Pending', tone: 'warning' }
}

/** Read-only transcript of guest wishes, styled like a chat thread. */
export function WishThread({ wishes, guests, hostName, seenAt }: Props) {
  const seen = seenAt ? new Date(seenAt).getTime() : 0
  const byId = new Map(guests.map(g => [g.id, g]))
  const byName = new Map(guests.map(g => [g.group_name.trim().toLowerCase(), g]))
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [wishes.length])

  if (wishes.length === 0) return null

  return (
    <div className="thread-frame">
      <div
        ref={listRef}
        className="thread"
        role="log"
        aria-label={`Ucapan tamu untuk ${hostName}`}
        tabIndex={0}
      >
        {wishes.map((w, i) => {
          const previous = wishes[i - 1]
          const next = wishes[i + 1]
          const guest = (w.guest_id ? byId.get(w.guest_id) : undefined) ?? byName.get((w.guest_name ?? '').trim().toLowerCase())
          const status = statusOf(guest)
          const isNew = new Date(w.created_at).getTime() > seen
          const newDay = !previous || dayKey(previous.created_at) !== dayKey(w.created_at)
          const sameAuthor = !!previous && !newDay && (previous.guest_id ?? previous.guest_name) === (w.guest_id ?? w.guest_name)
          const firstInGroup = !sameAuthor
          const lastInGroup = !next || dayKey(next.created_at) !== dayKey(w.created_at) || (next.guest_id ?? next.guest_name) !== (w.guest_id ?? w.guest_name)

          return (
            <Fragment key={w.id}>
              {newDay && (
                <div className="thread-day">
                  <span>{dayLabel(w.created_at)}</span>
                </div>
              )}
              <div
                className={[
                  'thread-row',
                  firstInGroup ? 'thread-row-first' : 'thread-row-cont',
                  lastInGroup ? 'thread-row-last' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="thread-gutter" aria-hidden={!firstInGroup}>
                  {firstInGroup ? <Avatar name={w.guest_name || 'Tamu'} size="sm" /> : null}
                </span>
                <div className="thread-stack">
                  {firstInGroup && (
                    <div className="thread-meta">
                      <span className="thread-author">{w.guest_name || 'Tamu'}</span>
                      <time className="thread-time" dateTime={w.created_at}>{clock(w.created_at)}</time>
                    </div>
                  )}
                  <div className="thread-bubble">
                    <p>{w.message}</p>
                    <div className="thread-foot">
                      {isNew && <Badge size="sm" tone="info" pill>Baru</Badge>}
                      {status && <Badge size="sm" tone={status.tone} pill>{status.text}</Badge>}
                      {!firstInGroup && <time className="thread-time-inline" dateTime={w.created_at}>{clock(w.created_at)}</time>}
                    </div>
                  </div>
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
