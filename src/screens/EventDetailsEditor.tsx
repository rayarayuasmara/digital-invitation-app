import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { fetchEventMapsUrl, saveEventDetails, type DashboardEvent } from '@/lib/dashboard'
import { checkEventSlug, normalizeLocationUrl, suggestEventSlug } from '@/lib/event-onboarding'
import styles from './EventDetailsEditor.module.css'

const LINK_PREFIX = 'rayarayu.id/'
const DEFAULT_TIME = '10:00'
const jakartaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' })

type Session = { key: string; id?: string; name: string; time: string }

type Props = {
  event: DashboardEvent
  onClose: () => void
  onSaved: () => Promise<void>
}

const splitLocation = (value: string | null) => {
  const text = (value ?? '').trim()
  if (!text) return { venue: '', city: '' }
  const comma = text.lastIndexOf(',')
  if (comma < 0) return { venue: text, city: '' }
  return { venue: text.slice(0, comma).trim(), city: text.slice(comma + 1).trim() }
}

/** Session times are stored as "10.00 WIB"; the time field works with "10:00". */
const toTimeValue = (text?: string) => {
  const match = /^(\d{1,2})[.:](\d{2})/.exec((text ?? '').trim())
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : ''
}

const timeText = (time: string) => time ? `${time.replace(':', '.')} WIB` : null
const normalizeSlug = (value: string) => suggestEventSlug(value).slice(0, 40)

/**
 * Edits the event in the same sheet and grouped rows as the guest form: one
 * scrollable column, a sticky save button, and no step-by-step wizard.
 */
