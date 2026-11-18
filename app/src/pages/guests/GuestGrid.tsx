import { Trash2 } from 'lucide-react'
import { SwipeActions, SwipeActionsRow } from '@/components/arc/swipe-actions/swipe-actions'
import type { SwipeAction } from '@/components/arc/swipe-actions/swipe-actions'
import type { Guest } from '@/lib/guests'
import { GuestCard } from './GuestCard'

type Props = {
  guests: Guest[]
  onOpen: (guest: Guest) => void
  onCopyLink: (guest: Guest) => void
  onSendWhatsApp: (guest: Guest) => void
  onDelete: (guest: Guest) => void
}

/**
 * The guest cards in the Tamu list. Copy link and WhatsApp sit on the card, so a
 * swipe is left for the two actions that should never be one tap away.
 */
export function GuestGrid({ guests, onOpen, onCopyLink, onSendWhatsApp, onDelete }: Props) {
  const deleteAction = (guest: Guest): SwipeAction[] => [
    { label: 'Hapus', icon: <Trash2 size={18} aria-hidden />, tone: 'danger', onSelect: () => onDelete(guest) },
  ]

  return (
    <div className="guests-grid">
      <SwipeActions label="Daftar tamu" className="guests-surface">
        {guests.map(g => (
          <SwipeActionsRow key={g.id} label={g.group_name} trailing={deleteAction(g)} showMenu={false}>
            <GuestCard
              guest={g}
              variant="grid"
              onClick={() => onOpen(g)}
              onCopyLink={() => onCopyLink(g)}
              onSendWhatsApp={g.invitation_type === 'cetak' ? undefined : () => onSendWhatsApp(g)}
            />
          </SwipeActionsRow>
        ))}
      </SwipeActions>
    </div>
  )
}
