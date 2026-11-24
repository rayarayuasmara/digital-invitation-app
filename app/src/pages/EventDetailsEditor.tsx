import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/arc/badge/badge'
import { Button } from '@/components/arc/button/button'
import { Input, type InputProps } from '@/components/arc/input/input'
import { SwipeActions, SwipeActionsRow } from '@/components/arc/swipe-actions/swipe-actions'
import { fetchEventMapsUrl, saveEventDetails, type DashboardEvent } from '@/lib/dashboard'
import { normalizeLocationUrl } from '@/lib/event-onboarding'
import { EventDateWheel, todayInJakarta } from './EventDateWheel'
import onboarding from './EventOnboarding.module.css'
import styles from './EventDetailsEditor.module.css'

const LINK_PREFIX = 'rayarayu.id/'
const DEFAULT_TIME = '10:00'
const jakartaDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' })

const steps = [
  { title: 'Judul acara', copy: 'Nama acara yang tampil di undangan tamu.' },
  { title: 'Kapan acara berlangsung?', copy: 'Tanggal ini dipakai di undangan dan hitung mundur.' },
  { title: 'Atur sesi dan lokasi acara', copy: 'Lengkapi waktu, sesi, dan lokasi acara.' },
  { title: 'Periksa perubahan', copy: 'Pastikan detail acara sudah benar sebelum disimpan.' },
] as const

type Step = 0 | 1 | 2 | 3
type Session = { key: string; id?: string; name: string; time: string }

type Props = {
  event: DashboardEvent
  onClose: () => void
  onSaved: () => Promise<void>
}

function GroupedField({ fieldClassName, labelClassName, ...props }: InputProps) {
  return <Input {...props} className={onboarding.groupedInput}
    fieldClassName={[onboarding.groupedRow, fieldClassName].filter(Boolean).join(' ')}
    labelClassName={[onboarding.groupedLabel, labelClassName].filter(Boolean).join(' ')} />
}

