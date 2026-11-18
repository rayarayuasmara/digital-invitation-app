import { useRef } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { useCollapseProgress } from '@/lib/hooks/use-collapse-progress'
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
  const topFade = useRef<HTMLSpanElement>(null)
  useCollapseProgress(topFade)

  return (
    <AuthProvider>
      <a href="#main-content" className="skip-link">Langsung ke konten utama</a>
      <span ref={topFade} className="progressive-blur app-top-fade" aria-hidden="true" />
      <Shell />
    </AuthProvider>
  )
}
