import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/arc/button/button'
import { fetchDashboard } from '@/lib/dashboard'
import type { DashboardData } from '@/lib/dashboard'
import { fetchWishes } from '@/lib/wishes'
import Toast from '@/components/arc/toast/toast'
import { TabBar } from '@/components/TabBar'
import type { Tab } from '@/components/TabBar'
import { AccountSheet } from '@/components/AccountSheet'
import type { NotificationItem } from '@/components/arc/notification-center/notification-center'
import { buildNotifications } from '@/lib/notifications'
import type { Guest } from '@/lib/guests'
import type { Wish } from '@/lib/wishes'
import { GuestsPanel } from '@/pages/GuestsPanel'
import type { GuestStatus } from '@/pages/GuestsPanel'
import { ScannerScreen } from '@/pages/ScannerScreen'
import { HomePage } from '@/pages/HomePage'
import { InvitationPage } from '@/pages/InvitationPage'
import { WishesPage } from '@/pages/WishesPage'
import { EventOnboarding } from '@/pages/EventOnboarding'

const NOTIF_SEEN_KEY = 'rr_notif_seen'
const WISH_LIMIT = 50

export function DashboardPage() {
  const { signOut } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('beranda')
  const [guestView, setGuestView] = useState<GuestStatus>('semua')
  const [createRequest, setCreateRequest] = useState(0)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unreadWishes, setUnreadWishes] = useState(0)
  const [wishes, setWishes] = useState<Wish[]>([])
  const [notifSeen, setNotifSeen] = useState(() => Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0))

  // Mirrors `data` for the load callback, which is stable and must not depend on it.
  const hasDataRef = useRef(false)

  const notify = useCallback((message: string) => setNotice({ id: Date.now(), text: message }), [])

  const notifications = useMemo<NotificationItem[]>(() => data?.event
    ? buildNotifications(wishes, data.guests as Guest[], data.event.wishes_seen_at ?? null, notifSeen)
    : [], [data, wishes, notifSeen])
  const unreadNotifications = notifications.filter(n => !n.read).length
  const notifKey = `${notifSeen}:${wishes.length}:${notifications.length}`

  // The panel marks everything seen when it closes, so its items stay styled as they were while it is open.
  const onNotificationsOpenChange = (open: boolean) => {
    if (open) return
    const now = Date.now()
    localStorage.setItem(NOTIF_SEEN_KEY, String(now))
    setNotifSeen(now)
  }

  const applyDashboard = useCallback((next: DashboardData) => {
    hasDataRef.current = true
    setData(next)
    setError('')
    // The unread badge is not essential: fetch it in the background and let it fail quietly.
    if (next.event) {
      fetchWishes(next.event.id, next.event.wishes_seen_at ?? null, WISH_LIMIT)
        .then(summary => { setWishes(summary.wishes); setUnreadWishes(summary.unread) })
        .catch(() => { setWishes([]); setUnreadWishes(0) })
    }
  }, [])

  const load = useCallback(async () => {
    try {
      applyDashboard(await fetchDashboard())
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal memuat data.'
      // Keep what is on screen. A failed refresh should not replace a working dashboard.
      if (hasDataRef.current) notify('Gagal memperbarui data. Coba lagi.')
      else setError(message)
    }
  }, [notify, applyDashboard])

  const loadFirstEvent = async () => {
    const next = await fetchDashboard()
    if (!next.event) return false
    applyDashboard(next)
    notify('Acara siap. Mulai dengan menambah tamu pertama.')
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' })
      document.getElementById('main-content')?.focus({ preventScroll: true })
    })
    return true
  }

  useEffect(() => {
    load()
  }, [load])

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
        <Button
          variant="accent"
          size="xl"
          fullWidth
          className="app-state-action"
          onClick={() => { setError(''); load() }}
        >
          Coba lagi
        </Button>
        <Button variant="accentOutline" size="xl" fullWidth className="app-state-action" onClick={() => signOut()}>Keluar</Button>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="app" aria-busy="true">
        <div className="home-skeleton" aria-hidden>
          <div className="home-skeleton-head">
            <span className="home-skeleton-title" />
            <span className="home-skeleton-avatar" />
          </div>
          <div className="home-skeleton-card home-skeleton-hero">
            <span className="home-skeleton-line is-short" />
            <span className="home-skeleton-line is-title" />
          </div>
          <div className="home-skeleton-grid">
            <div className="home-skeleton-card home-skeleton-tall" />
            <div className="home-skeleton-card" />
            <div className="home-skeleton-card" />
          </div>
          <div className="home-skeleton-card" />
        </div>
        <p className="sr-only">Memuat…</p>
      </main>
    )
  }

  if (!data.event) {
    return (
      <>
        <EventOnboarding account={{ name: data.client.name, onOpen: () => setAccountOpen(true) }} onLoadEvent={loadFirstEvent} />
        <AccountSheet open={accountOpen} data={data} notify={notify} onClose={() => setAccountOpen(false)} />
        {notice && (
          <div className="toast-layer">
            <Toast key={notice.id} title={notice.text} open onOpenChange={open => { if (!open) setNotice(null) }} duration={2600} />
          </div>
        )}
      </>
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
          onAddFirstGuest={data.stats.total_guests === 0 ? addGuest : undefined}
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
        notifications={notifications}
        notifKey={notifKey}
        onNotificationsOpenChange={onNotificationsOpenChange}
        unreadNotifications={unreadNotifications}
        unreadWishes={unreadWishes}
      />

      <AccountSheet open={accountOpen} data={data} notify={notify} onClose={() => setAccountOpen(false)} />

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
