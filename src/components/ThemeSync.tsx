'use client'

import { useEffect } from 'react'
import { initTheme } from '@/lib/theme'

export function ThemeSync() {
  useEffect(initTheme, [])
  return null
}
