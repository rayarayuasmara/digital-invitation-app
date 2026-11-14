import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import type { DashboardData } from '@/lib/dashboard'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/arc/card'

type Props = {
  data: DashboardData
  notify: (message: string) => void
}

export function AccountPage({ data, notify }: Props) {
  const { signOut } = useAuth()
  const { client, stats } = data
  const [sending, setSending] = useState(false)

  const sendReset = async () => {
    setSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(client.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSending(false)
    notify(error ? 'Gagal mengirim tautan. Coba lagi.' : 'Tautan ubah password sudah dikirim ke email Anda.')
  }

  const tierLabel = client.tier === 'pro' ? 'Pro' : 'Gratis'

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Akun</h1>
          <p className="page-sub">{client.email}</p>
        </div>
      </div>

      <Card variant="default" padding="none" className="settings-group">
        <div className="settings-row">
          <span>Nama</span>
          <span className="settings-value">{client.name}</span>
        </div>
        <div className="settings-row">
          <span>Paket</span>
          <span className="settings-value">{tierLabel}</span>
        </div>
        <div className="settings-row">
          <span>Kuota tamu</span>
          <span className="settings-value">{stats.total_guests} / {stats.max_quota}</span>
        </div>
      </Card>

      <Card variant="default" padding="none" className="settings-group">
        <button type="button" className="settings-row settings-action" onClick={sendReset} disabled={sending}>
          <span>{sending ? 'Mengirim…' : 'Ubah password'}</span>
          <ChevronRight size={18} strokeWidth={2} className="settings-chevron" aria-hidden />
        </button>
      </Card>

      <Card variant="default" padding="none" className="settings-group">
        <button type="button" className="settings-row settings-action is-danger" onClick={() => signOut()}>
          <span>Keluar</span>
        </button>
      </Card>
    </>
  )
}
