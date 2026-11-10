import { supabase } from './supabase'

export type ScanGuest = {
  ref: string
  group_name: string
  category: string | null
  is_checked_in: boolean
  pax_confirmed: number | null
  max_pax: number | null
}

export type CheckInResult = {
  success: boolean
  message?: string
  already_checked_in?: boolean
  guest?: ScanGuest | null
}

export function cleanToken(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
}

export function tokenFromScan(raw: string) {
  let token = raw.trim()
  if (token.includes('?token=')) {
    token = token.split('?token=')[1].split('&')[0]
  } else if (token.includes('/')) {
    const parts = token.split('?')[0].split('/').filter(Boolean)
    token = parts[parts.length - 1] ?? token
  }
  return cleanToken(token)
}

export async function verifyScannerCode(code: string): Promise<{ title: string } | null> {
  const { data, error } = await supabase.rpc('scanner_event_info', { p_code: code })
  if (error || !data || !data.success) return null
  return { title: data.event_title ?? '' }
}

export async function listScanGuests(code: string): Promise<ScanGuest[]> {
  const { data, error } = await supabase.rpc('scanner_list_guests', { p_code: code })
  if (error || !data || !data.success) throw new Error('Gagal memuat daftar tamu. Kode akses mungkin sudah diganti pemilik acara.')
  return (data.guests ?? []) as ScanGuest[]
}

export async function checkIn(code: string, input: string): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc('scanner_check_in', { p_code: code, p_input: cleanToken(input) })
  if (error || !data) {
    return { success: false, message: error?.message || 'Tidak dapat menghubungi server. Periksa sinyal lalu coba lagi.' }
  }
  return data as CheckInResult
}