const formatDate = (date: string) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`))

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

export function EventDetailsEditor({ event, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>(0)
  const [title, setTitle] = useState(event.title)
  const [date, setDate] = useState(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.event_date ?? '')) return event.event_date!
    const value = Date.parse(event.event_date ?? '')
    return Number.isFinite(value) ? jakartaDate.format(value) : todayInJakarta()
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
  const [today] = useState(todayInJakarta)
  const nextSession = useRef(1)
  const overlayRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  const normalizedMaps = normalizeLocationUrl(maps)
  const location = [venue.trim(), city.trim()].filter(Boolean).join(', ')
  const sessionSummary = sessions
    .map(session => `${session.name.trim()}${session.time ? ` ${session.time.replace(':', '.')} WIB` : ''}`)
    .join(' · ')
  const summaryRows: { label: string; value: string; step: Step | null }[] = [
    { label: 'Judul', value: title.trim() || '-', step: 0 },
    { label: 'Alamat', value: `${LINK_PREFIX}${event.slug}`, step: null },
    { label: 'Tanggal', value: formatDate(date), step: 1 },
    { label: 'Lokasi', value: location || '-', step: 2 },
    { label: 'Sesi', value: sessionSummary || '-', step: 2 },
  ]

  useEffect(() => {
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const main = document.getElementById('main-content')
    main?.setAttribute('inert', '')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      main?.removeAttribute('inert')
      document.body.style.overflow = previousOverflow
      restoreFocus.current?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    overlayRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  useEffect(() => {
    if (!error) return
    errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [error])

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

  const goTo = (next: Step) => {
    setError('')
    setStep(next)
  }

  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    if (busy) return
    setError('')

    if (step === 0) {
      if (!title.trim()) return setError('Isi judul acara.')
      goTo(1)
      return
    }
    if (step === 1) {
      goTo(2)
      return
    }
    if (step === 2) {
      if (!venue.trim()) return setError('Isi nama tempat acara.')
      if (maps.trim() && !normalizedMaps) {
        setMapsError('Masukkan tautan yang dimulai dengan https:// atau http://.')
        formEvent.currentTarget.querySelector<HTMLInputElement>('input[name="google-maps"]')?.focus()
        return
      }
      if (sessions.length === 0) return setError('Tambahkan minimal satu sesi acara.')
      const names = sessions.map(session => session.name.trim().toLowerCase())
      if (names.some(name => !name)) return setError('Isi nama setiap sesi.')
      if (new Set(names).size !== names.length) return setError('Gunakan nama yang berbeda untuk setiap sesi.')
      setMapsError('')
      goTo(3)
      return
    }

    const mapsChanged = mapsStatus === 'ready' && maps.trim() !== (initialMaps ?? '').trim()
    if (mapsChanged && maps.trim() && !normalizedMaps) {
      setMapsError('Masukkan tautan yang dimulai dengan https:// atau http://.')
      goTo(2)
      return
    }

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
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Detail acara belum bisa disimpan.')
      setBusy(false)
      return
    }
    setBusy(false)
    await onSaved()
  }

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if (busy) return
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !overlayRef.current) return
    const stops = Array.from(overlayRef.current.querySelectorAll<HTMLElement>('button, input, a[href], textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(node => !node.hasAttribute('disabled') && !node.closest('[inert]') && node.getClientRects().length > 0)
    if (!stops.length) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Ubah detail acara"
      onKeyDown={trapFocus}
    >
      <div className={`app ${onboarding.page} ${onboarding.formPage}`}>
        <div className={onboarding.wizard}>
          <header className={onboarding.chrome} data-step={step}>
            <span className="progressive-blur page-head-glass" aria-hidden="true" />
            <div className={onboarding.top}>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className={onboarding.back}
                aria-label={step === 0 ? 'Tutup ubah detail acara' : 'Kembali'}
                disabled={busy}
                onClick={() => step === 0 ? onClose() : goTo((step - 1) as Step)}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </Button>
              <progress className={onboarding.progress} value={step + 1} max={steps.length} aria-label="Progres ubah detail acara" />
              <Badge size="sm" pill className={onboarding.stepCount} aria-hidden="true">{step + 1} / {steps.length}</Badge>
            </div>
          </header>

          <form className={onboarding.form} onSubmit={submit} aria-busy={busy} noValidate>
            <div className={onboarding.heading}>
              <h1 ref={headingRef} tabIndex={-1}>
                <span className="sr-only">Langkah {step + 1} dari {steps.length}: </span>{steps[step].title}
              </h1>
              <p>{steps[step].copy}</p>
            </div>

            <div className={onboarding.body}>
              {error && <p ref={errorRef} className={onboarding.validationBanner} role="alert">{error}</p>}

              {step === 0 && (
                <div className={onboarding.sections}>
                  <section className={onboarding.section}>
                    <p className={onboarding.sectionLabel}>Judul acara</p>
                    <div className={onboarding.groupedTable}>
                      <GroupedField
                        label="Judul"
                        name="judul-acara"
                        aria-label="Judul acara"
                        placeholder="Judul undangan…"
                        required
                        maxLength={160}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                      />
                    </div>
                  </section>

                  <section className={onboarding.section}>
                    <p className={onboarding.sectionLabel}>Alamat tautan</p>
                    <div className={onboarding.groupedTable}>
                      <div className={`${onboarding.groupedRow} ${onboarding.slugRow}`}>
                        <span className={onboarding.groupedLabel}>{LINK_PREFIX}</span>
                        <span className={styles.readonlyValue}>{event.slug}</span>
                      </div>
                    </div>
                    <p className={onboarding.linkHint}>Alamat tautan tidak bisa diubah setelah acara dibuat.</p>
                  </section>
                </div>
              )}

              {step === 1 && (
                <div className={onboarding.date}>
                  <EventDateWheel value={date} onChange={setDate} startYear={Number(today.slice(0, 4))} />
                  <p>{formatDate(date)}</p>
                </div>
              )}

              {step === 2 && (
                <div className={onboarding.sections}>
                  <section className={onboarding.section}>
                    <p className={onboarding.sectionLabel}>Waktu acara</p>
                    <SwipeActions label="Sesi acara" className={onboarding.sessionList}>
                      {sessions.map((session, index) => (
                        <SwipeActionsRow
                          key={session.key}
                          label={session.name || `Sesi ${index + 1}`}
                          fullSwipe={false}
                          menuLabel={`Tindakan sesi ${index + 1}`}
                          trailing={sessions.length > 1 ? [{
                            label: 'Hapus',
                            icon: <Trash2 size={18} aria-hidden />,
                            tone: 'danger',
                            onSelect: () => setSessions(current => current.filter(item => item.key !== session.key)),
                          }] : []}
                        >
                          <div className={onboarding.sessionRow}>
                            <Input
                              className={onboarding.sessionName}
                              fieldClassName={onboarding.sessionNameField}
                              labelClassName="sr-only"
                              label={`Nama sesi ${index + 1}`}
                              name={`sesi-${session.key}`}
                              placeholder="Nama sesi…"
                              required
                              maxLength={40}
                              value={session.name}
                              onChange={event => updateSession(session.key, { name: event.target.value })}
                            />
                            <Input
                              className={onboarding.timeChip}
                              type="time"
                              labelClassName="sr-only"
                              label={`Jam sesi ${index + 1}`}
                              name={`jam-${session.key}`}
                              value={session.time}
                              onChange={event => updateSession(session.key, { time: event.target.value })}
                            />
                          </div>
                        </SwipeActionsRow>
                      ))}
                    </SwipeActions>
                    {sessions.length < 3 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        className={onboarding.addSession}
                        fullWidth
                        onClick={() => {
                          const id = nextSession.current++
                          setSessions(current => [...current, { key: `baru-${id}`, name: '', time: DEFAULT_TIME }])
                        }}
                      >
                        <Plus size={16} aria-hidden="true" /> Tambah sesi
                      </Button>
                    )}
                  </section>

                  <section className={onboarding.section}>
                    <p className={onboarding.sectionLabel}>Lokasi acara</p>
                    <div className={onboarding.groupedTable}>
                      <GroupedField
                        label="Tempat"
                        name="nama-tempat"
                        aria-label="Nama tempat acara"
                        placeholder="Nama gedung atau tempat"
                        required
                        maxLength={80}
                        value={venue}
                        onChange={e => setVenue(e.target.value)}
                      />
                      <GroupedField
                        label="Kota"
                        name="kota"
                        aria-label="Kota acara"
                        placeholder="Contoh: Bandung"
                        maxLength={60}
                        value={city}
                        onChange={e => setCity(e.target.value)}
                      />
                      <GroupedField
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
                        error={mapsError}
                        onBlur={() => setMaps(normalizedMaps || maps.trim())}
                        onChange={e => { setMaps(e.target.value); setMapsError('') }}
                      />
                    </div>
                    {mapsStatus === 'loading' && <p className={onboarding.linkHint} role="status">Memuat tautan lokasi…</p>}
                    {mapsStatus === 'failed' && (
                      <div className={styles.mapsNote}>
                        <p className={onboarding.linkHint} role="status">Tautan lokasi belum bisa dimuat dan tidak akan diubah.</p>
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
                      <p className={onboarding.linkHint} data-status="available" role="status">
                        <Check size={14} aria-hidden="true" /> Tautan lokasi ditambahkan
                      </p>
                    )}
                  </section>
                </div>
              )}

              {step === 3 && (
                <div className={onboarding.sections}>
                  <section className={onboarding.section}>
                    <p className={onboarding.sectionLabel}>Ringkasan acara</p>
                    <div className={onboarding.groupedTable}>
                      {summaryRows.map(row => row.step === null ? (
                        <div key={row.label} className={`${onboarding.listRow} ${styles.staticRow}`}>
                          <span className={onboarding.listLabel}>{row.label}</span>
                          <span className={onboarding.listValue}>{row.value}</span>
                        </div>
                      ) : (
                        <button
                          key={row.label}
                          type="button"
                          className={onboarding.listRow}
                          disabled={busy}
                          onClick={() => goTo(row.step!)}
                        >
                          <span className={onboarding.listLabel}>{row.label}</span>
                          <span className={onboarding.listValue}>{row.value}</span>
                          <ChevronRight size={16} aria-hidden="true" className={onboarding.listChevron} />
                        </button>
                      ))}
                    </div>
                  </section>

                  <p className={onboarding.hint}>Perubahan langsung terlihat di pratinjau dan undangan yang sudah terbit.</p>
                </div>
              )}
            </div>

            <div className={onboarding.footer}>
              <div className={onboarding.introCta}>
                <Button type="submit" variant="accent" size="xl" className={onboarding.primary} loading={busy} fullWidth>
                  {busy ? 'Menyimpan…' : step === 3 ? 'Simpan perubahan' : 'Berikutnya'}
                  {!busy && step < 3 && <ArrowRight size={17} aria-hidden="true" />}
                </Button>
                {step === 0 && (
                  <Button type="button" variant="ghost" size="md" fullWidth disabled={busy} onClick={onClose}>Batal</Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  )
}
