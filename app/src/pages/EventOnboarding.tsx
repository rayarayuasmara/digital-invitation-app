import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, MailOpen, Plus, X } from 'lucide-react'
import { Badge } from '@/components/arc/badge/badge'
import { Button } from '@/components/arc/button/button'
import { Card } from '@/components/arc/card'
import { Input } from '@/components/arc/input/input'
import { BrandMark } from '@/components/BrandMark'
import { CreateEventError, createFirstEvent, suggestEventSlug } from '@/lib/event-onboarding'
import styles from './EventOnboarding.module.css'

const steps = [
  { label: 'Detail', title: 'Detail acara', copy: 'Isi nama mempelai dan tentukan alamat undangan Anda.' },
  { label: 'Jadwal', title: 'Jadwal & lokasi', copy: 'Atur waktu dan tempat acara. Anda bisa menambahkan hingga tiga sesi.' },
  { label: 'Tinjau', title: 'Tinjau & buat', copy: 'Periksa kembali detailnya sebelum membuat acara.' },
] as const

type Step = -1 | 0 | 1 | 2
type Session = { id: number; name: string; time: string }
type Props = {
  onExit: () => void
  /** Load the existing event if present; throw if the outcome could not be checked. */
  onLoadEvent: () => Promise<boolean>
}

