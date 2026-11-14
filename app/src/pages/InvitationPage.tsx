import { useState } from 'react'
import type { DashboardData } from '@/lib/dashboard'
import { DEFAULT_TEMPLATE, TEMPLATE_VARIABLES, categoriesOf, saveTemplates } from '@/lib/whatsapp'
import type { Templates } from '@/lib/whatsapp'
import { Card } from '@/components/arc/card'

type Props = {
  data: DashboardData
  onShare: () => void
  onChanged: () => Promise<void>
  notify: (message: string) => void
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

export function InvitationPage({ data, onShare, onChanged, notify }: Props) {
  const event = data.event!
  const categories = categoriesOf(data)
  const [templates, setTemplates] = useState<Templates>(() => ({ ...(event.wa_templates ?? {}) }))
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    try {
      await saveTemplates(event.id, templates)
      await onChanged()
      notify('Template WhatsApp disimpan')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Gagal menyimpan template.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Undangan</h1>
          <p className="page-sub">Detail acara yang tampil di undangan tamu</p>
        </div>
      </div>

      <Card variant="default" padding="md">
        <p className="name" style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>{event.couple_name || event.title}</p>
        <p style={{ margin: '4px 0 0', color: 'var(--sub)' }}>{event.title}</p>
        <div style={{ marginTop: 12 }}>
          <div className="kv"><span>Tanggal</span><span>{formatDate(event.event_date)}</span></div>
          <div className="kv"><span>Lokasi</span><span style={{ textAlign: 'right' }}>{event.location || '-'}</span></div>
          {(event.sessions ?? []).map(s => (
            <div key={s.id} className="kv"><span>{s.name}</span><span>{s.time_text || '-'}</span></div>
          ))}
        </div>
      </Card>

      <h2 className="section-title">Bagikan</h2>
      <button type="button" className="btn btn-primary" onClick={onShare}>Salin tautan pratinjau</button>

      <h2 className="section-title">Template WhatsApp</h2>
      <p className="page-sub" style={{ margin: '0 4px 12px' }}>
        Dipakai saat mengirim undangan. Kategori yang belum punya template memakai template Umum.
      </p>
      <div className="chips" style={{ marginBottom: 12 }} aria-label="Variabel template">
        {TEMPLATE_VARIABLES.map(v => <span key={v} className="badge">{v}</span>)}
      </div>

      <ul className="list">
        {categories.map(c => {
          const expanded = open === c
          return (
            <li key={c}>
              <Card variant="default" padding="none" className="overflow-hidden">
                <button type="button" className="list-row" style={{ border: 0, borderRadius: 0 }} onClick={() => setOpen(expanded ? null : c)} aria-expanded={expanded}>
                  <div style={{ flex: 1 }}>
                    <p className="name">{c}</p>
                    <p className="meta">{(templates[c] || '').trim() ? 'Template kustom' : 'Memakai template Umum'}</p>
                  </div>
                  <span className="badge">{expanded ? 'Tutup' : 'Ubah'}</span>
                </button>
                {expanded && (
                  <div style={{ padding: '0 16px 16px', display: 'grid', gap: 8 }}>
                    <textarea
                      aria-label={`Template untuk ${c}`}
                      rows={9}
                      value={templates[c] ?? ''}
                      placeholder={DEFAULT_TEMPLATE}
                      onChange={e => setTemplates(t => ({ ...t, [c]: e.target.value }))}
                      style={{ width: '100%', font: 'inherit', fontSize: 'var(--text-base)', lineHeight: 1.45, padding: 'var(--space-3)', borderRadius: 'var(--radius-control)', border: '1px solid var(--line)', background: 'var(--bg-app)', color: 'var(--ink)', resize: 'vertical' }}
                    />
                    <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => setTemplates(t => { const n = { ...t }; delete n[c]; return n })}>
                      Pakai template Umum
                    </button>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={save} disabled={saving}>
        {saving ? 'Menyimpan…' : 'Simpan template'}
      </button>
    </>
  )
}
