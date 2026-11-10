import { supabase } from './supabase'
import type { DashboardEvent, DashboardData } from './dashboard'
import type { Guest } from './guests'

export const DEFAULT_TEMPLATE = `Halo *{nama}*,\n\nKami mengundang Anda untuk menghadiri acara *{acara}* pada:\n\n🗓 {tanggal}\n🕙 {waktu}\n📍 {lokasi}\n\nSilakan kunjungi tautan berikut:\n{link}`

export const TEMPLATE_VARIABLES = ['{nama}', '{acara}', '{tanggal}', '{waktu}', '{sesi}', '{lokasi}', '{link}']

export type Templates = Record<string, string>

export function guestLink(event: DashboardEvent, guest: Guest) {
  return `${window.location.origin}/${event.slug}/${guest.invitation_token}`
}

function sessionOf(event: DashboardEvent, guest: Guest) {
  const sessions = event.sessions ?? []
  const name = guest.session || sessions[0]?.name || 'Sesi 1'
  const match = sessions.find(s => s.name === name) ?? sessions[0]
  return { name, time: match?.time_text ?? '' }
}

export function fillTemplate(template: string, event: DashboardEvent, guest: Guest) {
  const date = event.event_date
    ? new Date(event.event_date).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
      })
    : ''
  const session = sessionOf(event, guest)
  return template
    .replaceAll('{nama}', guest.group_name)
    .replaceAll('{link}', guestLink(event, guest))
    .replaceAll('{acara}', event.title ?? '')
    .replaceAll('{tanggal}', date)
    .replaceAll('{waktu}', session.time)
    .replaceAll('{sesi}', session.name)
    .replaceAll('{lokasi}', event.location ?? '')
}

export function messageFor(event: DashboardEvent, templates: Templates | null, guest: Guest) {
  const map = templates ?? {}
  const category = guest.category || 'Umum'
  const template = (map[category] || '').trim() || (map['Umum'] || '').trim() || DEFAULT_TEMPLATE
  return fillTemplate(template, event, guest)
}

/** Indonesian numbers to international format, or '' when the number is not usable. */
export function normalizePhone(value: string | null | undefined) {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  else if (digits.startsWith('8')) digits = '62' + digits
  return /^62\d{8,14}$/.test(digits) ? digits : ''
}

export function openWhatsApp(phone: string, message: string) {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const text = encodeURIComponent(message)
  const url = isMobile
    ? `https://wa.me/${phone}?text=${text}`
    : `https://web.whatsapp.com/send?phone=${phone}&text=${text}`
  window.open(url, '_blank', 'noopener')
}

export async function saveTemplates(eventId: string, templates: Templates) {
  const { error } = await supabase.from('events').update({ wa_templates: templates }).eq('id', eventId)
  if (error) throw new Error(error.message)
}

export function categoriesOf(data: DashboardData) {
  const set = new Set(['Umum', ...data.categories.map(c => c.category)])
  return [...set]
}