export function EventDetailsEditor({ event, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(event.title)
  const [slug, setSlug] = useState(event.slug)
  const slugEditable = !event.published_at
  const [date, setDate] = useState(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.event_date ?? '')) return event.event_date!
    const value = Date.parse(event.event_date ?? '')
    return Number.isFinite(value) ? jakartaDate.format(value) : jakartaDate.format(Date.now())
  })
  const [initialLocation] = useState(() => splitLocation(event.location))
  const [venue, setVenue] = useState(initialLocation.venue)
  const [city, setCity] = useState(initialLocation.city)
  const [maps, setMaps] = useState('')
  const [initialMaps, setInitialMaps] = useState<string | null>(null)
  const [mapsStatus, setMapsStatus] = useState<'loading' | 'failed' | 'ready'>('loading')
  const [mapsError, setMapsError] = useState('')
  const [retry, setRetry] = useState(0)
  const [sessions, setSessions] = useState<Session[]>(() => event.sessions?.length
    ? event.sessions.map(session => ({ key: session.id, id: session.id, name: session.name, time: toTimeValue(session.time_text) }))
    : [{ key: 'baru-0', name: '', time: DEFAULT_TIME }])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [checkedSlug, setCheckedSlug] = useState<{ slug: string; available: boolean } | null>(null)
  const nextSession = useRef(1)

  const normalizedMaps = normalizeLocationUrl(maps)
  const location = [venue.trim(), city.trim()].filter(Boolean).join(', ')
  const nextSlug = normalizeSlug(slug)
  const slugChanged = slugEditable && nextSlug !== event.slug
  const slugStatus = !slugChanged || nextSlug.length < 5
    ? 'idle' as const
    : checkedSlug?.slug === nextSlug
      ? (checkedSlug.available ? 'available' as const : 'taken' as const)
      : 'checking' as const

  useEffect(() => {
    if (!slugChanged || nextSlug.length < 5) return
    let active = true
    const timer = setTimeout(() => {
      checkEventSlug(nextSlug)
        .then(available => { if (active) setCheckedSlug({ slug: nextSlug, available }) })
        .catch(() => { if (active) setCheckedSlug(null) })
    }, 400)
    return () => { active = false; clearTimeout(timer) }
  }, [nextSlug, slugChanged])

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

  const updateSession = (key: string, patch: Partial<Pick<Session, 'name' | 'time'>>) => {
    setSessions(current => current.map(session => session.key === key ? { ...session, ...patch } : session))
  }

  const addSession = () => {
    const id = nextSession.current++
    setSessions(current => [...current, { key: `baru-${id}`, name: '', time: DEFAULT_TIME }])
  }

  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    if (busy) return
    setError('')
    setMapsError('')

    if (!title.trim()) return setError('Isi judul acara.')
    if (slugEditable && nextSlug.length < 5) return setError('Alamat tautan minimal 5 karakter.')
    if (slugStatus === 'taken') return setError('Alamat tautan sudah dipakai acara lain.')
    if (!date) return setError('Pilih tanggal acara.')
    if (!venue.trim()) return setError('Isi nama tempat acara.')
    if (maps.trim() && !normalizedMaps) {
      setMapsError('Masukkan tautan yang dimulai dengan https:// atau http://.')
      return
    }
    if (sessions.length === 0) return setError('Tambahkan minimal satu sesi acara.')
    const names = sessions.map(session => session.name.trim().toLowerCase())
    if (names.some(name => !name)) return setError('Isi nama setiap sesi.')
    if (new Set(names).size !== names.length) return setError('Gunakan nama yang berbeda untuk setiap sesi.')

    // Only send the link when it changed, so a failed fetch never clears the saved one.
    const mapsChanged = mapsStatus === 'ready' && maps.trim() !== (initialMaps ?? '').trim()

    setBusy(true)
    try {
      await saveEventDetails(event.id, {
        title: title.trim(),
        date,
        location,
        mapsUrl: mapsChanged ? normalizedMaps : null,
        sessions: sessions.map(({ id, name, time }) => ({
          id,
          name: name.trim(),
          time_text: timeText(time),
        })),
        ...(slugChanged ? { slug: nextSlug } : {}),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Detail acara belum bisa disimpan.')
      setBusy(false)
      return
    }
    setBusy(false)
    await onSaved()
  }

  return (
    <BottomSheet
      open
      onOpenChange={next => { if (!next && !busy) onClose() }}
      title="Ubah detail acara"
      description={event.title}
      closeLabel="Tutup ubah detail acara"
      detents={[0.94]}
      initialDetent={0}
    >
      <form className="ios-form" onSubmit={submit} aria-busy={busy} noValidate>
        <section className="ios-group" aria-label="Judul acara">
          <div className="ios-group-body">
            <div className="ios-row">
              <Input
                label="Judul acara"
                name="judul-acara"
                placeholder="Judul undangan"
                autoComplete="off"
                required
                maxLength={160}
                value={title}
                onChange={event => setTitle(event.target.value)}
              />
            </div>
            <div className="ios-row">
              {slugEditable ? (
                <Input
                  label="Alamat tautan"
                  description={`${LINK_PREFIX}${nextSlug || '…'}`}
                  aria-invalid={slugStatus === 'taken' ? true : undefined}
                  aria-label="Alamat tautan undangan"
                  name="alamat-tautan"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={40}
                  value={slug}
                  onChange={event => setSlug(event.target.value)}
                  onBlur={() => setSlug(normalizeSlug(slug))}
                />
              ) : (
                <>
                  <span className="ios-row-label">Alamat tautan</span>
                  <span className={styles.readonlyValue}>{LINK_PREFIX}{event.slug}</span>
                </>
              )}
            </div>
          </div>
          <p
            className={`ios-group-note${slugStatus === 'taken' ? ` ${styles.slugTaken}` : ''}`}
            role={slugStatus === 'taken' ? 'alert' : undefined}
          >
            {!slugEditable
              ? 'Alamat tautan tidak bisa diubah karena undangan sudah terbit.'
              : slugStatus === 'checking'
                ? 'Memeriksa ketersediaan alamat…'
                : slugStatus === 'available'
                  ? 'Alamat ini tersedia.'
                  : slugStatus === 'taken'
                    ? 'Alamat ini sudah dipakai acara lain. Coba yang lain.'
                    : 'Alamat tautan bisa diubah sampai undangan diterbitkan.'}
          </p>
        </section>

        <section className="ios-group" aria-label="Waktu dan lokasi acara">
          <div className="ios-group-body">
            <div className="ios-row">
              <Input
                label="Tanggal"
                name="tanggal-acara"
                type="date"
                required
                value={date}
                onChange={event => setDate(event.target.value)}
              />
            </div>
            <div className="ios-row">
              <Input
                label="Tempat"
                name="nama-tempat"
                placeholder="Nama gedung atau tempat"
                required
                maxLength={80}
                value={venue}
                onChange={event => setVenue(event.target.value)}
              />
            </div>
            <div className="ios-row">
              <Input
                label="Kota"
                name="kota"
                placeholder="Opsional"
                maxLength={60}
                value={city}
                onChange={event => setCity(event.target.value)}
              />
            </div>
            <div className="ios-row">
              <Input
                label="Tautan lokasi"
                name="google-maps"
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="https://contoh.id/lokasi"
                value={maps}
                maxLength={2048}
                disabled={mapsStatus !== 'ready'}
                onBlur={() => setMaps(normalizedMaps || maps.trim())}
                onChange={event => { setMaps(event.target.value); setMapsError('') }}
              />
            </div>
          </div>
          {mapsError && <p className="form-error" role="alert">{mapsError}</p>}
          {mapsStatus === 'loading' && <p className="ios-group-note" role="status">Memuat tautan lokasi…</p>}
          {mapsStatus === 'failed' && (
            <div className={styles.mapsNote}>
              <p className="ios-group-note" role="status">Tautan lokasi belum bisa dimuat dan tidak akan diubah.</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { setMapsStatus('loading'); setRetry(value => value + 1) }}
              >
                Coba lagi
              </Button>
            </div>
          )}
          {mapsStatus === 'ready' && !mapsError && normalizedMaps && (
            <p className={`ios-group-note ${styles.mapsAvailable}`} role="status">
              <Check size={14} aria-hidden="true" /> Tautan lokasi ditambahkan
            </p>
          )}
        </section>

        <section className="ios-group" aria-label="Sesi acara">
          <div className="ios-group-body">
            {sessions.map((session, index) => (
              <div key={session.key} className={styles.sessionRow}>
                <label className="sr-only" htmlFor={`sesi-${session.key}`}>Nama sesi {index + 1}</label>
                <input
                  id={`sesi-${session.key}`}
                  className={styles.sessionName}
                  name={`sesi-${session.key}`}
                  placeholder="Nama sesi"
                  autoComplete="off"
                  required
                  maxLength={40}
                  value={session.name}
                  onChange={event => updateSession(session.key, { name: event.target.value })}
                />
                <span className={styles.timeChipWrap}>
                  <label className="sr-only" htmlFor={`jam-${session.key}`}>Jam sesi {index + 1}</label>
                  <input
                    id={`jam-${session.key}`}
                    className={styles.timeChip}
                    type="time"
                    name={`jam-${session.key}`}
                    value={session.time}
                    onChange={event => updateSession(session.key, { time: event.target.value })}
                  />
                  <ChevronsUpDown size={14} aria-hidden="true" className={styles.timeChipIcon} />
                </span>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeSession}
                    aria-label={`Hapus sesi ${session.name.trim() || index + 1}`}
                    onClick={() => setSessions(current => current.filter(item => item.key !== session.key))}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {sessions.length < 3 && (
            <Button type="button" variant="secondary" size="md" fullWidth onClick={addSession}>
              <Plus size={16} aria-hidden="true" /> Tambah sesi
            </Button>
          )}
          <p className="ios-group-note">Setiap sesi tampil dengan waktunya sendiri di undangan.</p>
        </section>

        <div className="ios-form-save">
          {error && <p role="alert" className="form-error">{error}</p>}
          <Button type="submit" variant="accent" size="xl" fullWidth loading={busy}>
            Simpan perubahan
          </Button>
        </div>
      </form>
    </BottomSheet>
  )
}
