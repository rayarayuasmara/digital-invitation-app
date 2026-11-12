import { useState } from 'react'
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
      <h1 className="page-title">Akun</h1>
      <p className="page-sub">{client.email}</p>

      <Card variant="default" padding="md">
        <div className="kv"><span>Nama</span><span>{client.name}</span></div>
        <div className="kv"><span>Paket</span><span>{tierLabel}</span></div>
        <div className="kv"><span>Kuota tamu</span><span>{stats.total_guests} / {stats.max_quota}</span></div>
      </Card>

      <h2 className="section-title">Keamanan</h2>
      <button type="button" className="btn btn-secondary" onClick={sendReset} disabled={sending}>
        {sending ? 'Mengirim…' : 'Ubah password'}
      </button>

      <h2 className="section-title">Sesi</h2>
      <button type="button" className="btn btn-danger" onClick={() => signOut()}>Keluar</button>
    </>
  )
}
