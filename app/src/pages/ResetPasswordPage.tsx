import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/arc/button/button'
import { PasswordField } from '@/components/arc/password-field/password-field'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export function ResetPasswordPage() {
  const { signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password minimal 8 karakter.')
    if (password !== repeat) return setError('Password baru tidak sama.')
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) return setError('Gagal menyimpan password. Coba lagi.')
    window.history.replaceState(null, '', '/dashboard')
    window.location.reload()
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>Password baru</h1>
        <p style={{ margin: '6px 0 24px', color: 'var(--text-secondary)' }}>Buat password baru untuk akun Anda.</p>

        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          <PasswordField
            label="Password baru"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            description="Minimal 8 karakter."
            required
          />
          <PasswordField
            label="Ulangi password baru"
            value={repeat}
            onChange={e => setRepeat(e.target.value)}
            autoComplete="new-password"
            required
          />
          {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}
          <Button type="submit" loading={busy} variant="primary" size="lg" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-foreground)' }}>
            Simpan password
          </Button>
          <Button type="button" variant="ghost" onClick={() => signOut()}>Batal</Button>
        </form>
      </div>
    </main>
  )
}
