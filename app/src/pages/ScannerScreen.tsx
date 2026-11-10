import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { CheckCircle2, LogOut, RefreshCw, ScanLine, Search, SwitchCamera, Ticket, UserCheck, UserRound, XCircle } from 'lucide-react'
import { Gauge } from '@/components/arc/gauge/gauge'
import { Sheet } from '@/components/Sheet'
import { checkIn, listScanGuests, tokenFromScan } from '@/lib/scanner'
import type { CheckInResult, ScanGuest } from '@/lib/scanner'

const READER_ID = 'scanner-reader'
const scanConfig = { fps: 10, qrbox: { width: 220, height: 220 } }

type Mode = 'scan' | 'manual'
type Filter = 'semua' | 'belum' | 'sudah'
type HistoryItem = { id: number; ok: boolean; dup: boolean; name: string; pax: number | null; time: string }
type SheetState =
  | { kind: 'result'; ok: boolean; dup: boolean; title: string; subtitle: string; guest: ScanGuest | null; source: 'scan' | 'manual' }
  | { kind: 'confirm'; guest: ScanGuest }
  | { kind: 'checked'; guest: ScanGuest }

const paxOf = (g: ScanGuest) => g.pax_confirmed || g.max_pax || 1

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 220
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.15 : 0.4))
  } catch {
    /* audio tidak tersedia di perangkat ini */
  }
}

function feedback(ok: boolean) {
  navigator.vibrate?.(ok ? [60] : [120, 60, 120])
  beep(ok)
}

type Props = {
  code: string
  eventTitle: string
  onExit: () => void
}

