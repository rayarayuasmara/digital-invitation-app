import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { Input } from '@/components/arc/input/input'
import { fetchEventMapsUrl, saveEventDetails, type DashboardEvent } from '@/lib/dashboard'
import { normalizeLocationUrl } from '@/lib/event-onboarding'

type Props = {
  event: DashboardEvent
  onSaved: () => Promise<void>
}

type Session = { key: string; id?: string; name: string; time: string }
const newSession = (index: number): Session => ({ key: `baru-${index}`, name: '', time: '' })
const jakartaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' })

export function EventDetailsEditor({ event, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next) }}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="md">Ubah detail acara</Button>
      </DialogTrigger>
      {open && (
        <DialogContent title="Ubah detail acara" description="Perubahan akan terlihat di pratinjau dan undangan yang sudah terbit. Alamat tautan tetap sama.">
          <EventDetailsForm event={event} busy={busy} setBusy={setBusy} onCancel={() => setOpen(false)} onSaved={async () => {
            setOpen(false)
            await onSaved()
          }} />
        </DialogContent>
      )}
    </Dialog>
  )
}

function EventDetailsForm({ event, onSaved, onCancel, busy, setBusy }: Props & {
  onCancel: () => void
  busy: boolean
  setBusy: (value: boolean) => void
}) {
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.event_date ?? '')) return event.event_date!
    const value = Date.parse(event.event_date ?? '')
    return Number.isFinite(value) ? jakartaDate.format(value) : ''
  })
  const [location, setLocation] = useState(event.location ?? '')
  const [maps, setMaps] = useState('')
  const [initialMaps, setInitialMaps] = useState<string | null>(null)
  const [mapsStatus, setMapsStatus] = useState<'loading' | 'failed' | 'ready'>('loading')
  const [retry, setRetry] = useState(0)
  const nextSession = useRef(1)
  const [sessions, setSessions] = useState<Session[]>(() => event.sessions?.length
    ? event.sessions.map(s => ({ key: s.id, id: s.id, name: s.name, time: s.time_text ?? '' }))
    : [newSession(0)])
  const [error, setError] = useState('')
  const [mapsError, setMapsError] = useState('')

  useEffect(() => {
    let active = true
    fetchEventMapsUrl(event.id).then(value => {
      if (!active) return
      setInitialMaps(value)
      setMaps(value ?? '')
      setMapsStatus('ready')
    }).catch(() => { if (active) setMapsStatus('failed') })
    return () => { active = false }
  }, [event.id, retry])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (busy) return
    setError('')
    const normalizedMaps = normalizeLocationUrl(maps)
    const mapsChanged = mapsStatus === 'ready' && maps.trim() !== (initialMaps ?? '').trim()
    if (mapsChanged && maps.trim() && !normalizedMaps) {
      setMapsError('Masukkan tautan yang dimulai dengan https:// atau http://.')
      e.currentTarget.querySelector<HTMLInputElement>('input[name="maps"]')?.focus()
      return
    }
    const names = sessions.map(s => s.name.trim())
    if (!title.trim() || !location.trim() || names.some(name => !name)) {
      setError('Isi judul, lokasi, dan nama setiap sesi.')
      return
    }
    if (new Set(names.map(name => name.toLowerCase())).size !== names.length) {
      setError('Gunakan nama yang berbeda untuk setiap sesi.')
      return
    }
    setBusy(true)
    try {
      await saveEventDetails(event.id, {
        title: title.trim(), date, location: location.trim(),
        mapsUrl: mapsChanged ? normalizedMaps : null,
        sessions: sessions.map(({ id, name, time }) => ({ id, name: name.trim(), time_text: time.trim() || null })),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Detail acara belum bisa disimpan.')
      setBusy(false)
      return
    }
    setBusy(false)
    await onSaved()
  }

  const editSession = (key: string, update: Partial<Pick<Session, 'name' | 'time'>>) =>
    setSessions(current => current.map(session => session.key === key ? { ...session, ...update } : session))

  return (
    <form className="event-details-form" onSubmit={submit} aria-busy={busy}>
      <Input name="judul" label="Judul acara" value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} />
      <Input name="tanggal" type="date" label="Tanggal acara" value={date} onChange={e => setDate(e.target.value)} required />
      <Input name="lokasi" label="Nama atau alamat lokasi" value={location} onChange={e => setLocation(e.target.value)} required maxLength={300} />
      <Input name="maps" label="Tautan lokasi (opsional)" type="url" inputMode="url" autoComplete="off" value={maps}
        onChange={e => { setMaps(e.target.value); setMapsError('') }} disabled={mapsStatus !== 'ready'} error={mapsError} />
      {mapsStatus === 'loading' && <p className="page-sub" role="status">Memuat tautan lokasi…</p>}
      {mapsStatus === 'failed' && (
        <div className="event-details-maps-note">
          <p className="page-sub" role="status">Tautan lokasi belum bisa dimuat dan tidak akan diubah.</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => { setMapsStatus('loading'); setRetry(value => value + 1) }}>Coba lagi</Button>
        </div>
      )}
      <fieldset className="event-details-sessions">
        <legend>Sesi acara</legend>
        <p className="page-sub">Jika sesi dihapus, tamunya dipindahkan ke sesi pertama.</p>
        {sessions.map((session, i) => (
          <div key={session.key} className="event-details-session">
            <Input name={`sesi-${i + 1}`} label={`Nama sesi ${i + 1}`} value={session.name} onChange={e => editSession(session.key, { name: e.target.value })} required maxLength={80} />
            <Input name={`waktu-${i + 1}`} label={`Waktu sesi ${i + 1} (opsional)`} value={session.time} onChange={e => editSession(session.key, { time: e.target.value })} placeholder="Contoh: 10.00 WIB…" maxLength={80} />
            {sessions.length > 1 && (
              <Button type="button" size="sm" variant="dangerSoft" disabled={busy}
                onClick={() => setSessions(current => current.filter(item => item.key !== session.key))}>Hapus sesi {i + 1}</Button>
            )}
          </div>
        ))}
        {sessions.length < 3 && <Button type="button" variant="secondary" size="md" disabled={busy} onClick={() => {
          const session = newSession(nextSession.current++)
          setSessions(current => [...current, session])
        }}>Tambah sesi</Button>}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button type="submit" variant="accent" size="xl" fullWidth loading={busy}>Simpan detail acara</Button>
        <Button type="button" variant="accentOutline" size="xl" fullWidth disabled={busy} onClick={onCancel}>Batal</Button>
      </div>
    </form>
  )
}
