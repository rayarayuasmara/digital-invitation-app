import { Check, Link2, MessageCircle, Printer, Smartphone } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import type { Guest } from '@/lib/guests'
import { statusOf } from './guest-helpers'

type Props = {
  guest: Guest
  variant?: 'grid' | 'compact'
  onClick?: () => void
  onCopyLink?: () => void
  onSendWhatsApp?: () => void
}

export function GuestCard({ guest, variant = 'grid', onClick, onCopyLink, onSendWhatsApp }: Props) {
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
    <div className="guest-card">
      <button
        type="button"
        className="guest-card-main"
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

      {(onCopyLink || onSendWhatsApp) && (
        <div className="guest-card-actions">
          {onCopyLink && (
            <button
              type="button"
              className="guest-card-action"
              aria-label={`Salin tautan undangan ${guest.group_name}`}
              onClick={onCopyLink}
            >
              <Link2 size={14} strokeWidth={1.9} aria-hidden />
              Salin tautan
            </button>
          )}
          {onSendWhatsApp && (
            <button
              type="button"
              className="guest-card-action is-wa"
              // Filled once the invitation has been sent; clearing "Undangan terkirim" resets it.
              data-sent={guest.is_sent || undefined}
              aria-pressed={guest.is_sent}
              aria-label={guest.is_sent
                ? `Kirim ulang WhatsApp ke ${guest.group_name}`
                : `Kirim WhatsApp ke ${guest.group_name}`}
              onClick={onSendWhatsApp}
            >
              {guest.is_sent ? <Check size={14} strokeWidth={2.2} aria-hidden /> : <MessageCircle size={14} strokeWidth={1.9} aria-hidden />}
              Kirim WA
            </button>
          )}
        </div>
      )}
    </div>
  )
}
