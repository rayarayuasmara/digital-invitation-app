import { useEffect, useMemo, useState } from 'react'
import { Bell, CircleCheck, MessageCircle, TriangleAlert } from 'lucide-react'
import type { DashboardData } from '@/lib/dashboard'
import type { Guest } from '@/lib/guests'
import { buildNotifications } from '@/lib/notifications'
import type { AppNotification } from '@/lib/notifications'
import { fetchWishes } from '@/lib/wishes'
import type { Wish } from '@/lib/wishes'
import { Sheet } from '@/components/Sheet'

const NOTIF_SEEN_KEY = 'rr_notif_seen'
const WISH_LIMIT = 50

const toneIcon = {
  info: MessageCircle,
  success: CircleCheck,
  warning: TriangleAlert,
} as const

type Props = {
  open: boolean
  data: DashboardData
  onClose: () => void
}

export function NotificationsSheet({ open, data, onClose }: Props) {
  const eventId = data.event!.id
  const wishesSeen = data.event!.wishes_seen_at ?? null
  const guests = data.guests as Guest[]
  const [wishes, setWishes] = useState<Wish[]>([])
  const [error, setError] = useState('')
  const [localSeen, setLocalSeen] = useState(() => Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0))

  useEffect(() => {
    if (!open) return
    const now = Date.now()
    const previous = Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0)
    fetchWishes(eventId, wishesSeen, WISH_LIMIT)
      .then(summary => { setWishes(summary.wishes); setError('') })
      .catch(e => setError(e instanceof Error ? e.message : 'Notifikasi belum bisa dimuat.'))
    // Items read on this open stay styled as read until the sheet closes again.
    setLocalSeen(previous)
    localStorage.setItem(NOTIF_SEEN_KEY, String(now))
  }, [open, eventId, wishesSeen])

  const items: AppNotification[] = useMemo(
    () => buildNotifications(wishes, guests, wishesSeen, localSeen),
    [wishes, guests, wishesSeen, localSeen],
  )

  return (
    <Sheet open={open} title="Notifikasi" onClose={onClose}>
      <div className="sheet-body notif-list">
        {error && <p role="alert" className="form-error">{error}</p>}
        {!error && items.length === 0 && (
          <p className="notif-empty">
            <Bell size={20} aria-hidden /> Belum ada notifikasi.
          </p>
        )}
        {items.map(item => {
          const Icon = toneIcon[item.tone]
          return (
            <div key={item.id} className={`notif-row${item.read ? '' : ' is-unread'}`}>
              <span className={`notif-icon is-${item.tone}`} aria-hidden>
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <div className="notif-copy">
                <p className="notif-title">{item.title}</p>
                <p className="notif-desc">{item.description}</p>
              </div>
              <span className="notif-time">{item.time}</span>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
