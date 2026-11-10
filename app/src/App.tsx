import { AuthProvider, useAuth } from '@/lib/auth'
import { AuthPage } from '@/pages/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { ScannerRoute } from '@/pages/ScannerRoute'

function Shell() {
  const { session, loading } = useAuth()

  if (window.location.pathname.startsWith('/scanner')) return <ScannerRoute />
  if (loading) return null
  if (!session) return <AuthPage />
  if (window.location.pathname === '/reset-password') return <ResetPasswordPage />

  return <DashboardPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
