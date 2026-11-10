import { supabase } from './supabase'

export type Guest = {
  id: string
  event_id: string
  group_name: string
  category: string
  max_pax: number
  phone: string | null
  invitation_token: string
  invitation_type: 'digital' | 'cetak' | null
  session: string | null
  is_sent: boolean
  is_checked_in: boolean
  rsvp_status: string | null
}

export type GuestForm = {
  name: string
  category: string
  maxPax: number
  phone: string
  invitationType: 'digital' | 'cetak'
  session: string
}

type RpcResult = { success?: boolean; message?: string }

function assertOk(data: unknown, error: { message: string } | null, fallback: string) {
  const result = data as RpcResult | null
  if (error) throw new Error(error.message)
  if (!result || result.success === false) throw new Error(result?.message || fallback)
}

export async function addGuest(eventId: string, form: GuestForm) {
  const { data, error } = await supabase.rpc('add_guest_by_client', {
    p_group_name: form.name,
    p_category: form.category,
    p_max_pax: form.maxPax,
    p_phone: form.phone,
    p_invitation_type: form.invitationType,
    p_session: form.session,
    p_event_id: eventId,
  })
  assertOk(data, error, 'Gagal menyimpan tamu.')
}

export async function updateGuest(guest: Guest, eventId: string, form: GuestForm) {
  const isPrint = form.invitationType === 'cetak'
  const { data, error } = await supabase.rpc('update_guest_by_client', {
    p_guest_id: guest.id,
    p_group_name: form.name,
    p_category: form.category,
    p_max_pax: form.maxPax,
    p_phone: form.phone,
    p_rsvp_status: isPrint ? 'hadir' : (guest.rsvp_status ?? 'pending'),
    p_is_checked_in: guest.is_checked_in,
    p_is_sent: isPrint ? true : guest.is_sent,
    p_invitation_type: form.invitationType,
    p_session: form.session,
    p_event_id: eventId,
  })
  assertOk(data, error, 'Gagal menyimpan tamu.')
}

export async function deleteGuest(guestId: string) {
  const { data, error } = await supabase.rpc('delete_guest_by_client', { p_guest_id: guestId })
  assertOk(data, error, 'Gagal menghapus tamu.')
}

export async function markSent(guestId: string) {
  const { data, error } = await supabase.rpc('update_guest_sent_status', { p_guest_id: guestId, p_is_sent: true })
  assertOk(data, error, 'Gagal memperbarui status kirim.')
}
