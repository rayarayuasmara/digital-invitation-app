'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { getSupabase } from '@/lib/supabase'
import { mountInvitation } from './mount-invitation'

export function InvitationRuntime({ token, preview, children }: {
  token: string
  preview: boolean
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!root.current) return
    return mountInvitation(root.current, getSupabase(), token, preview)
  }, [token, preview])

  return <div ref={root}>{children}</div>
}
