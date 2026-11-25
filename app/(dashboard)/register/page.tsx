import { DashboardShell } from '@/components/DashboardShell'
import { MissingSupabaseConfig } from '@/components/MissingSupabaseConfig'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function Register() {
  return isSupabaseConfigured ? <DashboardShell route="register" /> : <MissingSupabaseConfig />
}
