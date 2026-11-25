import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@fontsource-variable/instrument-sans'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './invitation.css'

export const metadata: Metadata = {
  title: 'Undangan Pernikahan — RayaRayu',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
  icons: '/favicon.svg',
}

export const viewport: Viewport = {
  themeColor: '#BD9F7F',
  viewportFit: 'cover',
}

export default function InvitationLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
