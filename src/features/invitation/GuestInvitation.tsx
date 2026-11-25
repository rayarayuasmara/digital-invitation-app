import { MissingSupabaseConfig } from '@/components/MissingSupabaseConfig'
import { isSupabaseConfigured } from '@/lib/supabase'
import { InvitationMarkup } from './InvitationMarkup'
import { InvitationRuntime } from './InvitationRuntime'

export function GuestInvitation({ token, preview = false }: { token?: string; preview?: boolean }) {
  if (!isSupabaseConfigured) return <MissingSupabaseConfig />

  return (
    <InvitationRuntime token={token ?? ''} preview={preview}>
      <InvitationMarkup />
    </InvitationRuntime>
  )
}
