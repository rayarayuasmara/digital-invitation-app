import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { fetchDashboard } from '@/lib/dashboard'
import type { DashboardData } from '@/lib/dashboard'
import Toast from '@/components/arc/toast/toast'
import { TabBar } from '@/components/TabBar'
import type { Tab } from '@/components/TabBar'
import { AccountPage } from '@/pages/AccountPage'
import { GuestsPanel } from '@/pages/GuestsPanel'
import type { GuestStatus } from '@/pages/GuestsPanel'
import { ScannerScreen } from '@/pages/ScannerScreen'
import { HomePage } from '@/pages/HomePage'
import { InvitationPage } from '@/pages/InvitationPage'

export function DashboardPage() {
  const { signOut } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('beranda')
  const [guestView, setGuestView] = useState<GuestStatus>('semua')
  const [createSignal, setCreateSignal] = useState(0)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await fetchDashboard())
      setError('')
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

  const onAction = () => {
    if (tab === 'tamu') setCreateSignal(n => n + 1)
    else if (tab === 'undangan') sharePreview()
    else if (tab === 'beranda') {
      if (data?.event?.scanner_code) setScannerOpen(true)
      else notify('Kode scanner belum tersedia.')
    }
    else notify('Bantuan akan tersedia pada pembaruan berikutnya.')
  }

  if (error) {
    return (
      <main className="app" style={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 16 }}>
        <p role="alert" style={{ color: 'var(--red-ink)', textAlign: 'center' }}>{error}</p>
        <button type="button" className="btn btn-secondary" style={{ maxWidth: 240 }} onClick={() => signOut()}>Keluar</button>
      </main>
    )
  }

  if (!data) {
    return <main className="app"><p className="empty">Memuat…</p></main>
  }

  if (!data.event) {
    return (
      <main className="app" style={{ display: 'grid', placeItems: 'center', alignContent: 'center', gap: 16 }}>
        <p className="empty">Belum ada acara. Onboarding akan menyusul di tahap berikutnya.</p>
        <button type="button" className="btn btn-secondary" style={{ maxWidth: 240 }} onClick={() => signOut()}>Keluar</button>
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
        />
      )}
      {tab === 'tamu' && (
        <GuestsPanel
          data={data}
          onChanged={load}
          notify={notify}
          createSignal={createSignal}
          initialStatus={guestView}
        />
      )}
      {tab === 'undangan' && <InvitationPage data={data} onShare={sharePreview} onChanged={load} notify={notify} />}
      {tab === 'akun' && <AccountPage data={data} notify={notify} />}

      <TabBar
        value={tab}
        onChange={next => {
          // A tab-bar visit starts from the full list; only Beranda deep-links
          // into a filtered guest view.
          if (next === 'tamu') setGuestView('semua')
          setTab(next)
        }}
        onAction={onAction}
      />

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
