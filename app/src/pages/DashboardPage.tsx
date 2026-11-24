import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
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
import type { Templates } from '@/lib/whatsapp'

const NOTIF_SEEN_KEY = 'rr_notif_seen'
const WISH_LIMIT = 50
const tabParams = ['status', 'cari', 'kategori', 'jenis', 'sesi', 'urut', 'arah', 'bacaan']
const readSearch = () => new URLSearchParams(window.location.search)

function tabOf(search: URLSearchParams): Tab {
  const tab = search.get('tab')
  return tab === 'tamu' || tab === 'ucapan' || tab === 'undangan' ? tab : 'beranda'
}

export function DashboardPage() {
  const { signOut } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(readSearch)
  const tab = tabOf(search)
  const [templateDraft, setTemplateDraft] = useState<{ eventId: string; templates: Templates } | null>(null)
  const [createRequest, setCreateRequest] = useState(0)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unreadWishes, setUnreadWishes] = useState(0)
  const [wishes, setWishes] = useState<Wish[]>([])
  const [notifSeen, setNotifSeen] = useState(() => Number(localStorage.getItem(NOTIF_SEEN_KEY) || 0))

  // Mirrors `data` for the load callback, which is stable and must not depend on it.
  const hasDataRef = useRef(false)
  const mainRef = useRef<HTMLElement>(null)
  const scannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => setSearch(readSearch())
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [tab])

  useEffect(() => {
    if (scannerOpen) scannerRef.current?.focus()
  }, [scannerOpen])

  useEffect(() => {
    if (templateDraft?.eventId !== data?.event?.id || !templateDraft) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [templateDraft, data?.event?.id])

  const updateSearch = (patch: Record<string, string | string[] | null>, replace = false) => {
    const url = new URL(window.location.href)
    for (const [key, value] of Object.entries(patch)) {
      url.searchParams.delete(key)
      for (const entry of Array.isArray(value) ? value : value ? [value] : []) url.searchParams.append(key, entry)
    }
    if (url.href === window.location.href) return
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url)
    setSearch(url.searchParams)
  }

  const openTab = (next: Tab, status: GuestStatus = 'semua') => {
    if (next === tab && status === 'semua') return
    updateSearch({
      ...Object.fromEntries(tabParams.map(key => [key, null])),
      tab: next === 'beranda' ? null : next,
      status: next === 'tamu' && status !== 'semua' ? status : null,
    })
  }

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
    updateSearch({ ...Object.fromEntries(tabParams.map(key => [key, null])), tab: null }, true)
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
    if (data?.event?.scanner_code) {
      setScannerOpen(true)
      return true
    }
    notify('Kode pemindai belum tersedia.')
    return false
  }

  const closeScanner = () => {
    setScannerOpen(false)
    requestAnimationFrame(() => mainRef.current?.querySelector<HTMLButtonElement>('button.fab')?.focus({ preventScroll: true }))
  }

  const onScannerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dialog = event.currentTarget
    // Radix manages the keyboard while a portaled scanner sheet is open.
    if (event.defaultPrevented || !dialog.contains(event.target as Node)) return
    if (event.key === 'Escape') {
      event.preventDefault()
      closeScanner()
    } else if (event.key === 'Tab') {
      const stops = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, a[href], [tabindex]'))
        .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0)
      const index = stops.indexOf(document.activeElement as HTMLElement)
      if (stops.length && (index < 0 || (event.shiftKey ? index === 0 : index === stops.length - 1))) {
        event.preventDefault()
        stops[event.shiftKey ? stops.length - 1 : 0].focus()
      }
    }
  }

  const addGuest = () => {
    openTab('tamu')
    setCreateRequest(n => n + 1)
  }

  const openInvitation = () => {
    setAccountOpen(false)
    openTab('undangan')
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }))
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
        <AccountSheet open={accountOpen} data={data} notify={notify} onClose={() => setAccountOpen(false)} onEventDeleted={load} />
        {notice && (
          <div className="toast-layer">
            <Toast key={notice.id} title={notice.text} open onOpenChange={open => { if (!open) setNotice(null) }} duration={2600} />
          </div>
        )}
      </>
    )
  }

  return (
    <>
    <main ref={mainRef} id="main-content" className={`app${tab === 'tamu' ? ' app--guests' : ''}`} tabIndex={-1} inert={scannerOpen}>
      {tab === 'beranda' && (
        <HomePage
          data={data}
          onOpenGuests={status => {
            openTab('tamu', status)
            requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }))
          }}
          onOpenInvitation={openInvitation}
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
          search={search}
          onFilterChange={patch => updateSearch(patch, true)}
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
          filter={search.get('bacaan') === 'baru' ? 'baru' : 'semua'}
          onFilterChange={filter => updateSearch({ bacaan: filter === 'baru' ? filter : null }, true)}
        />
      )}
      {tab === 'undangan' && (
        <InvitationPage
          data={data}
          onShare={sharePreview}
          onChanged={load}
          notify={notify}
          onOpenAccount={() => setAccountOpen(true)}
          draft={templateDraft?.eventId === data.event.id ? templateDraft.templates : null}
          onDraftChange={templates => setTemplateDraft(templates ? { eventId: data.event!.id, templates } : null)}
          onTemplatesSaved={templates => {
            const eventId = data.event!.id
            setData(current => current?.event?.id === eventId
              ? { ...current, event: { ...current.event, wa_templates: templates } }
              : current)
            setTemplateDraft(current => current?.eventId === eventId && current.templates === templates ? null : current)
          }}
        />
      )}

      <TabBar
        value={tab}
        onChange={openTab}
        onScanner={openScanner}
        onAddGuest={addGuest}
        notifications={notifications}
        notifKey={notifKey}
        onNotificationsOpenChange={onNotificationsOpenChange}
        unreadNotifications={unreadNotifications}
        unreadWishes={unreadWishes}
      />

      <AccountSheet open={accountOpen} data={data} notify={notify} onClose={() => setAccountOpen(false)} onEventDeleted={load} onOpenInvitation={openInvitation} />

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

    </main>
      {scannerOpen && data.event?.scanner_code && (
        <div ref={scannerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Pemindai tamu" onKeyDown={onScannerKeyDown}>
          <ScannerScreen code={data.event.scanner_code} eventTitle={data.event.title} onExit={closeScanner} />
        </div>
      )}
    </>
  )
}
