import { useEffect, useRef } from 'react'
import { Avatar } from '@/components/arc/avatar/avatar'
import type { Wish } from '@/lib/wishes'

type Props = {
  /** Oldest first. */
  wishes: Wish[]
}

const GROUP_GAP_MS = 10 * 60 * 1000

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

/** Read-only thread: guests' wishes arrive as incoming messages, so there is no composer or reply. */
export function WishThread({ wishes }: Props) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [wishes.length])

  let lastDay = ''
  let lastName = ''
  let lastAt = 0

  return (
    <div ref={scroller} className="thread" role="log" aria-label="Ucapan tamu" tabIndex={0}>
      {wishes.map(w => {
        const name = w.guest_name || 'Tamu'
        const at = new Date(w.created_at).getTime()
        const day = dayLabel(w.created_at)
        const showDay = day !== lastDay
        const continued = !showDay && name === lastName && at - lastAt < GROUP_GAP_MS
        lastDay = day
        lastName = name
        lastAt = at

        return (
          <div key={w.id}>
            {showDay && <p className="thread-day">{day}</p>}
            <div className={`thread-row ${continued ? 'thread-cont' : ''}`}>
              <span className="thread-avatar" aria-hidden>
                {!continued && <Avatar name={name} size="sm" />}
              </span>
              <div className="thread-body">
                {!continued && <p className="thread-name">{name}</p>}
                <div className="thread-bubble">
                  <p>{w.message}</p>
                  <time dateTime={w.created_at}>{timeLabel(w.created_at)}</time>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
