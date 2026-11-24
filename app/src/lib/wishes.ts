import { supabase } from './supabase'

export type Wish = {
  id: string
  guest_id: string | null
  guest_name: string | null
  message: string
  created_at: string
}

export type WishSummary = {
  wishes: Wish[]
  total: number
  unread: number
}

export async function fetchWishesPage(eventId: string, limit: number, offset = 0) {
  const { data, error } = await supabase
    .from('wishes')
    .select('id, guest_id, guest_name, message, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return (data ?? []) as Wish[]
}

export async function fetchWishes(eventId: string, seenAt: string | null, limit = 3): Promise<WishSummary> {
  const base = () => supabase.from('wishes').select('id', { count: 'exact', head: true }).eq('event_id', eventId)

  const [list, total, unseen] = await Promise.all([
    fetchWishesPage(eventId, limit),
    base(),
    seenAt ? base().gt('created_at', seenAt) : Promise.resolve(null),
  ])

  const totalCount = total.count ?? list.length
  const unread = seenAt ? (unseen?.count ?? 0) : totalCount
  return { wishes: list, total: totalCount, unread }
}

export async function markWishesSeen(eventId: string) {
  const { error } = await supabase.from('events').update({ wishes_seen_at: new Date().toISOString() }).eq('id', eventId)
  if (error) throw new Error(error.message)
}
