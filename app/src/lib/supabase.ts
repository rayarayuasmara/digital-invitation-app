import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

function showMissingConfig(missing: string[]) {
  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <div role="alert" style="font-family: ui-sans-serif, system-ui, sans-serif; color: #1c1c1e; background: #f2f2f7; min-height: 100vh; display: grid; place-items: center; padding: 24px;">
      <div style="max-width: 30rem; background: #fff; border: 1px solid #d1d1d6; border-radius: 16px; padding: 24px;">
        <h1 style="font-size: 1.125rem; margin: 0 0 12px;">Konfigurasi Supabase belum lengkap</h1>
        <p style="margin: 0 0 12px; line-height: 1.5;">
          Variabel berikut kosong: <strong>${missing.join(', ')}</strong>
        </p>
        <p style="margin: 0 0 8px; line-height: 1.5;">Untuk kerja lokal:</p>
        <pre style="margin: 0 0 16px; padding: 12px; background: #f2f2f7; border-radius: 8px; font-size: 0.8125rem; overflow-x: auto;">cp .env.example .env
# lalu isi dua nilainya dari dashboard Supabase</pre>
        <p style="margin: 0; line-height: 1.5;">
          Untuk deploy, isi variabel yang sama di Vercel (Production, Preview, Development)
          lalu redeploy — mengubah environment tidak membangun ulang otomatis.
        </p>
      </div>
    </div>
  `
}

if (!url || !key) {
  const missing = [
    ...(url ? [] : ['VITE_SUPABASE_URL']),
    ...(key ? [] : ['VITE_SUPABASE_PUBLISHABLE_KEY']),
  ]

  showMissingConfig(missing)
  throw new Error(`Konfigurasi Supabase belum lengkap: ${missing.join(', ')}`)
}

export const supabase = createClient(url, key)