export function ScannerScreen({ code, eventTitle, onExit }: Props) {
  const [mode, setMode] = useState<Mode>('scan')
  const [guests, setGuests] = useState<ScanGuest[]>([])
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('semua')
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [camHint, setCamHint] = useState('Arahkan kamera ke QR Code tiket tamu')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [tokenInput, setTokenInput] = useState('')
  const [notice, setNotice] = useState('')

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const processing = useRef(false)
  const lastScan = useRef({ token: '', at: 0 })
  const autoTimer = useRef<number | undefined>(undefined)
  const historyId = useRef(0)

  const refresh = useCallback(async () => {
    try {
      setGuests(await listScanGuests(code))
      setLoadError('')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat daftar tamu.')
    }
  }, [code])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(''), 2200)
    return () => window.clearTimeout(id)
  }, [notice])

  const stopCamera = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) await scannerRef.current.stop()
    } catch {
      /* kamera sudah berhenti */
    }
  }, [])

  const onScanRef = useRef<(decoded: string) => void>(() => {})

  const startCamera = useCallback(async (preferred: 'environment' | 'user') => {
    if (!scannerRef.current) scannerRef.current = new Html5Qrcode(READER_ID)
    const scanner = scannerRef.current
    if (scanner.isScanning) return
    const order = preferred === 'environment' ? ['environment', 'user'] as const : ['user', 'environment'] as const
    for (const mode of order) {
      try {
        await scanner.start({ facingMode: mode }, scanConfig, decoded => onScanRef.current(decoded), () => {})
        setFacing(mode)
        setCamHint('Arahkan kamera ke QR Code tiket tamu')
        return
      } catch {
        /* coba kamera berikutnya */
      }
    }
    setCamHint('Kamera tidak aktif. Gunakan Cari Manual atau cek izin kamera.')
  }, [])

  useEffect(() => {
    if (mode === 'scan') startCamera(facing)
    else stopCamera()
    return () => {
      stopCamera()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopCamera()
      else if (mode === 'scan') startCamera(facing)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [mode, facing, startCamera, stopCamera])

  useEffect(() => () => window.clearTimeout(autoTimer.current), [])

  const closeSheet = useCallback(() => {
    window.clearTimeout(autoTimer.current)
    setSheet(null)
    window.setTimeout(() => {
      processing.current = false
    }, 400)
  }, [])

  const addHistory = (item: Omit<HistoryItem, 'id' | 'time'>) => {
    historyId.current += 1
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    setHistory(h => [{ ...item, id: historyId.current, time }, ...h].slice(0, 15))
  }

  const handleToken = async (input: string, source: 'scan' | 'manual') => {
    processing.current = true
    const res: CheckInResult = await checkIn(code, input)

    if (res.success) {
      const g = res.guest ?? null
      feedback(true)
      addHistory({ ok: true, dup: false, name: g?.group_name ?? '(tidak dikenal)', pax: g ? paxOf(g) : null })
      setSheet({ kind: 'result', ok: true, dup: false, title: 'Berhasil Check-in!', subtitle: 'Tamu terverifikasi resmi.', guest: g, source })
      if (source === 'scan') {
        autoTimer.current = window.setTimeout(closeSheet, 2600)
      }
      refresh()
      return
    }

    const dup = !!res.already_checked_in
    const g = res.guest ?? null
    feedback(false)
    addHistory({ ok: false, dup, name: g?.group_name ?? '(tidak dikenal)', pax: g ? paxOf(g) : null })
    setSheet({
      kind: 'result',
      ok: false,
      dup,
      title: dup ? 'Sudah Pernah Check-in' : 'Peringatan Tiket',
      subtitle: res.message || 'Tiket tidak valid.',
      guest: g,
      source,
    })
  }

  const onScan = (decoded: string) => {
    if (processing.current) return
    const raw = String(decoded).trim()
    if (!raw || raw === 'undefined') return
    const token = tokenFromScan(raw)
    if (!token) return
    const now = Date.now()
    if (token === lastScan.current.token && now - lastScan.current.at < 4000) return
    lastScan.current = { token, at: now }
    navigator.vibrate?.(100)
    handleToken(token, 'scan')
  }

  onScanRef.current = onScan

  const submitToken = () => {
    const token = tokenFromScan(tokenInput)
    if (!token) return setNotice('Masukkan kode token terlebih dahulu.')
    setTokenInput('')
    processing.current = true
    handleToken(token, 'manual')
  }

  const pickGuest = (g: ScanGuest) => {
    if (g.is_checked_in) return setSheet({ kind: 'checked', guest: g })
    processing.current = true
    setSheet({ kind: 'confirm', guest: g })
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return guests
      .filter(g => `${g.group_name} ${g.category ?? ''}`.toLowerCase().includes(q))
      .filter(g => filter === 'semua' || (filter === 'belum' ? !g.is_checked_in : g.is_checked_in))
  }, [guests, query, filter])

  const stats = useMemo(() => {
    const total = guests.length
    const done = guests.filter(g => g.is_checked_in)
    const pax = done.reduce((sum, g) => sum + paxOf(g), 0)
    return { total, done: done.length, wait: total - done.length, pax }
  }, [guests])

  const sheetTitle = sheet?.kind === 'result' ? sheet.title : sheet?.kind === 'confirm' ? 'Check-in tamu ini?' : sheet ? 'Sudah check-in' : ''

  return (
    <div className="scanner-screen">
      <div className="app">
        <header className="scanner-top">
          <div>
            <p className="scanner-kicker"><span className="live" aria-hidden />Mode operator door</p>
            <h1 className="page-title" style={{ margin: '4px 0 0' }}>Scanner</h1>
            <p className="page-sub" style={{ margin: '2px 0 0' }}>{eventTitle}</p>
          </div>
          <div className="scanner-actions">
            <button type="button" className="icon-btn" onClick={refresh} aria-label="Muat ulang data"><RefreshCw size={16} aria-hidden /></button>
            <button type="button" className="icon-btn" onClick={onExit} aria-label="Keluar dari scanner"><LogOut size={16} aria-hidden /></button>
          </div>
        </header>

        <div className="segmented" role="tablist" aria-label="Mode scanner">
          <button type="button" role="tab" aria-selected={mode === 'scan'} onClick={() => setMode('scan')}>
            <ScanLine size={16} aria-hidden /> Scan QR
          </button>
          <button type="button" role="tab" aria-selected={mode === 'manual'} onClick={() => setMode('manual')}>
            <Search size={16} aria-hidden /> Cari manual
          </button>
        </div>

        {mode === 'scan' && (
          <section className="card" style={{ padding: 14, marginTop: 12 }}>
            <div className="cam">
              <div id={READER_ID} />
              <div className="cam-frame" aria-hidden />
            </div>
            <div className="cam-bar">
              <p>{camHint}</p>
              <button
                type="button"
                className="icon-btn"
                aria-label="Ganti kamera"
                onClick={() => {
                  const next = facing === 'environment' ? 'user' : 'environment'
                  stopCamera().then(() => startCamera(next))
                }}
              >
                <SwitchCamera size={16} aria-hidden />
              </button>
            </div>
          </section>
        )}

        {mode === 'manual' && (
          <section style={{ marginTop: 12 }}>
            <label className="search">
              <Search size={18} aria-hidden color="var(--sub)" />
              <input type="search" placeholder="Ketik nama tamu" aria-label="Cari nama tamu" value={query} onChange={e => setQuery(e.target.value)} />
            </label>
            <div className="chips" role="group" aria-label="Filter tamu">
              {([['semua', 'Semua'], ['belum', 'Belum masuk'], ['sudah', 'Sudah masuk']] as const).map(([v, l]) => (
                <button key={v} type="button" className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>
              ))}
            </div>
            {loadError && <p role="alert" className="empty" style={{ color: 'var(--red-ink)' }}>{loadError}</p>}
            {!loadError && visible.length === 0 && <p className="empty">Tamu tidak ditemukan.</p>}
            <ul className="list" style={{ marginTop: 8 }}>
              {visible.slice(0, 80).map(g => (
                <li key={g.ref}>
                  <button type="button" className="list-row" onClick={() => pickGuest(g)} disabled={!g.ref}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="name">{g.group_name}</p>
                      <p className="meta">{g.category || 'Umum'} · {paxOf(g)} orang</p>
                    </div>
                    <span className={`badge ${g.is_checked_in ? 'badge-ok' : ''}`}>{g.is_checked_in ? 'Checked' : 'Ready'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="card" style={{ marginTop: 12 }}>
              <p className="stat-label" style={{ marginBottom: 8 }}>Atau masukkan kode token tiket</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <label className="search" style={{ margin: 0 }}>
                  <Ticket size={18} aria-hidden color="var(--sub)" />
                  <input
                    type="text"
                    placeholder="Contoh: 115b0522"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitToken() }}
                  />
                </label>
                <button type="button" className="btn btn-primary" style={{ width: 'auto', minWidth: 96, minHeight: 44 }} onClick={submitToken}>Proses</button>
              </div>
            </div>
          </section>
        )}

        <section className="card scanner-stats" style={{ marginTop: 12 }}>
          <Gauge
            label="Check-in"
            value={stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}
            detail={`${stats.done} dari ${stats.total} grup`}
          />
          <dl className="split" style={{ alignContent: 'center' }}>
            <div>
              <dt>Belum masuk</dt>
              <dd>{stats.wait}</dd>
            </div>
            <div>
              <dt>Orang masuk</dt>
              <dd>{stats.pax}</dd>
            </div>
          </dl>
        </section>

        <h2 className="section-title">Riwayat scan · {history.length}</h2>
        {history.length === 0 && <p className="empty" style={{ padding: 16 }}>Belum ada scan di sesi ini.</p>}
        <ul className="list">
          {history.map(h => (
            <li key={h.id} className="list-row" style={{ cursor: 'default' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="name">{h.name}</p>
                <p className="meta">{h.pax ? `${h.pax} orang · ` : ''}{h.time}</p>
              </div>
              <span className={`badge ${h.ok ? 'badge-ok' : h.dup ? '' : 'badge-bad'}`}>{h.ok ? 'Berhasil' : h.dup ? 'Duplikat' : 'Gagal'}</span>
            </li>
          ))}
        </ul>
      </div>

      <Sheet open={sheet !== null} title={sheetTitle} onClose={closeSheet}>
        {sheet?.kind === 'result' && (
          <div className="sheet-body" style={{ justifyItems: 'center', textAlign: 'center' }}>
            {sheet.ok ? <CheckCircle2 size={56} color="var(--green-ink)" aria-hidden /> : sheet.dup ? <UserCheck size={56} color="var(--accent)" aria-hidden /> : <XCircle size={56} color="var(--red-ink)" aria-hidden />}
            <p style={{ margin: 0, color: 'var(--sub)' }}>{sheet.subtitle}</p>
            {sheet.guest && <GuestDetail guest={sheet.guest} />}
            <button type="button" className="btn btn-primary" onClick={closeSheet}>
              {sheet.source === 'scan' ? 'Pindai tiket berikutnya' : 'Selesai'}
            </button>
          </div>
        )}
        {sheet?.kind === 'confirm' && (
          <div className="sheet-body">
            <p style={{ margin: 0, color: 'var(--sub)' }}>Pastikan tamu sudah ada di depan Anda.</p>
            <GuestDetail guest={sheet.guest} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const ref = sheet.guest.ref
                setSheet(null)
                handleToken(ref, 'manual')
              }}
            >
              Check-in sekarang
            </button>
            <button type="button" className="btn btn-secondary" onClick={closeSheet}>Batal</button>
          </div>
        )}
        {sheet?.kind === 'checked' && (
          <div className="sheet-body">
            <p style={{ margin: 0, color: 'var(--sub)' }}>{sheet.guest.group_name} sudah diverifikasi sebelumnya.</p>
            <button type="button" className="btn btn-secondary" onClick={closeSheet}>Tutup</button>
          </div>
        )}
      </Sheet>

      {notice && <div role="status" className="toast">{notice}</div>}
    </div>
  )
}

function GuestDetail({ guest }: { guest: ScanGuest }) {
  return (
    <div className="card" style={{ width: '100%', textAlign: 'left' }}>
      <div className="kv"><span>Nama</span><span>{guest.group_name}</span></div>
      <div className="kv"><span>Kategori</span><span>{guest.category || 'Umum'}</span></div>
      <div className="kv"><span>Jumlah</span><span>{paxOf(guest)} orang</span></div>
      <div className="kv" style={{ alignItems: 'center' }}><span>Status</span><span><UserRound size={14} aria-hidden /> {guest.is_checked_in ? 'Sudah masuk' : 'Belum masuk'}</span></div>
    </div>
  )
}
