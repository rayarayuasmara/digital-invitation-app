'use client'

import { AuthProvider, useAuth } from '@/lib/auth'
import { AuthPage } from '@/screens/AuthPage'
import { DashboardPage } from '@/screens/DashboardPage'
import { ResetPasswordPage } from '@/screens/ResetPasswordPage'

type Route = 'dashboard' | 'login' | 'register' | 'reset-password'

function Shell({ route }: { route: Route }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (!session) return <AuthPage initialMode={route === 'register' ? 'signup' : 'login'} />
  if (route === 'reset-password') return <ResetPasswordPage />

  return <DashboardPage />
}

export function DashboardShell({ route }: { route: Route }) {
  return (
    <AuthProvider>
      <Shell route={route} />
    </AuthProvider>
  )
}
