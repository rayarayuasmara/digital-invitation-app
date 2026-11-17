import { SwipeActions, SwipeActionsRow } from '@/components/arc/swipe-actions/swipe-actions'
import type { SwipeAction } from '@/components/arc/swipe-actions/swipe-actions'
import type { Guest } from '@/lib/guests'
import { GuestCard } from './GuestCard'

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
          const actions = actionsFor(g)
          return (
            <SwipeActionsRow key={g.id} label={g.group_name} leading={actions.slice(0, 2)} trailing={actions.slice(2)}>
              <GuestCard guest={g} variant="grid" onClick={() => onOpen(g)} />
            </SwipeActionsRow>
          )
        })}
      </SwipeActions>
    </div>
  )
}
