import { Printer, Smartphone } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'

type Props = {
  name: string
  invitationType: 'digital' | 'cetak'
}

export function InvitationAvatar({ name, invitationType }: Props) {
  const isPrint = invitationType === 'cetak'
  return (
    <span className={`guest-avatar${isPrint ? ' is-print' : ''}`}>
      <Avatar name={name} size="lg" />
      <span className="guest-avatar-badge" role="img" aria-label={isPrint ? 'Undangan cetak' : 'Undangan digital'}>
        {isPrint ? <Printer size={10} aria-hidden /> : <Smartphone size={10} aria-hidden />}
      </span>
    </span>
  )
}
