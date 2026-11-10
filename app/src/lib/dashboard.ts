import { supabase } from './supabase'
import type { Guest } from './guests'
import type { Templates } from './whatsapp'

export type Stats = {
  total_guests: number
  max_quota: number
  tier: string
  digital: number
  cetak: number
  hadir: number
  absen: number
  pending: number
  unsent: number
  hadir_pax: number
  checked_in: number
  attending: number
  checked_pax: number
}

export type CategoryStat = {
  category: string
  total: number
  pax: number
  hadir: number
  absen: number
  pending: number
  unsent: number
}

export type DashboardEvent = {
  id: string
  slug: string
  title: string
  sessions: { id: string; name: string; time_text?: string }[] | null
  couple_name: string | null
  location: string | null
  event_date: string | null
  scanner_code: string | null
  preview_token: string | null
  wa_templates: Templates | null
}

export type DashboardData = {
  client: { id: string; name: string; email: string; role: string; tier: string }
  event: DashboardEvent | null
  stats: Stats
  categories: CategoryStat[]
  guests: Guest[]
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('get_client_dashboard_data', {})
  if (error) throw new Error(error.message)
  if (!data || data.success !== true) throw new Error('Gagal memuat data dashboard.')
  return data as DashboardData
}
