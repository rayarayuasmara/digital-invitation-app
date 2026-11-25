import type { Guest } from '@/lib/guests'
import type { Wish } from '@/lib/wishes'

export type AppNotification = {
  id: string
  title: string
  description: string
  time: string
  at: number
  read: boolean
  tone: 'info' | 'success' | 'warning'
}

export function timeAgo(iso: string) {
  const min = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'Baru saja'
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}

/** New wishes, RSVP replies and check-ins, newest first. Wishes read against the server's seen time, the rest against the local one. */
export function buildNotifications(wishes: Wish[], guests: Guest[], wishesSeen: string | null, localSeen: number): AppNotification[] {
  const seenWish = wishesSeen ? new Date(wishesSeen).getTime() : 0
  const items: AppNotification[] = []

  for (const w of wishes) {
    const at = new Date(w.created_at).getTime()
    items.push({
      id: `wish:${w.id}`,
      title: `Ucapan baru dari ${w.guest_name || 'Tamu'}`,
      description: w.message.length > 80 ? `${w.message.slice(0, 80)}…` : w.message,
      time: timeAgo(w.created_at),
      at,
      read: at <= seenWish,
      tone: 'info',
    })
  }

  for (const g of guests) {
    if (g._rsvp_at && (g.rsvp_status === 'hadir' || g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen')) {
      const at = new Date(g._rsvp_at).getTime()
      const attending = g.rsvp_status === 'hadir'
      items.push({
        id: `rsvp:${g.id}`,
        title: `${g.group_name} ${attending ? 'akan hadir' : 'tidak bisa hadir'}`,
        description: `Konfirmasi RSVP · ${g.max_pax} orang`,
        time: timeAgo(g._rsvp_at),
        at,
        read: at <= localSeen,
        tone: attending ? 'success' : 'warning',
      })
    }
    if (g._checkin_at) {
      const at = new Date(g._checkin_at).getTime()
      items.push({
        id: `checkin:${g.id}`,
        title: `${g.group_name} sudah check-in`,
        description: `${g.max_pax} orang masuk`,
        time: timeAgo(g._checkin_at),
        at,
        read: at <= localSeen,
        tone: 'success',
      })
    }
  }

  return items.sort((a, b) => b.at - a.at).slice(0, 40)
}
