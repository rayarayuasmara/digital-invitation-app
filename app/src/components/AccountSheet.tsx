import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, LogOut, Mail, Pencil, Sparkles, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/arc/badge/badge'
import { Avatar } from '@/components/arc/avatar/avatar'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { useAuth } from '@/lib/auth'
import { deleteEvent } from '@/lib/dashboard'
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
  onOpenInvitation?: () => void
  /** Reload the dashboard after the event is deleted, so onboarding can show again. */
  onEventDeleted?: () => void
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
]

/** Account details, opened from the avatar in any tab header. */
export function AccountSheet({ open, data, notify, onClose, onEventDeleted, onOpenInvitation }: Props) {
  const { signOut } = useAuth()
  const { client, stats } = data
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  const event = data.event
  const removeEvent = async () => {
    if (!event || deleting) return
    setDeleting(true)
    try {
      await deleteEvent(event.id)
      setConfirmDelete(false)
      onClose()
      notify('Acara dihapus')
      onEventDeleted?.()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Acara belum bisa dihapus. Coba lagi.')
    } finally {
      setDeleting(false)
    }
  }

  const deleteDetail = event
    ? `Undangan ${event.title}, beserta ${stats.total_guests.toLocaleString('id-ID')} tamu dan semua ucapan, akan dihapus permanen.`
    : ''

  return (
    <>
      <BottomSheet open={open} onOpenChange={next => { if (!next) onClose() }} title="Akun" detents={[.92]} closeLabel="Tutup akun">
        <div className="account-sheet">
          <div className="account-identity">
            <Avatar name={initialsName(client.name)} size="xl" className="account-avatar" />
            <div className="account-profile">
              <h2 className="account-name">{client.name}</h2>
              <p className="account-email">{client.email}</p>
            </div>
            <Badge className="account-tier" size="sm" pill tone={isPro ? 'info' : 'neutral'} icon={isPro ? <Sparkles size={12} aria-hidden /> : undefined}>
              Paket {tierLabel}
            </Badge>
          </div>

          <section aria-labelledby="account-package-title">
            <h3 className="account-section" id="account-package-title">Pemakaian</h3>
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
            </div>
          </section>

          <section aria-labelledby="account-theme-title">
            <h3 className="account-section" id="account-theme-title">Tampilan</h3>
            <SegmentedControl label="Tema tampilan" options={themeOptions} value={theme} onValueChange={chooseTheme} fullWidth />
          </section>

          <section aria-labelledby="account-security-title">
            <h3 className="account-section" id="account-security-title">Keamanan</h3>
            <div className="account-group">
              <button type="button" className="account-row account-row-action" onClick={sendReset} disabled={sending}>
                <span className="account-row-icon" aria-hidden><Mail size={16} strokeWidth={2} /></span>
                <span className="account-row-label">{sending ? 'Mengirim tautan…' : 'Kirim tautan ubah kata sandi'}</span>
                <ChevronRight size={18} strokeWidth={2} className="account-chevron" aria-hidden />
              </button>
              <button type="button" className="account-row account-row-action" onClick={() => signOut()}>
                <span className="account-row-icon" aria-hidden><LogOut size={16} strokeWidth={2} /></span>
                <span className="account-row-label">Keluar dari akun</span>
              </button>
            </div>
          </section>

          {event && (
            <section aria-labelledby="account-event-title">
            <h3 className="account-section" id="account-event-title">Kelola acara</h3>
            <div className="account-group">
              {onOpenInvitation && (
                <button type="button" className="account-row account-row-action" onClick={onOpenInvitation}>
                  <span className="account-row-icon" aria-hidden><Pencil size={16} strokeWidth={2} /></span>
                  <span className="account-row-label">Kelola detail undangan</span>
                  <ChevronRight size={18} strokeWidth={2} className="account-chevron" aria-hidden />
                </button>
              )}
                <button
                  type="button"
                  className="account-row account-row-action account-row-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <span className="account-row-icon" aria-hidden><Trash2 size={16} strokeWidth={2} /></span>
                  <span className="account-row-label">Hapus acara</span>
                  <ChevronRight size={18} strokeWidth={2} className="account-chevron" aria-hidden />
                </button>
              </div>
            </section>
          )}
        </div>
      </BottomSheet>

      <Dialog open={confirmDelete} onOpenChange={next => { if (!next && !deleting) setConfirmDelete(false) }}>
        {event && (
          <DialogContent title="Hapus acara ini?" description={deleteDetail}>
            <div className="dialog-actions">
              <Button type="button" variant="dangerSoft" size="xl" fullWidth loading={deleting} onClick={removeEvent}>
                {deleting ? 'Menghapus…' : 'Ya, hapus acara'}
              </Button>
              <Button type="button" variant="accentOutline" size="xl" fullWidth disabled={deleting} onClick={() => setConfirmDelete(false)}>
                Batal
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