const formatDate = (date: string) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`))

export function EventOnboarding({ onExit, onLoadEvent }: Props) {
  const [step, setStep] = useState<Step>(-1)
  const [coupleName, setCoupleName] = useState('')
  const [title, setTitle] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [sessions, setSessions] = useState<Session[]>([{ id: 0, name: 'Resepsi', time: '' }])
  const [error, setError] = useState('')
  const [slugError, setSlugError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const nextSessionId = useRef(1)
  const busyRef = useRef(false)
  const checkBeforeRetry = useRef(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)

  const titleValue = title ?? (coupleName.trim() ? `Pernikahan ${coupleName.trim()}` : '')
  const slugValue = slug ?? suggestEventSlug(coupleName)
  const normalizedSlug = suggestEventSlug(slugValue)

  useEffect(() => {
    if (step < 0) return
    window.scrollTo({ top: 0, behavior: 'instant' })
    stepHeading.current?.focus({ preventScroll: true })
  }, [step])

  const goTo = (next: Step) => {
    setError('')
    setStep(next)
  }

  const updateSession = (id: number, key: 'name' | 'time', value: string) => {
    setSessions(current => current.map(session => session.id === id ? { ...session, [key]: value } : session))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busyRef.current) return
    setError('')
    if (step === 0) {
      if (!coupleName.trim() || !titleValue.trim()) return setError('Isi nama mempelai dan judul undangan.')
      if (normalizedSlug.length < 3) return setSlugError('Masukkan minimal 3 karakter untuk alamat tautan.')
      setSlugError('')
      goTo(1)
      return
    }
    if (step === 1) {
      if (!date || !location.trim()) return setError('Isi tanggal dan lokasi acara.')
      const names = sessions.map(session => session.name.trim().toLowerCase())
      if (names.some(name => !name)) return setError('Isi nama setiap sesi.')
      if (new Set(names).size !== names.length) return setError('Gunakan nama yang berbeda untuk setiap sesi.')
      goTo(2)
      return
    }
    if (step !== 2) return

    busyRef.current = true
    setBusy(true)
    let eventSaved = saved
    try {
      // A prior request may have reached the server even if the response did not arrive.
      if (!eventSaved && checkBeforeRetry.current && await onLoadEvent()) return
      if (!eventSaved) {
        checkBeforeRetry.current = true
        await createFirstEvent({ coupleName, title: titleValue, slug: normalizedSlug, date, location, sessions })
        eventSaved = true
        setSaved(true)
      }
      if (!await onLoadEvent()) throw new Error()
    } catch (cause) {
      if (eventSaved) {
        setError('Acara sudah dibuat, tetapi Beranda belum bisa dimuat. Coba muat ulang.')
      } else if (cause instanceof CreateEventError && cause.field === 'slug') {
        checkBeforeRetry.current = false
        goTo(0)
        setSlugError(cause.message)
      } else {
        setError(cause instanceof CreateEventError ? cause.message : 'Belum bisa memastikan status acara. Periksa koneksi lalu coba lagi.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className={`app ${styles.page}`}>
      <header className={styles.top}>
        <span className={styles.brand}><BrandMark size={22} /> RayaRayu</span>
        <Button type="button" variant="ghost" size="md" onClick={onExit} disabled={busy}>Keluar</Button>
      </header>

      {step === -1 ? (
        <div className={styles.intro}>
          <div className={styles.envelope} aria-hidden="true"><MailOpen size={30} strokeWidth={1.5} /></div>
          <h1>Buat acara pertama</h1>
          <p>Mulai dari detail pernikahan Anda. Setelah acara dibuat, Anda bisa menyiapkan undangan dan menambah tamu.</p>
          <Button variant="accent" size="xl" fullWidth onClick={() => goTo(0)}>
            Buat acara pertama <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <div className={styles.wizard}>
          <h1 className={styles.wizardTitle}>Buat acara pertama</h1>
          <ol className={styles.steps} aria-label="Tahapan pembuatan acara">
            {steps.map(({ label }, index) => (
              <li key={label} aria-current={step === index ? 'step' : undefined} data-complete={index < step || undefined}>
                <span aria-hidden="true">{index < step ? <Check size={14} /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          <Card variant="default" padding="md">
            <form className={styles.form} onSubmit={submit} aria-busy={busy}>
              <div className={styles.heading}>
                <Badge tone="info" size="sm" pill>Langkah {step + 1} dari {steps.length}</Badge>
                <h2 ref={stepHeading} tabIndex={-1} aria-label={`Langkah ${step + 1} dari ${steps.length}: ${steps[step].title}`}>{steps[step].title}</h2>
                <p>{steps[step].copy}</p>
              </div>

              {step === 0 && (
                <div className={styles.fields}>
                  <Input label="Nama mempelai" placeholder="Contoh: Dara & Bima" value={coupleName} required onChange={e => setCoupleName(e.target.value)} />
                  <Input label="Judul undangan" placeholder="Contoh: Pernikahan Dara & Bima" value={titleValue} required onChange={e => setTitle(e.target.value)} />
                  <Input
                    label="Alamat tautan"
                    placeholder="Contoh: dara-bima"
                    value={slugValue}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    error={slugError}
                    aria-describedby="event-link-preview"
                    onChange={e => { setSlug(e.target.value); setSlugError('') }}
                    onBlur={() => { if (slug !== null) setSlug(normalizedSlug) }}
                  />
                  <p className={styles.link} id="event-link-preview">
                    Contoh alamat: <samp>{window.location.host}/{normalizedSlug || 'nama-acara'}/…</samp>
                  </p>
                </div>
              )}

              {step === 1 && (
                <div className={styles.fields}>
                  <Input label="Tanggal acara" type="date" value={date} required onChange={e => setDate(e.target.value)} />
                  <Input label="Lokasi acara" placeholder="Nama tempat atau alamat" value={location} required onChange={e => setLocation(e.target.value)} />
                  <fieldset className={styles.sessions}>
                    <legend>Sesi acara <span>WIB</span></legend>
                    {sessions.map((session, index) => (
                      <div className={styles.session} key={session.id}>
                        <Input label={`Nama sesi ${index + 1}`} value={session.name} placeholder="Contoh: Akad" required onChange={e => updateSession(session.id, 'name', e.target.value)} />
                        <Input label={`Jam sesi ${index + 1}`} type="time" value={session.time} onChange={e => updateSession(session.id, 'time', e.target.value)} />
                        {sessions.length > 1 && (
                          <Button type="button" variant="ghost" size="md" className={styles.remove} aria-label={`Hapus sesi ${index + 1}`} onClick={() => setSessions(current => current.filter(item => item.id !== session.id))}>
                            <X size={18} aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {sessions.length < 3 && (
                      <Button type="button" variant="accentOutline" size="md" className={styles.addSession} onClick={() => {
                        const id = nextSessionId.current++
                        setSessions(current => [...current, { id, name: '', time: '' }])
                      }}>
                        <Plus size={16} aria-hidden="true" /> Tambah sesi
                      </Button>
                    )}
                  </fieldset>
                </div>
              )}

              {step === 2 && (
                <div className={styles.fields}>
                  <dl className={styles.summary}>
                    <div><dt>Nama mempelai</dt><dd>{coupleName.trim()}</dd></div>
                    <div><dt>Judul undangan</dt><dd>{titleValue.trim()}</dd></div>
                    <div><dt>Alamat tautan</dt><dd><samp>/{normalizedSlug}/…</samp></dd></div>
                    <div><dt>Tanggal acara</dt><dd>{formatDate(date)}</dd></div>
                    <div><dt>Lokasi acara</dt><dd>{location.trim()}</dd></div>
                    <div>
                      <dt>Sesi acara</dt>
                      <dd><ul>{sessions.map(session => <li key={session.id}>{session.name.trim()}{session.time && ` · ${session.time.replace(':', '.')} WIB`}</li>)}</ul></dd>
                    </div>
                  </dl>
                  <p className={styles.hint}>Membuat acara tidak langsung menerbitkan undangan.</p>
                </div>
              )}

              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.actions}>
                {!saved && (
                  <Button type="button" variant="secondary" size="lg" disabled={busy} onClick={() => goTo(step === 2 ? 1 : step === 1 ? 0 : -1)}>
                    <ArrowLeft size={16} aria-hidden="true" /> Kembali
                  </Button>
                )}
                <Button type="submit" variant="accent" size="lg" loading={busy} fullWidth>
                  {busy ? (saved ? 'Memuat Beranda…' : 'Membuat acara…') : saved ? 'Muat ulang Beranda' : step === 2 ? 'Buat acara' : 'Lanjut'}
                  {!busy && step < 2 && <ArrowRight size={16} aria-hidden="true" />}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </main>
  )
}
