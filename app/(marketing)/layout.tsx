import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@fontsource-variable/plus-jakarta-sans'
import './marketing.css'

export const metadata: Metadata = {
  title: 'RayaRayu - Platform Undangan Digital Eksklusif',
  icons: '/favicon.svg',
}

export const viewport: Viewport = { themeColor: '#0f172a' }

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-900 text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  )
}
