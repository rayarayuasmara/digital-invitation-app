import { MissingSupabaseConfig } from '@/components/MissingSupabaseConfig'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ScannerRoute } from '@/screens/ScannerRoute'

export default function Scanner() {
  return isSupabaseConfigured ? <ScannerRoute /> : <MissingSupabaseConfig />
}
