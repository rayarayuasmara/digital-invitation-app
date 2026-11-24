import { useState } from 'react'
import { publishEvent, type DashboardData } from '@/lib/dashboard'
import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { DEFAULT_TEMPLATE, TEMPLATE_VARIABLES, categoriesOf, saveTemplates } from '@/lib/whatsapp'
import type { Templates } from '@/lib/whatsapp'
import { Button } from '@/components/arc/button/button'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/arc/card'
import { Badge } from '@/components/arc/badge/badge'
import { ExpandableCard } from '@/components/arc/expandable-card/expandable-card'
import { EventDetailsEditor } from '@/pages/EventDetailsEditor'

type Props = {
  data: DashboardData
  onShare: () => void
  onChanged: () => Promise<void>
  notify: (message: string) => void
  onOpenAccount: () => void
  draft: Templates | null
  onDraftChange: (templates: Templates | null) => void
  onTemplatesSaved: (templates: Templates) => void
}

function formatDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Belum diatur'
  return new Date(value).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

export function InvitationPage({ data, onShare, onChanged, notify, onOpenAccount, draft, onDraftChange, onTemplatesSaved }: Props) {
  const event = data.event!
  const categories = categoriesOf(data)
  const templates = draft ?? event.wa_templates ?? {}
  const [saving, setSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [saveError, setSaveError] = useState('')
  const previewUrl = event.preview_token ? `/pratinjau/${event.slug}/${event.preview_token}` : null

  const publish = async () => {
    if (publishing) return
    setPublishing(true)
    try {
      await publishEvent(event.id)
      setPublished(true)
      setPublishOpen(false)
      notify('Undangan berhasil diterbitkan.')
      await onChanged()
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Undangan belum bisa diterbitkan.')
    } finally {
      setPublishing(false)
    }
  }

  const save = async () => {
    if (!draft || saving) return
    setSaving(true)
    setSaveError('')
    try {
      await saveTemplates(event.id, draft)
      onTemplatesSaved(draft)
      notify('Template WhatsApp disimpan')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Template belum bisa disimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const changeTemplate = (category: string, value: string) => {
    setSaveError('')
    const next = { ...templates }
    if (value) next[category] = value
    else delete next[category]
    const saved = event.wa_templates ?? {}
    const sameAsSaved = Object.keys(next).length === Object.keys(saved).length &&
      Object.entries(next).every(([key, text]) => saved[key] === text)
    onDraftChange(sameAsSaved ? null : next)
  }

  return (
    <>
      <PageHeader
        title="Undangan"
        subtitle={<p className="page-sub">Detail acara yang tampil di undangan tamu</p>}
        account={{ name: data.client.name, onOpen: onOpenAccount }}
      />

      <Card variant="default" padding="md">
        <div className="invitation-detail">
          <h2>{event.title}</h2>
          {event.couple_name && event.couple_name !== event.title && <p className="page-sub">{event.couple_name}</p>}
          <dl>
          <div className="kv"><dt>Tanggal</dt><dd>{formatDate(event.event_date)}</dd></div>
          <div className="kv"><dt>Lokasi</dt><dd>{event.location || 'Belum diatur'}</dd></div>
          {(event.sessions ?? []).map(s => (
            <div key={s.id} className="kv"><dt>{s.name}</dt><dd>{s.time_text || 'Belum diatur'}</dd></div>
          ))}
          </dl>
          <EventDetailsEditor event={event} onSaved={async () => {
            notify('Detail acara disimpan.')
            await onChanged()
          }} />
        </div>
      </Card>

      <h2 className="section-title">Publikasi</h2>
      {event.published_at || published ? (
        <p className="page-sub">Undangan sudah terbit.</p>
      ) : (
        <Dialog open={publishOpen} onOpenChange={next => { if (!publishing) setPublishOpen(next) }}>
          <DialogTrigger asChild>
            <Button type="button" variant="accent" size="xl" fullWidth>Terbitkan undangan</Button>
          </DialogTrigger>
          <DialogContent title="Terbitkan undangan?" description="Tamu dapat membuka tautan undangan setelah diterbitkan. Masa aktif paket dimulai saat undangan terbit.">
            <div className="dialog-actions">
              <Button type="button" variant="accent" size="xl" fullWidth loading={publishing} onClick={publish}>Terbitkan</Button>
              <Button type="button" variant="accentOutline" size="xl" fullWidth disabled={publishing} onClick={() => setPublishOpen(false)}>Batal</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <h2 className="section-title">Pratinjau</h2>
      {previewUrl ? (
        <div className="invitation-preview-actions">
          <a className="dashboard-inline-link" href={previewUrl} target="_blank" rel="noopener noreferrer">Buka pratinjau undangan</a>
          <Button type="button" variant="secondary" size="md" onClick={onShare}>Salin tautan pratinjau</Button>
        </div>
      ) : <p className="page-sub">Tautan pratinjau belum tersedia.</p>}

      <h2 className="section-title">Template WhatsApp</h2>
      <p className="page-sub" style={{ margin: '0 4px 12px' }}>
        Dipakai saat mengirim undangan. Kategori yang belum punya template memakai template Umum.
      </p>
      <div className="chips invitation-variables" role="group" aria-label="Variabel template">
        {TEMPLATE_VARIABLES.map(v => <Badge key={v} size="sm" pill><code translate="no">{v}</code></Badge>)}
      </div>

      <ul className="list">
        {categories.map(c => (
            <li key={c}>
              <ExpandableCard title={c} description={(templates[c] || '').trim() ? 'Template khusus' : c === 'Umum' ? 'Template bawaan' : 'Memakai template Umum'}>
                  <div className="invitation-template-editor">
                    <textarea
                      aria-label={`Template untuk ${c}`}
                      name={`template-${c}`}
                      autoComplete="off"
                      rows={9}
                      value={templates[c] ?? ''}
                      placeholder={(c !== 'Umum' && templates.Umum?.trim()) || DEFAULT_TEMPLATE}
                      disabled={saving}
                      onChange={e => changeTemplate(c, e.target.value)}
                    />
                    <Button type="button" variant="accentOutline" size="md" fullWidth disabled={saving || !templates[c]} onClick={() => changeTemplate(c, '')}>
                      {c === 'Umum' ? 'Pakai template bawaan' : 'Pakai template Umum'}
                    </Button>
                  </div>
              </ExpandableCard>
            </li>
        ))}
      </ul>

      <div className="invitation-template-actions">
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        {draft && <p className="page-sub" role="status">Ada perubahan template yang belum disimpan.</p>}
        <Button type="button" variant="accent" size="xl" fullWidth onClick={save} disabled={!draft} loading={saving}>Simpan template</Button>
        {draft && <Button type="button" variant="ghost" size="md" disabled={saving} onClick={() => {
          setSaveError('')
          onDraftChange(null)
        }}>Buang perubahan</Button>}
      </div>
    </>
  )
}
