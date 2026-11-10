import { supabase } from './supabase'

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
  title: string
  couple_name: string | null
  location: string | null
  event_date: string | null
  scanner_code: string | null
}

export type DashboardData = {
  client: { id: string; name: string; email: string; role: string; tier: string }
  event: DashboardEvent | null
  stats: Stats
  categories: CategoryStat[]
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('get_client_dashboard_data', {})
  if (error) throw new Error(error.message)
  if (!data || data.success !== true) throw new Error('Gagal memuat data dashboard.')
  return data as DashboardData
}
