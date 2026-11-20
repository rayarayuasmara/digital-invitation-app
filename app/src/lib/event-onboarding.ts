import { supabase } from './supabase'

export type FirstEventInput = {
  coupleName: string
  title: string
  slug: string
  date: string
  location: string
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

export async function createFirstEvent(input: FirstEventInput) {
  const { data, error } = await supabase.rpc('create_event', {
    p_title: input.title.trim(),
    p_event_date: input.date,
    p_location: input.location.trim(),
    p_couple_name: input.coupleName.trim(),
    p_slug: input.slug,
    p_sessions: input.sessions.map(({ name, time }) => ({ name: name.trim(), time_text: time ? `${time.replace(':', '.')} WIB` : null })),
  })

  if (!error && data?.success === true) return

  const serverMessage = typeof data?.message === 'string' ? data.message : ''
  if (/slug|alamat tautan/i.test(serverMessage) || (error?.code === '23505' && /slug/i.test(error.message))) {
    throw new CreateEventError('Alamat tautan tidak tersedia. Coba alamat lain.', 'slug')
  }

  if (/batas acara/i.test(serverMessage)) {
    throw new CreateEventError('Batas acara untuk paket Anda sudah tercapai. Jika acara tadi sudah tersimpan, coba muat ulang dashboard.')
  }

  throw new CreateEventError('Acara belum bisa dikonfirmasi. Periksa koneksi dan coba lagi.')
}
