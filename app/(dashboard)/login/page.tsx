import { DashboardShell } from '@/components/DashboardShell'
import { MissingSupabaseConfig } from '@/components/MissingSupabaseConfig'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function Login() {
  return isSupabaseConfigured ? <DashboardShell route="login" /> : <MissingSupabaseConfig />
}
