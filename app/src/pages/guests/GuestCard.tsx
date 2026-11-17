import { Printer, Smartphone } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import type { Guest } from '@/lib/guests'
import { statusOf } from './guest-helpers'

type Props = {
  guest: Guest
  variant?: 'grid' | 'compact'
  onClick?: () => void
}

export function GuestCard({ guest, variant = 'grid', onClick }: Props) {
  const { text: statusText, tone: statusTone } = statusOf(guest)

  if (variant === 'compact') {
    return (
      <button
        type="button"
        className="guest-card-compact"
        onClick={onClick}
      >
        <Avatar name={guest.group_name} size="sm" />
        <div className="guest-card-compact-content">
          <p className="guest-card-compact-name">{guest.group_name}</p>
          <div className="guest-card-compact-badges">
            <Badge size="sm" pill>{guest.category || 'Umum'}</Badge>
            <Badge size="sm" pill tone={statusTone}>{statusText}</Badge>
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      className="guest-card"
      onClick={onClick}
    >
      <div className={`guest-avatar ${guest.invitation_type === 'cetak' ? 'is-print' : 'is-digital'}`}>
        <Avatar name={guest.group_name} size="lg" />
        <span
          className="guest-avatar-badge"
          role="img"
          aria-label={guest.invitation_type === 'cetak' ? 'Undangan cetak' : 'Undangan digital'}
        >
          {guest.invitation_type === 'cetak'
            ? <Printer size={10} aria-hidden />
            : <Smartphone size={10} aria-hidden />}
        </span>
      </div>
      <div className="guest-card-content">
        <p className="guest-card-name">{guest.group_name}</p>
        <div className="guest-card-badges">
          <Badge size="sm" pill>{guest.category || 'Umum'}</Badge>
          <Badge size="sm" pill tone={statusTone}>{statusText}</Badge>
          <Badge size="sm" pill>{guest.max_pax} pax</Badge>
        </div>
      </div>
    </button>
  )
}
