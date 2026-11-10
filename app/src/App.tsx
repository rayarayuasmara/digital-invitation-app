import { Button } from '@/components/arc/button/button'
import { AuthProvider, useAuth } from '@/lib/auth'
import { AuthPage } from '@/pages/AuthPage'

function Shell() {
  const { session, loading, signOut } = useAuth()

  if (loading) return null
  if (!session) return <AuthPage />

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, gap: 16 }}>
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
        <p style={{ margin: 0 }}>Masuk sebagai {session.user.email}</p>
        <Button variant="secondary" onClick={() => signOut()}>Keluar</Button>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
