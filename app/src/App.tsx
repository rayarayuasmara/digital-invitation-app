import { AuthProvider, useAuth } from '@/lib/auth'
import { AuthPage } from '@/pages/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'

function Shell() {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <AuthPage />

  return <DashboardPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
