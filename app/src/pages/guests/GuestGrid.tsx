import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { SwipeActions, SwipeActionsRow } from '@/components/arc/swipe-actions/swipe-actions'
import type { SwipeAction } from '@/components/arc/swipe-actions/swipe-actions'
import { Printer, Smartphone } from 'lucide-react'
import type { Guest } from '@/lib/guests'
import { statusOf } from './guest-helpers'

type Props = {
  guests: Guest[]
  /** Swipe and row-menu actions for a guest, built by the panel. */
  actionsFor: (guest: Guest) => SwipeAction[]
  onOpen: (guest: Guest) => void
}

/** The guest cards in the Tamu list. */
export function GuestGrid({ guests, actionsFor, onOpen }: Props) {
  return (
    <div className="guests-grid">
      <SwipeActions label="Daftar tamu">
        {guests.map(g => {
          const { text: statusText, tone: statusTone } = statusOf(g)
          const actions = actionsFor(g)
          return (
            <SwipeActionsRow key={g.id} label={g.group_name} leading={actions.slice(0, 2)} trailing={actions.slice(2)}>
              <button
                type="button"
                className="guest-card"
                onClick={() => onOpen(g)}
              >
                <div className={`guest-avatar ${g.invitation_type === 'cetak' ? 'is-print' : 'is-digital'}`}>
                  <Avatar name={g.group_name} size="lg" />
                  <span
                    className="guest-avatar-badge"
                    role="img"
                    aria-label={g.invitation_type === 'cetak' ? 'Undangan cetak' : 'Undangan digital'}
                  >
                    {g.invitation_type === 'cetak'
                      ? <Printer size={10} aria-hidden />
                      : <Smartphone size={10} aria-hidden />}
                  </span>
                </div>
                <div className="guest-card-content">
                  <p className="guest-card-name">{g.group_name}</p>
                  <div className="guest-card-badges">
                    <Badge size="sm" pill>{g.category || 'Umum'}</Badge>
                    <Badge size="sm" pill tone={statusTone}>{statusText}</Badge>
                    <Badge size="sm" pill>{g.max_pax} pax</Badge>
                  </div>
                </div>
              </button>
            </SwipeActionsRow>
          )
        })}
      </SwipeActions>
    </div>
  )
}
