import { useRef, useState } from 'react'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { publishEvent, type DashboardData } from '@/lib/dashboard'
import { saveTemplates, type Templates } from '@/lib/whatsapp'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/arc/button/button'
import { Badge } from '@/components/arc/badge/badge'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { EventDetailsEditor } from './EventDetailsEditor'
import { InvitationMessages } from './InvitationMessages'
import styles from './InvitationWorkspace.module.css'

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

export function InvitationPage({ data, onShare, onChanged, notify, onOpenAccount, draft, onDraftChange, onTemplatesSaved }: Props) {
  const event = data.event!
  const [segment, setSegment] = useState('ringkasan')
  const [editing, setEditing] = useState(false)
  const editTrigger = useRef<HTMLButtonElement>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [published, setPublished] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const saved = event.wa_templates ?? {}
  const live = Boolean(event.published_at || published)
  const rows = [
    ['Judul', event.title], ['Alamat tautan', `rayarayu.id/${event.slug}`],
    ['Tanggal', event.event_date && Number.isFinite(Date.parse(event.event_date))
      ? new Date(event.event_date).toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' }) : null],
    ['Tempat', event.location], ...(event.sessions?.length ? event.sessions.map(s => [s.name, s.time_text]) : [['Sesi', null]]),
  ]
  const close = () => {
    setEditing(false)
    requestAnimationFrame(() => editTrigger.current?.focus({ preventScroll: true }))
  }
  const publish = async () => {
    if (publishing) return
    setPublishing(true)
    try {
      await publishEvent(event.id)
      setPublished(true)
      setPublishOpen(false)
      notify('Undangan berhasil diterbitkan.')
      await onChanged()
    } catch (e) { notify(e instanceof Error ? e.message : 'Undangan belum bisa diterbitkan.') }
    finally { setPublishing(false) }
  }
  const change = (category: string, value: string | null) => {
    const next = { ...(draft ?? saved) }
    if (value === null) delete next[category]
    else next[category] = value
    setError('')
    onDraftChange(Object.keys(next).length === Object.keys(saved).length && Object.entries(next).every(([k,v]) => saved[k] === v) ? null : next)
  }
  const save = async () => {
    if (!draft || saving) return
    setSaving(true)
    setError('')
    try {
      await saveTemplates(event.id, draft)
      onTemplatesSaved(draft)
      notify('Pesan WhatsApp disimpan.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Pesan belum bisa disimpan. Coba lagi.') }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader title="Undangan" account={{ name: data.client.name, onOpen: onOpenAccount }} />
    <div className={styles.workspace}>
      <SegmentedControl fullWidth label="Bagian undangan" value={segment} onValueChange={setSegment}
        options={[{ value: 'ringkasan', label: 'Ringkasan' }, { value: 'pesan', label: 'Pesan WhatsApp' }]} />
      {segment === 'pesan' ? <InvitationMessages data={data} templates={draft ?? saved} dirty={!!draft}
        busy={saving} error={error} change={change} save={save} discard={() => { setError(''); onDraftChange(null) }} /> :
        <div className={styles.panel}>
          <section className="ios-group" aria-label="Detail acara">
            <div className="ios-group-body">
              <dl className={styles.rows}>{rows.map(([label,value],i) => <div className="ios-row" key={i}>
                <dt>{label}</dt><dd>{value || 'Belum diatur'}</dd></div>)}</dl>
              <button ref={editTrigger} type="button" className={styles.editRow} onClick={() => setEditing(true)}>
                <span>Ubah detail acara</span>
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </section>
          <section className="ios-group">
            <div className={styles.heading}><h2>Publikasi</h2><Badge pill dot tone={live ? 'success' : 'warning'}>{live ? 'Live' : 'Draf'}</Badge></div>
            {!live && <div className={styles.publishCta}>
              <Dialog open={publishOpen} onOpenChange={v => { if (!publishing) setPublishOpen(v) }}>
                <DialogTrigger asChild><Button variant="accent" size="lg" fullWidth>Terbitkan undangan</Button></DialogTrigger>
                <DialogContent title="Terbitkan undangan?" description="Tamu dapat membuka undangan setelah diterbitkan. Masa aktif paket dimulai saat undangan terbit, dan alamat tautan terkunci.">
                  <div className="dialog-actions"><Button variant="accent" size="xl" fullWidth loading={publishing} onClick={publish}>Terbitkan</Button>
                    <Button variant="secondary" size="xl" fullWidth disabled={publishing} onClick={() => setPublishOpen(false)}>Batal</Button></div>
                </DialogContent></Dialog>
              <p className={styles.publishHint}>Paket aktif dimulai saat terbit. Alamat tautan tidak bisa diubah setelahnya.</p>
            </div>}
            {event.preview_token && <div className="ios-group-body">
              <a className="ios-action" href={`/pratinjau/${event.slug}/${event.preview_token}`} target="_blank" rel="noopener noreferrer">Buka pratinjau <ExternalLink size={15} aria-hidden /></a>
              <button type="button" className="ios-action" onClick={onShare}>Salin tautan pratinjau</button>
            </div>}
            <p className="ios-group-note">{live ? 'Bagikan tautan pribadi setiap tamu dari tab Tamu.' : 'Periksa pratinjau sebelum membuka akses untuk tamu.'}</p>
          </section>
        </div>}
    </div>
    {editing && <EventDetailsEditor event={event} onClose={close} onSaved={async () => { close(); notify('Detail acara disimpan.'); await onChanged() }} />}
  </>
}
