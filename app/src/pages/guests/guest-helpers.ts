import type { BadgeTone } from '@/components/arc/badge/badge'
import type { Guest, GuestForm } from '@/lib/guests'

export type GuestStatus = 'semua' | 'hadir' | 'tidak_hadir' | 'pending' | 'belum_terkirim' | 'check_in'
export type Status = GuestStatus
export type SortKey = 'nama' | 'dibuat' | 'diubah'

export const statusTabs: { value: Status; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'tidak_hadir', label: 'Absen' },
  { value: 'pending', label: 'Pending' },
  { value: 'belum_terkirim', label: 'Unsent' },
  { value: 'check_in', label: 'Check-in' },
]

export const typeOptions = [
  { value: 'digital', label: 'Digital' },
  { value: 'cetak', label: 'Cetak' },
]

export const sortFields: { value: SortKey; label: string; asc: string; desc: string }[] = [
  { value: 'nama', label: 'Nama', asc: 'A–Z', desc: 'Z–A' },
  { value: 'dibuat', label: 'Ditambahkan', asc: 'Terlama dulu', desc: 'Terbaru dulu' },
  { value: 'diubah', label: 'Update', asc: 'Terlama dulu', desc: 'Terbaru dulu' },
]

export const emptyForm: GuestForm = { name: '', category: 'Umum', maxPax: 1, phone: '', invitationType: 'digital', session: '' }

export function matches(g: Guest, f: Status) {
  if (f === 'semua') return true
  if (f === 'hadir') return g.rsvp_status === 'hadir'
  if (f === 'tidak_hadir') return g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen'
  if (f === 'pending') return (!g.rsvp_status || g.rsvp_status === 'pending') && g.is_sent
  if (f === 'belum_terkirim') return !g.is_sent
  return g.is_checked_in
}

export function statusOf(g: Guest): { text: string; tone: BadgeTone } {
  if (g.is_checked_in) return { text: 'Check-in', tone: 'info' }
  if (g.rsvp_status === 'hadir') return { text: 'Hadir', tone: 'success' }
  if (g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen') return { text: 'Absen', tone: 'danger' }
  if (!g.is_sent) return { text: 'Unsent', tone: 'neutral' }
  return { text: 'Pending', tone: 'warning' }
}
