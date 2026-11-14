import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { PasswordField } from '@/components/arc/password-field/password-field'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'

const subtitle: Record<Mode, string> = {
  login: 'Masuk untuk mengelola tamu dan detail acara Anda.',
  signup: 'Buat akun untuk mulai mengelola undangan Anda.',
  forgot: 'Masukkan email akun Anda. Kami kirim tautan untuk membuat password baru.',
}

function friendlySignupError(message: string) {
  if (/already registered|already exists|user already/i.test(message)) return 'Email ini sudah terdaftar. Coba masuk.'
  if (/rate limit/i.test(message)) return 'Terlalu banyak percobaan email. Coba lagi beberapa menit lagi.'
  if (/invalid/i.test(message) && /email/i.test(message)) return 'Email ini tidak diterima. Gunakan email aktif yang lain.'
  if (/password/i.test(message)) return 'Password terlalu lemah. Gunakan minimal 8 karakter.'
  return message
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>(() => (
    window.location.pathname === '/register' ? 'signup' : 'login'
  ))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setNotice('')
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setBusy(false)
      if (err) setError('Login gagal. Periksa email dan password.')
      return
    }

    if (mode === 'signup') {
      if (password.length < 8) {
        setBusy(false)
        setError('Password minimal 8 karakter.')
        return
      }
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim(), phone: phone.trim() || null },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      setBusy(false)
      if (err) {
        setError(friendlySignupError(err.message))
        return
      }
      if (!data.session) setNotice('Akun dibuat. Cek email untuk konfirmasi, lalu masuk.')
      return
    }

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (err && /rate limit|too many/i.test(err.message)) {
      setError('Terlalu banyak permintaan. Coba lagi beberapa menit lagi.')
      return
    }
    if (err) {
      setError('Gagal mengirim tautan. Coba lagi.')
      return
    }
    setNotice('Jika email terdaftar, tautan reset sudah dikirim.')
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 600 }}>RayaRayu</h1>
        <p style={{ margin: '6px 0 24px', color: 'var(--text-secondary)' }}>{subtitle[mode]}</p>

        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          {mode === 'signup' && (
            <>
              <Input label="Nama" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
              <Input
                label="No. WhatsApp (opsional)"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                description="Untuk bantuan dan pengingat acara. Tidak ditampilkan ke tamu."
              />
            </>
          )}

          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          {mode !== 'forgot' && (
            <PasswordField
              label="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              description={mode === 'signup' ? 'Minimal 8 karakter.' : undefined}
              required
            />
          )}

          {mode === 'login' && (
            <p style={{ margin: 0, textAlign: 'right' }}>
              <button type="button" onClick={() => switchMode('forgot')} style={linkStyle}>Lupa password?</button>
            </p>
          )}

          {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}
          {notice && <p role="status" style={{ margin: 0, color: 'var(--text-secondary)' }}>{notice}</p>}

          <Button type="submit" loading={busy} variant="primary" size="lg" style={brandButton}>
            {mode === 'login' ? 'Masuk' : mode === 'signup' ? 'Daftar' : 'Kirim tautan reset'}
          </Button>
        </form>

        <p style={{ margin: '20px 0 0', textAlign: 'center' }}>
          {mode === 'login' && (
            <button type="button" onClick={() => switchMode('signup')} style={linkStyle}>Belum punya akun? Daftar</button>
          )}
          {mode === 'signup' && (
            <button type="button" onClick={() => switchMode('login')} style={linkStyle}>Sudah punya akun? Masuk</button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('login')} style={linkStyle}>Kembali ke masuk</button>
          )}
        </p>
      </div>
    </main>
  )
}

const brandButton = {
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: 'var(--accent-foreground)',
} as const

const linkStyle = {
  background: 'none',
  border: 0,
  padding: 0,
  color: 'var(--accent)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
} as const
