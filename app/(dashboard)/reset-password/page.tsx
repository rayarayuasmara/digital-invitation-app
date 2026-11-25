import { DashboardShell } from '@/components/DashboardShell'
import { MissingSupabaseConfig } from '@/components/MissingSupabaseConfig'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function ResetPassword() {
  return isSupabaseConfigured ? <DashboardShell route="reset-password" /> : <MissingSupabaseConfig />
}
