import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@fontsource-variable/inter'
import '@/components/arc/foundation.css'
import '@/index.css'
import '@/styles/tokens.css'
import '@/styles/app.css'
import '@/styles/theme.css'
import '@/styles/tailwind.css'
import { ThemeSync } from '@/components/ThemeSync'

export const metadata: Metadata = {
  title: 'RayaRayu — Panel Klien',
  icons: '/favicon.svg',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#f2f2f7',
  viewportFit: 'cover',
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <ThemeSync />
        <a href="#main-content" className="skip-link">Langsung ke konten utama</a>
        {children}
      </body>
    </html>
  )
}
