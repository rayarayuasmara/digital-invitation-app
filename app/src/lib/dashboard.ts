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
  groom_nickname?: string | null
  bride_nickname?: string | null
  location: string | null
  event_date: string | null
  scanner_code: string | null
  preview_token: string | null
  published_at?: string | null
  wa_templates: Templates | null
  wishes_seen_at: string | null
}

export type DashboardData = {
  client: { id: string; name: string; email: string; role: string; tier: string }
  event: DashboardEvent | null
  stats: Stats
  categories: CategoryStat[]
  guests: Guest[]
}

export type EventDetailsUpdate = {
  title: string
  date: string
  location: string
  mapsUrl: string | null
  sessions: { id?: string; name: string; time_text: string | null }[]
  /** Only sent when the host changed the address; the RPC keeps the old one otherwise. */
  slug?: string
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('get_client_dashboard_data', {})
  if (error) throw new Error(error.message)
  if (!data || data.success !== true) throw new Error('Gagal memuat data dashboard.')
  return data as DashboardData
}

export async function deleteEvent(eventId: string) {
  const { data, error } = await supabase.rpc('delete_event', { p_event_id: eventId })
  if (error || data?.success !== true) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'Acara belum bisa dihapus. Coba lagi.')
  }
}

export async function publishEvent(eventId: string): Promise<string> {
  const { data, error } = await supabase.rpc('publish_event', { p_event_id: eventId })
  if (error || data?.success !== true || typeof data.published_at !== 'string') {
    throw new Error(typeof data?.message === 'string' ? data.message : 'Undangan belum bisa diterbitkan. Coba lagi.')
  }
  return data.published_at
}

export async function fetchEventMapsUrl(eventId: string) {
  const { data, error } = await supabase.from('events').select('maps_url').eq('id', eventId).single()
  if (error) throw new Error('Tautan lokasi belum bisa dimuat.')
  return (data?.maps_url ?? null) as string | null
}

export async function saveEventDetails(eventId: string, details: EventDetailsUpdate) {
  const { data, error } = await supabase.rpc('save_event_details', {
    p_event_id: eventId,
    p_title: details.title,
    p_date: details.date,
    p_location: details.location,
    p_maps_url: details.mapsUrl,
    p_sessions: details.sessions,
    ...(details.slug ? { p_slug: details.slug } : {}),
  })
  if (error?.code === 'PGRST202') throw new Error('Penyuntingan acara belum tersedia. Hubungi dukungan.')
  if (error || data?.success !== true) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'Detail acara belum bisa disimpan. Coba lagi.')
  }
}
