import { useState } from 'react'
import { CalendarDays, Clock3, ExternalLink, Link2, MapPin } from 'lucide-react'
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
  return new Date(value).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

function templateState(category: string, templates: Templates) {
  if ((templates[category] ?? '').trim()) return 'Template khusus'
  return category === 'Umum' ? 'Template bawaan' : 'Memakai template Umum'
}

export function InvitationPage({ data, onShare, onChanged, notify, onOpenAccount, draft, onDraftChange, onTemplatesSaved }: Props) {
  const event = data.event!
  const categories = categoriesOf(data)
  const templates = draft ?? event.wa_templates ?? {}
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [saveError, setSaveError] = useState('')
  const previewUrl = event.preview_token ? `/pratinjau/${event.slug}/${event.preview_token}` : null
  const isPublished = Boolean(event.published_at || published)
  const hasSessions = (event.sessions ?? []).length > 0

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
        subtitle={<p className="page-sub">Kelola publikasi, tautan, dan detail acara</p>}
        account={{ name: data.client.name, onOpen: onOpenAccount }}
      />

      <div className="invitation-stack">
        <Card variant="default" padding="md" className="invitation-hero">
          <div className="invitation-hero-top">
            <div className="invitation-hero-copy">
              <p className="invitation-hero-halo">Undangan tamu</p>
              <h2 className="invitation-hero-title">{event.title}</h2>
              {event.couple_name && event.couple_name !== event.title && (
                <p className="invitation-hero-couple">{event.couple_name}</p>
              )}
            </div>
            <Badge size="md" pill dot tone={isPublished ? 'success' : 'warning'}>
              {isPublished ? 'Terbit' : 'Draf'}
            </Badge>
          </div>

          <div className="invitation-link-row">
            <Link2 size={16} strokeWidth={1.9} aria-hidden />
            <span className="invitation-link-url">rayarayu.id/{event.slug}</span>
            {previewUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-label="Salin tautan pratinjau"
                onClick={onShare}
              >
                Salin
              </Button>
            )}
          </div>

          <p className="invitation-hero-note">
            {isPublished
              ? `Undangan sudah terbit${event.published_at ? ` sejak ${formatDate(event.published_at)}` : ''}. Tamu bisa membuka tautan yang Anda kirim.`
              : 'Undangan masih draf. Terbitkan agar tamu bisa membuka tautan undangan.'}
          </p>

          <div className="invitation-hero-actions">
            {previewUrl && (
              <a className="invitation-preview-link" href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={15} strokeWidth={2} aria-hidden />
                Buka pratinjau
                <span className="sr-only"> (tab baru)</span>
              </a>
            )}
            {!isPublished && (
              <Dialog open={publishOpen} onOpenChange={next => { if (!publishing) setPublishOpen(next) }}>
                <DialogTrigger asChild>
                  <Button type="button" variant="accent" size="md" fullWidth>Terbitkan undangan</Button>
                </DialogTrigger>
                <DialogContent title="Terbitkan undangan?" description="Tamu dapat membuka tautan undangan setelah diterbitkan. Masa aktif paket dimulai saat undangan terbit.">
                  <div className="dialog-actions">
                    <Button type="button" variant="accent" size="xl" fullWidth loading={publishing} onClick={publish}>Terbitkan</Button>
                    <Button type="button" variant="accentOutline" size="xl" fullWidth disabled={publishing} onClick={() => setPublishOpen(false)}>Batal</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </Card>

        <Card variant="default" padding="md" className="invitation-card">
          <div className="invitation-card-head">
            <div>
              <h3>Detail acara</h3>
              <p className="invitation-card-sub">Tampil di undangan tamu</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>Ubah</Button>
          </div>

          <dl className="invitation-detail-list">
            <div>
              <dt><CalendarDays size={15} strokeWidth={1.9} aria-hidden />Tanggal</dt>
              <dd>{formatDate(event.event_date)}</dd>
            </div>
            <div>
              <dt><MapPin size={15} strokeWidth={1.9} aria-hidden />Lokasi</dt>
              <dd>{event.location || 'Belum diatur'}</dd>
            </div>
            {(event.sessions ?? []).map(session => (
              <div key={session.id}>
                <dt><Clock3 size={15} strokeWidth={1.9} aria-hidden />{session.name}</dt>
                <dd>{session.time_text || 'Belum diatur'}</dd>
              </div>
            ))}
          </dl>

          {!hasSessions && (
            <p className="invitation-card-note">Belum ada sesi acara. Tambahkan sesi lewat tombol Ubah.</p>
          )}
        </Card>

        <Card variant="default" padding="md" className="invitation-card">
          <div className="invitation-card-head">
            <div>
              <h3>Template WhatsApp</h3>
              <p className="invitation-card-sub">Pesan yang dipakai saat mengirim undangan</p>
            </div>
            {draft && <Badge size="sm" pill dot tone="warning">Belum disimpan</Badge>}
          </div>

          <div className="chips invitation-variables" role="group" aria-label="Variabel template">
            {TEMPLATE_VARIABLES.map(variable => (
              <Badge key={variable} size="sm" pill><code translate="no">{variable}</code></Badge>
            ))}
          </div>
          <p className="invitation-card-note">
            Kategori yang belum punya template memakai template Umum.
          </p>

          <div className="invitation-templates">
            {categories.map(category => (
              <ExpandableCard key={category} title={category} description={templateState(category, templates)}>
                <div className="invitation-template-editor">
                  <textarea
                    aria-label={`Template untuk ${category}`}
                    name={`template-${category}`}
                    autoComplete="off"
                    rows={9}
                    value={templates[category] ?? ''}
                    placeholder={(category !== 'Umum' && templates.Umum?.trim()) || DEFAULT_TEMPLATE}
                    disabled={saving}
                    onChange={e => changeTemplate(category, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="accentOutline"
                    size="md"
                    fullWidth
                    disabled={saving || !templates[category]}
                    onClick={() => changeTemplate(category, '')}
                  >
                    {category === 'Umum' ? 'Pakai template bawaan' : 'Pakai template Umum'}
                  </Button>
                </div>
              </ExpandableCard>
            ))}
          </div>

          <div className="invitation-save">
            {saveError && <p className="form-error" role="alert">{saveError}</p>}
            {draft && <p className="page-sub" role="status">Ada perubahan template yang belum disimpan.</p>}
            <Button type="button" variant="accent" size="xl" fullWidth onClick={save} disabled={!draft} loading={saving}>
              Simpan template
            </Button>
            {draft && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                fullWidth
                disabled={saving}
                onClick={() => { setSaveError(''); onDraftChange(null) }}
              >
                Buang perubahan
              </Button>
            )}
          </div>
        </Card>
      </div>

      {editing && (
        <EventDetailsEditor
          event={event}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false)
            notify('Detail acara disimpan.')
            await onChanged()
          }}
        />
      )}
    </>
  )
}
