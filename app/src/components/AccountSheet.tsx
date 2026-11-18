import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, LogOut, Mail, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import { useAuth } from '@/lib/auth'
import type { DashboardData } from '@/lib/dashboard'
import { supabase } from '@/lib/supabase'
import { readThemeMode, setThemeMode, subscribeThemeMode } from '@/lib/theme'
import { initialsName } from '@/lib/text'
import type { ThemeMode } from '@/lib/theme'

type Props = {
  open: boolean
  data: DashboardData
  notify: (message: string) => void
  onClose: () => void
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
]

/** Account details, opened from the avatar in any tab header. */
export function AccountSheet({ open, data, notify, onClose }: Props) {
  const { signOut } = useAuth()
  const { client, stats } = data
  const [sending, setSending] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => readThemeMode())

  useEffect(() => subscribeThemeMode(() => setTheme(readThemeMode())), [])

  const chooseTheme = (next: string) => {
    const mode = next as ThemeMode
    setTheme(mode)
    setThemeMode(mode)
  }

  const sendReset = useCallback(async () => {
    setSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(client.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSending(false)
    notify(error ? 'Gagal mengirim tautan. Coba lagi.' : 'Tautan ubah password sudah dikirim ke email Anda.')
  }, [client.email, notify])

  const isPro = client.tier === 'pro'
  const tierLabel = isPro ? 'Pro' : 'Gratis'
  const quota = Math.max(0, stats.max_quota)
  const used = Math.min(stats.total_guests, quota)
  const percent = quota > 0 ? Math.round((used / quota) * 100) : 0

  return (
    <BottomSheet open={open} onOpenChange={next => { if (!next) onClose() }} title="Akun" detents={[.92]}>
      <div className="account-sheet">
        <div className="account-identity">
          <Avatar name={initialsName(client.name)} size="xl" className="account-avatar" />
          <h2 className="account-name">{client.name}</h2>
          <p className="account-email">{client.email}</p>
          <span className="account-tier">
            {isPro && <Sparkles size={12} strokeWidth={2.4} aria-hidden />}
            Paket {tierLabel}
          </span>
        </div>

        <p className="account-section">Akun</p>
        <div className="account-group">
          <div className="account-row account-row-quota">
            <span className="account-row-icon" aria-hidden><Users size={16} strokeWidth={2} /></span>
            <span className="account-row-main">
              <span className="account-row-line">
                <span className="account-row-label">Kuota tamu</span>
                <span className="account-row-value">{used.toLocaleString('id-ID')} / {quota.toLocaleString('id-ID')}</span>
              </span>
              <span
                className="account-meter"
                role="progressbar"
                aria-label="Kuota tamu terpakai"
                aria-valuemin={0}
                aria-valuemax={quota}
                aria-valuenow={used}
              >
                <span className="account-meter-fill" style={{ width: `${Math.max(percent, used > 0 ? 3 : 0)}%` }} />
              </span>
            </span>
          </div>

          <button type="button" className="account-row account-row-action" onClick={sendReset} disabled={sending}>
            <span className="account-row-icon" aria-hidden><Mail size={16} strokeWidth={2} /></span>
            <span className="account-row-label">Ubah password</span>
            {sending && <span className="account-row-note">Mengirim…</span>}
            <ChevronRight size={18} strokeWidth={2} className="account-chevron" aria-hidden />
          </button>
        </div>

        <p className="account-section">Tampilan</p>
        <div className="account-group account-group-theme">
          <Tabs value={theme} onValueChange={chooseTheme}>
            <TabsList className="theme-tabs" aria-label="Tema tampilan">
              {themeOptions.map(option => (
                <TabsTrigger key={option.value} value={option.value}>{option.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <p className="account-section">Data</p>
        <div className="account-group">
          <div className="account-row">
            <span className="account-row-icon" aria-hidden><ShieldCheck size={16} strokeWidth={2} /></span>
            <span className="account-row-label">Data tamu tersimpan aman</span>
            <span className="account-row-note">Terenkripsi</span>
          </div>
        </div>

        <div className="account-group account-group-signout">
          <button type="button" className="account-row account-row-danger" onClick={() => signOut()}>
            <span className="account-row-icon" aria-hidden><LogOut size={16} strokeWidth={2} /></span>
            <span className="account-row-label">Keluar</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}
