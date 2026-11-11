import { ChatThread } from '@/components/arc/chat-thread/chat-thread'
import type { ChatMessage, ChatParticipant, ChatReaction } from '@/components/arc/chat-thread/chat-thread'
import type { Guest } from '@/lib/guests'
import type { Wish } from '@/lib/wishes'

const HOST_ID = 'host'

type Props = {
  /** Oldest first. */
  wishes: Wish[]
  guests: Guest[]
  hostName: string
  seenAt: string | null
}

function statusReaction(guest: Guest | undefined): ChatReaction | null {
  if (!guest) return null
  if (guest.is_checked_in) return { emoji: 'Check-in', count: 1, mine: false }
  if (guest.rsvp_status === 'hadir') return { emoji: 'Hadir', count: 1, mine: false }
  if (guest.rsvp_status === 'tidak_hadir' || guest.rsvp_status === 'absen') return { emoji: 'Tidak hadir', count: 1, mine: false }
  if (!guest.is_sent) return { emoji: 'Belum terkirim', count: 1, mine: false }
  return { emoji: 'Pending', count: 1, mine: false }
}

/** Read-only transcript of guest wishes. The host cannot reply: the composer is off. */
export function WishThread({ wishes, guests, hostName, seenAt }: Props) {
  const seen = seenAt ? new Date(seenAt).getTime() : 0
  const byId = new Map(guests.map(g => [g.id, g]))

  const participants: ChatParticipant[] = [{ id: HOST_ID, name: hostName }]
  const seenAuthors = new Set<string>()
  for (const w of wishes) {
    const id = w.guest_id ?? `name:${w.guest_name ?? 'Tamu'}`
    if (seenAuthors.has(id)) continue
    seenAuthors.add(id)
    participants.push({ id, name: w.guest_name || 'Tamu' })
  }

  const messages: ChatMessage[] = wishes.map(w => {
    const authorId = w.guest_id ?? `name:${w.guest_name ?? 'Tamu'}`
    const unread = new Date(w.created_at).getTime() > seen
    const reactions: ChatReaction[] = []
    if (unread) reactions.push({ emoji: 'Baru', count: 1, mine: false })
    const status = statusReaction(w.guest_id ? byId.get(w.guest_id) : undefined)
    if (status) reactions.push(status)
    return { id: w.id, authorId, text: w.message, createdAt: w.created_at, reactions }
  })

  return (
    <div className="thread-frame">
      <ChatThread
        participants={participants}
        currentUserId={HOST_ID}
        messages={messages}
        composer={false}
        allowAttachments={false}
        locale="id-ID"
        label="Ucapan tamu"
      />
    </div>
  )
}
