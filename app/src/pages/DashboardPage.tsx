import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/arc/button/button'
import { fetchDashboard } from '@/lib/dashboard'
import type { DashboardData } from '@/lib/dashboard'
import { fetchWishes } from '@/lib/wishes'
import Toast from '@/components/arc/toast/toast'
import { TabBar } from '@/components/TabBar'
import type { Tab } from '@/components/TabBar'
import { AccountSheet } from '@/components/AccountSheet'
import { NotificationsSheet } from '@/components/NotificationsSheet'
import { GuestsPanel } from '@/pages/GuestsPanel'
import type { GuestStatus } from '@/pages/GuestsPanel'
import { ScannerScreen } from '@/pages/ScannerScreen'
import { HomePage } from '@/pages/HomePage'
import { InvitationPage } from '@/pages/InvitationPage'
import { WishesPage } from '@/pages/WishesPage'

export function DashboardPage() {
  const { signOut } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('beranda')
  const [guestView, setGuestView] = useState<GuestStatus>('semua')
  const [createRequest, setCreateRequest] = useState(0)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unreadWishes, setUnreadWishes] = useState(0)

  const load = useCallback(async () => {
    try {
      const next = await fetchDashboard()
      setData(next)
      setError('')
      if (next.event) {
        const summary = await fetchWishes(next.event.id, next.event.wishes_seen_at ?? null, 1)
        setUnreadWishes(summary.unread)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const notify = useCallback((message: string) => setNotice({ id: Date.now(), text: message }), [])

  const sharePreview = async () => {
    const event = data?.event
    if (!event?.preview_token) return notify('Tautan pratinjau belum tersedia.')
    const url = `${window.location.origin}/pratinjau/${event.slug}/${event.preview_token}`
    try {
      await navigator.clipboard.writeText(url)
      notify('Tautan pratinjau disalin')
    } catch {
      notify('Gagal menyalin tautan.')
    }
  }

  const handleCreateRequest = useCallback(() => setCreateRequest(0), [])

  const openScanner = () => {
    if (data?.event?.scanner_code) setScannerOpen(true)
    else notify('Kode scanner belum tersedia.')
  }

  const addGuest = () => {
    setGuestView('semua')
    setTab('tamu')
    setCreateRequest(n => n + 1)
  }

  if (error) {
    return (
      <main className="app app-state">
        <p role="alert" className="app-state-error">{error}</p>
        <Button variant="accentOutline" size="xl" fullWidth className="app-state-action" onClick={() => signOut()}>Keluar</Button>
      </main>
    )
  }

  if (!data) {
    return <main className="app"><p className="empty">Memuat…</p></main>
  }

  if (!data.event) {
    return (
      <main className="app app-state">
        <p className="empty">Belum ada acara. Onboarding akan menyusul di tahap berikutnya.</p>
        <Button variant="accentOutline" size="xl" fullWidth className="app-state-action" onClick={() => signOut()}>Keluar</Button>
      </main>
    )
  }

  return (
    <main id="main-content" className="app" tabIndex={-1}>
      {tab === 'beranda' && (
        <HomePage
          data={data}
          notify={notify}
          onOpenGuests={status => { setGuestView(status); setTab('tamu') }}
          onOpenAccount={() => setAccountOpen(true)}
        />
      )}
      {tab === 'tamu' && (
        <GuestsPanel
          data={data}
          onChanged={load}
          notify={notify}
          createRequest={createRequest}
          onCreateHandled={handleCreateRequest}
          initialStatus={guestView}
          onOpenAccount={() => setAccountOpen(true)}
        />
      )}
      {tab === 'ucapan' && (
        <WishesPage
          data={data}
          notify={notify}
          onOpenAccount={() => setAccountOpen(true)}
          onChanged={load}
          onSeen={() => setUnreadWishes(0)}
        />
      )}
      {tab === 'undangan' && (
        <InvitationPage
          data={data}
          onShare={sharePreview}
          onChanged={load}
          notify={notify}
          onOpenAccount={() => setAccountOpen(true)}
        />
      )}

      <TabBar
        value={tab}
        onChange={next => {
          // A tab-bar visit starts from the full list; only Beranda deep-links
          // into a filtered guest view.
          if (next === 'tamu') setGuestView('semua')
          setTab(next)
        }}
        onScanner={openScanner}
        onAddGuest={addGuest}
        onNotifications={() => setNotifOpen(true)}
        unreadWishes={unreadWishes}
      />

      <AccountSheet open={accountOpen} data={data} notify={notify} onClose={() => setAccountOpen(false)} />
      <NotificationsSheet open={notifOpen} data={data} onClose={() => setNotifOpen(false)} />

      {notice && (
        <div className="toast-layer">
          <Toast
            key={notice.id}
            title={notice.text}
            open
            onOpenChange={open => { if (!open) setNotice(null) }}
            duration={2600}
          />
        </div>
      )}

      {scannerOpen && data.event?.scanner_code && (
        <ScannerScreen
          code={data.event.scanner_code}
          eventTitle={data.event.title}
          onExit={() => setScannerOpen(false)}
        />
      )}
    </main>
  )
}
