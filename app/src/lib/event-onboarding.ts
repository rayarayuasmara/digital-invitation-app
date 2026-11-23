import { supabase } from './supabase'

export type CoupleDetails = {
  groomName: string
  groomNickname: string
  groomFather: string
  groomMother: string
  brideName: string
  brideNickname: string
  brideFather: string
  brideMother: string
}

export type FirstEventInput = {
  coupleName: string
  couple: CoupleDetails
  title: string
  slug: string
  date: string
  location: string
  mapsUrl: string
  sessions: { name: string; time: string }[]
}

export class CreateEventError extends Error {
  readonly field?: 'slug'

  constructor(message: string, field?: 'slug') {
    super(message)
    this.field = field
  }
}

export function suggestEventSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function normalizeMapsUrl(value: string) {
  const candidate = value.match(/https:\/\/[^\s<>]+/i)?.[0] ?? value.trim()
  if (!candidate) return ''
  const url = /^https:\/\//i.test(candidate) ? candidate : `https://${candidate}`
  try {
    const parsed = new URL(url)
    if (parsed.username || parsed.password || parsed.port) return ''
    const host = parsed.hostname
    const path = parsed.pathname
    if (host === 'maps.app.goo.gl' && path.length > 1) return parsed.href
    if (host === 'share.google' && path.length > 1) return parsed.href
    if (host === 'goo.gl' && path.startsWith('/maps/')) return parsed.href
    if (host === 'maps.google.com' || host === 'maps.google.co.id') return parsed.href
    if (/^(www\.)?google\.(com|co\.id)$/.test(host) && /^\/maps(?:\/|$)/.test(path)) return parsed.href
  } catch {
    return ''
  }
  return ''
}

export async function checkEventSlug(slug: string) {
  const { data, error } = await supabase.rpc('check_event_slug_available', { p_slug: slug })
  if (error || data?.success !== true || typeof data?.available !== 'boolean') throw new Error('slug-check-failed')
  return data.available as boolean
}

export async function createFirstEvent(input: FirstEventInput) {
  const { couple } = input
  const mapsUrl = normalizeMapsUrl(input.mapsUrl)
  const { data, error } = await supabase.rpc(mapsUrl ? 'create_event_with_map' : 'create_event', {
    ...(mapsUrl ? { p_maps_url: mapsUrl } : {}),
    p_title: input.title.trim(),
    p_event_date: input.date,
    p_location: input.location.trim(),
    p_couple_name: input.coupleName.trim(),
    p_slug: input.slug,
    p_sessions: input.sessions.map(({ name, time }) => ({ name: name.trim(), time_text: time ? `${time.replace(':', '.')} WIB` : null })),
    p_couple: {
      groom_name: couple.groomName.trim(),
      groom_nickname: couple.groomNickname.trim(),
      groom_father: couple.groomFather.trim(),
      groom_mother: couple.groomMother.trim(),
      bride_name: couple.brideName.trim(),
      bride_nickname: couple.brideNickname.trim(),
      bride_father: couple.brideFather.trim(),
      bride_mother: couple.brideMother.trim(),
    },
  })

  if (!error && data?.success === true) return

  const serverMessage = typeof data?.message === 'string' ? data.message : ''
  if (error?.code === 'PGRST202' && mapsUrl) throw new CreateEventError('Penyimpanan tautan Google Maps belum tersedia.')
  if (/Google Maps/i.test(serverMessage)) throw new CreateEventError(serverMessage)
  if (/slug|alamat tautan/i.test(serverMessage) || (error?.code === '23505' && /slug/i.test(error.message))) {
    throw new CreateEventError('Alamat tautan tidak tersedia. Coba alamat lain.', 'slug')
  }

  if (/batas acara/i.test(serverMessage)) {
    throw new CreateEventError('Batas acara untuk paket Anda sudah tercapai. Jika acara tadi sudah tersimpan, coba muat ulang dashboard.')
  }

  throw new CreateEventError('Acara belum bisa dikonfirmasi. Periksa koneksi dan coba lagi.')
}
