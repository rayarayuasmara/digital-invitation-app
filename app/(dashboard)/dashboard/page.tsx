import { DashboardShell } from '@/components/DashboardShell'
import { MissingSupabaseConfig } from '@/components/MissingSupabaseConfig'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function Dashboard() {
  return isSupabaseConfigured ? <DashboardShell route="dashboard" /> : <MissingSupabaseConfig />
}
