import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { Input } from '@/components/arc/input/input'
import { cleanToken, verifyScannerCode } from '@/lib/scanner'
import { ScannerScreen } from '@/pages/ScannerScreen'

const STORAGE_KEY = 'rr_scanner_code'

export function ScannerRoute() {
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [checking, setChecking] = useState(true)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const enter = async (raw: string, remember: boolean) => {
    const clean = cleanToken(raw)
    if (!clean) {
      setError('Kode akses wajib diisi.')
      return false
    }
    const info = await verifyScannerCode(clean)
    if (!info) {
      setError('Kode tidak valid atau sudah diganti pemilik acara.')
      return false
    }
    if (remember) localStorage.setItem(STORAGE_KEY, clean)
    setCode(clean)
    setTitle(info.title)
    setError('')
    return true
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = params.get('code')
    const stored = localStorage.getItem(STORAGE_KEY) || ''
    const start = async () => {
      if (fromUrl) {
        window.history.replaceState(null, '', window.location.pathname)
        if (await enter(fromUrl, true)) return setChecking(false)
      }
      if (stored) {
        if (!(await enter(stored, false))) localStorage.removeItem(STORAGE_KEY)
      }
      setChecking(false)
    }
    start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    const ok = await enter(input, true)
    setBusy(false)
    if (ok) setInput('')
  }

  if (checking) return <main className="app"><p className="empty">Memuat…</p></main>

  if (code) {
    return (
      <ScannerScreen
        code={code}
        eventTitle={title || 'Mode operator door'}
        onExit={() => {
          localStorage.removeItem(STORAGE_KEY)
          setCode('')
          setTitle('')
        }}
      />
    )
  }

  return (
    <main className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 400, display: 'grid', gap: 16, padding: 'var(--space-6)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-panel)', boxShadow: 'var(--shadow-resting)' }}>
        <div style={{ display: 'grid', placeItems: 'center', gap: 8, textAlign: 'center' }}>
          <span className="gate-ic"><KeyRound size={24} aria-hidden /></span>
          <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>Kode petugas</h1>
          <p style={{ margin: 0, color: 'var(--sub)', fontSize: 'var(--text-sm)' }}>
            Masukkan kode akses acara. Minta kode ini ke pemilik undangan lewat menu Profil Acara.
          </p>
        </div>
        <Input label="Kode akses acara" value={input} onChange={e => setInput(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="16 karakter" />
        {error && <p role="alert" style={{ margin: 0, color: 'var(--red-ink)' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
        <p style={{ margin: 0, color: 'var(--sub)', fontSize: 'var(--text-xs)', textAlign: 'center' }}>
          Kode ini hanya membuka daftar tamu dan check-in. Tidak bisa mengubah data.
        </p>
      </form>
    </main>
  )
}
