import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

let client: SupabaseClient | undefined

export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error('Konfigurasi Supabase belum lengkap')
  return (client ??= createClient(url, key))
}
