import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Check, MapPin, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { useCollapseProgress } from '@/lib/hooks/use-collapse-progress'
import { CreateEventError, checkEventSlug, createFirstEvent, suggestEventSlug } from '@/lib/event-onboarding'
import { EventDateWheel, todayInJakarta } from './EventDateWheel'
import { OnboardingWelcome } from './OnboardingWelcome'
import styles from './EventOnboarding.module.css'

const LINK_PREFIX = 'rayarayu.id/'
const SLUG_MIN = 5

const steps = [
  { title: 'Siapa kedua mempelai?', copy: 'Nama lengkap akan tampil di undangan. Nama panggilan dipakai di bagian sapaan.' },
  { title: 'Judul & alamat tautan', copy: 'Tamu akan membuka undangan lewat alamat ini. Pilih yang mudah diingat.' },
  { title: 'Kapan acara berlangsung?', copy: 'Tanggal ini akan tampil di undangan.' },
  { title: 'Atur sesi dan lokasi acara', copy: 'Tambahkan satu atau lebih sesi, misalnya akad dan resepsi.' },
  { title: 'Pilih paket', copy: 'Mulai dengan paket Gratis. Paket berbayar akan segera tersedia.' },
] as const

type Plan = { id: string; name: string; detail: string; price: string; available: boolean }
const plans: Plan[] = [
  { id: 'gratis', name: 'Gratis', detail: '30 tamu · ada watermark', price: 'Rp0', available: true },
  { id: 'silver', name: 'Silver', detail: '300 tamu · tanpa watermark', price: 'Rp99.000', available: false },
  { id: 'gold', name: 'Gold', detail: '1.000 tamu · ekspor PDF', price: 'Rp199.000', available: false },
  { id: 'diamond', name: 'Diamond', detail: '3.000 tamu · domain sendiri', price: 'Rp349.000', available: false },
]

const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? ''

const slugStatusText: Record<Exclude<SlugStatus, 'idle'>, string> = {
  checking: 'Memeriksa ketersediaan…',
  available: 'Alamat tautan tersedia',
  taken: 'Alamat tautan sudah dipakai',
  unknown: 'Ketersediaan belum bisa dicek sekarang',
}

type Step = -1 | 0 | 1 | 2 | 3 | 4
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'unknown'
type Session = { id: number; name: string; time: string }
type Props = {
  /** The signed-in account, shown in the header and its bottom sheet. */
  account: { name: string; onOpen: () => void }
  /** Load the existing event if present; throw if the outcome could not be checked. */
  onLoadEvent: () => Promise<boolean>
}

const formatDate = (date: string) => new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'long',
  timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`))

export function EventOnboarding({ account, onLoadEvent }: Props) {
  const [step, setStep] = useState<Step>(-1)
  const [firstName, setFirstName] = useState('')
  const [secondName, setSecondName] = useState('')
  const [groomNickname, setGroomNickname] = useState('')
  const [groomFather, setGroomFather] = useState('')
  const [groomMother, setGroomMother] = useState('')
  const [brideNickname, setBrideNickname] = useState('')
  const [brideFather, setBrideFather] = useState('')
  const [brideMother, setBrideMother] = useState('')
  const [title, setTitle] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [today] = useState(todayInJakarta)
  const [date, setDate] = useState(today)
  const [venue, setVenue] = useState('')
  const [city, setCity] = useState('')
  const [sessions, setSessions] = useState<Session[]>([
    { id: 0, name: 'Akad', time: '' },
    { id: 1, name: 'Resepsi', time: '' },
  ])
  const [error, setError] = useState('')
  const [slugError, setSlugError] = useState('')
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [returnToReview, setReturnToReview] = useState(false)
  const nextSessionId = useRef(2)
  const busyRef = useRef(false)
  const checkBeforeRetry = useRef(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const pageRef = useRef<HTMLElement>(null)
  const chromeRef = useRef<HTMLElement>(null)
  useCollapseProgress(chromeRef)

  const coupleName = [firstName.trim(), secondName.trim()].filter(Boolean).join(' & ')
  const coupleLabel = [groomNickname.trim() || firstWord(firstName), brideNickname.trim() || firstWord(secondName)].filter(Boolean).join(' & ')
  const titleValue = title ?? (coupleLabel ? `Pernikahan ${coupleLabel}` : '')
  const slugValue = slug ?? suggestEventSlug(coupleLabel)
  const normalizedSlug = suggestEventSlug(slugValue)
  const location = [venue.trim(), city.trim()].filter(Boolean).join(', ')
  const mapsUrl = venue.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : ''
  const sessionSummary = sessions
    .map(session => `${session.name.trim()}${session.time ? ` ${session.time.replace(':', '.')}` : ''}`)
    .join(' · ')
  const summaryRows: { label: string; value: string; step: Step }[] = [
    { label: 'Mempelai', value: firstName.trim() && secondName.trim() ? coupleName : 'Belum lengkap', step: 0 },
    { label: 'Judul', value: titleValue.trim() || '-', step: 1 },
    { label: 'Alamat', value: `${LINK_PREFIX}${normalizedSlug}`, step: 1 },
    { label: 'Tanggal', value: formatDate(date), step: 2 },
    { label: 'Lokasi', value: location || '-', step: 3 },
    { label: 'Sesi', value: sessionSummary || '-', step: 3 },
  ]

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    stepHeading.current?.focus({ preventScroll: true })
  }, [step])

  useEffect(() => {
    const viewport = window.visualViewport
    const page = pageRef.current
    if (!viewport || !page) return
    const update = () => {
      const inset = viewport.scale === 1 ? Math.max(0, document.documentElement.clientHeight - viewport.height - viewport.offsetTop) : 0
      page.style.setProperty('--keyboard-inset', `${inset}px`)
      page.toggleAttribute('data-compact', inset > 100)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  useEffect(() => {
    if (step !== 1 || normalizedSlug.length < SLUG_MIN) {
      setSlugStatus('idle')
      return
    }
    let active = true
    setSlugStatus('checking')
    const timer = window.setTimeout(() => {
      checkEventSlug(normalizedSlug)
        .then(available => { if (active) setSlugStatus(available ? 'available' : 'taken') })
        .catch(() => { if (active) setSlugStatus('unknown') })
    }, 400)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [step, normalizedSlug])

  const goTo = (next: Step) => {
    setError('')
    setStep(next)
  }

  const advance = (next: Step) => {
    goTo(returnToReview ? 4 : next)
    setReturnToReview(false)
  }

  const updateSession = (id: number, key: 'name' | 'time', value: string) => {
    setSessions(current => current.map(session => session.id === id ? { ...session, [key]: value } : session))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busyRef.current) return
    setError('')
    if (step === 0) {
      if (!firstName.trim() || !secondName.trim()) return setError('Isi nama kedua mempelai.')
      advance(1)
      return
    }
    if (step === 1) {
      if (!titleValue.trim()) return setError('Isi judul acara.')
      if (normalizedSlug.length < SLUG_MIN) return setSlugError(`Alamat tautan minimal ${SLUG_MIN} karakter.`)
      if (slugStatus === 'taken') return setSlugError('Alamat tautan sudah dipakai. Coba yang lain.')
      if (slugStatus === 'checking') return setSlugError('Tunggu, alamat tautan sedang diperiksa.')
      setSlugError('')
      advance(2)
      return
    }
    if (step === 2) {
      advance(3)
      return
    }
    if (step === 3) {
      if (!venue.trim()) return setError('Isi nama venue acara.')
      const names = sessions.map(session => session.name.trim().toLowerCase())
      if (names.some(name => !name)) return setError('Isi nama setiap sesi.')
      if (new Set(names).size !== names.length) return setError('Gunakan nama yang berbeda untuk setiap sesi.')
      advance(4)
      return
    }
    if (step !== 4) return
    if (!firstName.trim() || !secondName.trim()) {
      setReturnToReview(true)
      goTo(0)
      setError('Isi nama kedua mempelai sebelum membuat acara.')
      return
    }

    busyRef.current = true
    setBusy(true)
    let eventSaved = saved
    try {
      // A prior request may have reached the server even if the response did not arrive.
      if (!eventSaved && checkBeforeRetry.current && await onLoadEvent()) return
      if (!eventSaved) {
        checkBeforeRetry.current = true
        await createFirstEvent({
          coupleName,
          couple: {
            groomName: firstName,
            groomNickname,
            groomFather,
            groomMother,
            brideName: secondName,
            brideNickname,
            brideFather,
            brideMother,
          },
          title: titleValue,
          slug: normalizedSlug,
          date,
          location,
          sessions,
        })
        eventSaved = true
        setSaved(true)
      }
      if (!await onLoadEvent()) throw new Error()
    } catch (cause) {
      if (eventSaved) {
        setError('Acara sudah dibuat, tetapi Beranda belum bisa dimuat. Coba muat ulang.')
      } else if (cause instanceof CreateEventError && cause.field === 'slug') {
        checkBeforeRetry.current = false
        goTo(1)
        setSlugError(cause.message)
      } else {
        setError(cause instanceof CreateEventError ? cause.message : 'Belum bisa memastikan status acara. Periksa koneksi lalu coba lagi.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const heading = step === -1 ? null : (
    <div className={styles.heading}>
      <h1 ref={stepHeading} tabIndex={-1}>
        <span className="sr-only">Langkah {step + 1} dari {steps.length}: </span>{steps[step].title}
      </h1>
      <p>{steps[step].copy}</p>
    </div>
  )

  return (
    <main ref={pageRef} id="main-content" tabIndex={-1} className={`app ${styles.page}${step === -1 ? ` ${styles.introPage}` : ` ${styles.formPage}`}`}>
      {step === -1 ? (
        <OnboardingWelcome onStart={() => goTo(0)} account={account} />
      ) : (
        <div className={styles.wizard}>
          <header ref={chromeRef} className={styles.chrome}>
            <span className="progressive-blur" aria-hidden="true" />
            <div className={styles.top}>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className={styles.back}
                aria-label="Kembali"
                disabled={busy || saved}
                onClick={() => {
                  goTo(returnToReview ? 4 : (step - 1) as Step)
                  setReturnToReview(false)
                }}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </Button>
              <progress className={styles.progress} value={step + 1} max={steps.length} aria-label="Progres pembuatan acara" />
              {step <= 3 && !returnToReview && (
                <Button type="button" variant="secondary" size="md" className={styles.skip} onClick={() => goTo((step + 1) as Step)}>
                  Lewati
                </Button>
              )}
            </div>
            {step <= 3 && heading}
          </header>
          <form className={styles.form} onSubmit={submit} aria-busy={busy}>
            {step > 3 && heading}
            <div className={styles.body} data-step={step}>
              {step === 0 && (
                <div className={styles.coupleFields}>
                  <section className={styles.personSection}>
                    <p className={styles.sectionLabel}>Nama mempelai pria</p>
                    <div className={styles.groupedTable}>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Lengkap</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama lengkap mempelai pria"
                          placeholder="Nama lengkap"
                          autoComplete="off"
                          maxLength={60}
                          value={firstName}
                          onChange={event => setFirstName(event.target.value)}
                        />
                      </label>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Panggilan</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama panggilan mempelai pria"
                          placeholder="Nama panggilan"
                          autoComplete="off"
                          maxLength={30}
                          value={groomNickname}
                          onChange={event => setGroomNickname(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className={styles.groupedTable}>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Ayah</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama ayah mempelai pria"
                          placeholder="Nama ayah"
                          autoComplete="off"
                          maxLength={60}
                          value={groomFather}
                          onChange={event => setGroomFather(event.target.value)}
                        />
                      </label>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Ibu</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama ibu mempelai pria"
                          placeholder="Nama ibu"
                          autoComplete="off"
                          maxLength={60}
                          value={groomMother}
                          onChange={event => setGroomMother(event.target.value)}
                        />
                      </label>
                    </div>
                  </section>

                  <section className={styles.personSection}>
                    <p className={styles.sectionLabel}>Nama mempelai wanita</p>
                    <div className={styles.groupedTable}>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Lengkap</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama lengkap mempelai wanita"
                          placeholder="Nama lengkap"
                          autoComplete="off"
                          maxLength={60}
                          value={secondName}
                          onChange={event => setSecondName(event.target.value)}
                        />
                      </label>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Panggilan</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama panggilan mempelai wanita"
                          placeholder="Nama panggilan"
                          autoComplete="off"
                          maxLength={30}
                          value={brideNickname}
                          onChange={event => setBrideNickname(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className={styles.groupedTable}>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Ayah</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama ayah mempelai wanita"
                          placeholder="Nama ayah"
                          autoComplete="off"
                          maxLength={60}
                          value={brideFather}
                          onChange={event => setBrideFather(event.target.value)}
                        />
                      </label>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Ibu</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama ibu mempelai wanita"
                          placeholder="Nama ibu"
                          autoComplete="off"
                          maxLength={60}
                          value={brideMother}
                          onChange={event => setBrideMother(event.target.value)}
                        />
                      </label>
                    </div>
                  </section>
                </div>
              )}

              {step === 1 && (
                <div className={styles.sections}>
                  <section className={styles.section}>
                    <p className={styles.sectionLabel}>Judul acara</p>
                    <div className={styles.groupedTable}>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Judul</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Judul acara"
                          placeholder="Judul undangan"
                          maxLength={80}
                          value={titleValue}
                          onChange={event => setTitle(event.target.value)}
                        />
                      </label>
                    </div>
                  </section>

                  <section className={styles.section}>
                    <p className={styles.sectionLabel}>Alamat tautan</p>
                    <div className={styles.groupedTable}>
                      <label className={`${styles.groupedRow} ${styles.slugRow}`}>
                        <span className={styles.slugPrefix} aria-hidden="true">{LINK_PREFIX}</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Alamat tautan undangan"
                          value={slugValue}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          onChange={event => { setSlug(event.target.value); setSlugError('') }}
                          onBlur={() => { if (slug !== null) setSlug(normalizedSlug) }}
                        />
                      </label>
                    </div>
                    {slugError ? <p className={styles.error} role="alert">{slugError}</p>
                      : normalizedSlug.length < SLUG_MIN || slugStatus === 'idle'
                        ? <p className={styles.linkHint}>Gunakan huruf kecil, angka, dan tanda hubung (-). Minimal {SLUG_MIN} karakter.</p>
                        : (
                          <p className={styles.linkHint} data-status={slugStatus} role="status" aria-live="polite">
                            {slugStatus === 'available' && <Check size={14} aria-hidden="true" />}
                            {slugStatusText[slugStatus]}
                          </p>
                        )}
                  </section>
                </div>
              )}

              {step === 2 && (
                <div className={styles.date}>
                  <EventDateWheel value={date} onChange={setDate} startYear={Number(today.slice(0, 4))} />
                  <p>{formatDate(date)}</p>
                </div>
              )}

              {step === 3 && (
                <div className={styles.sections}>
                  <section className={styles.section}>
                    <p className={styles.sectionLabel}>Waktu acara</p>
                    <div className={styles.groupedTable}>
                      {sessions.map((session, index) => (
                        <div key={session.id} className={`${styles.groupedRow} ${styles.sessionRow}`}>
                          <input
                            className={styles.sessionName}
                            aria-label={`Nama sesi ${index + 1}`}
                            placeholder="Nama sesi"
                            maxLength={40}
                            value={session.name}
                            onChange={event => updateSession(session.id, 'name', event.target.value)}
                          />
                          <input
                            className={styles.timeChip}
                            type="time"
                            aria-label={`Jam sesi ${index + 1}`}
                            value={session.time}
                            onChange={event => updateSession(session.id, 'time', event.target.value)}
                          />
                          {sessions.length > 1 && (
                            <button
                              type="button"
                              className={styles.deleteSession}
                              aria-label={`Hapus sesi ${index + 1}`}
                              onClick={() => setSessions(current => current.filter(item => item.id !== session.id))}
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {sessions.length < 3 && (
                      <button
                        type="button"
                        className={styles.addSession}
                        onClick={() => {
                          const id = nextSessionId.current++
                          setSessions(current => [...current, { id, name: '', time: '' }])
                        }}
                      >
                        <Plus size={16} aria-hidden="true" /> Tambah sesi
                      </button>
                    )}
                  </section>

                  <section className={styles.section}>
                    <p className={styles.sectionLabel}>Lokasi acara</p>
                    <div className={styles.groupedTable}>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Venue</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Nama venue"
                          placeholder="Gedung atau tempat"
                          maxLength={80}
                          value={venue}
                          onChange={event => setVenue(event.target.value)}
                        />
                      </label>
                      <label className={styles.groupedRow}>
                        <span className={styles.groupedLabel}>Kota</span>
                        <input
                          className={styles.groupedInput}
                          aria-label="Kota acara"
                          placeholder="Kota"
                          maxLength={60}
                          value={city}
                          onChange={event => setCity(event.target.value)}
                        />
                      </label>
                      <div className={`${styles.groupedRow} ${styles.mapRow}`}>
                        <span className={styles.groupedLabel}>Link google map</span>
                        {mapsUrl
                          ? <a className={styles.mapAction} href={mapsUrl} target="_blank" rel="noreferrer">Buka peta</a>
                          : <span className={styles.mapMuted}>Terisi otomatis</span>}
                      </div>
                    </div>
                    <p className={styles.linkHint}><MapPin size={14} aria-hidden="true" /> Peta dibuat dari venue dan kota. Tidak perlu diisi.</p>
                  </section>
                </div>
              )}

              {step === 4 && (
                <div className={styles.sections}>
                  <section className={styles.section}>
                    <p className={styles.sectionLabel}>Ringkasan</p>
                    <div className={styles.groupedTable}>
                      {summaryRows.map(row => (
                        <button
                          key={row.label}
                          type="button"
                          className={styles.listRow}
                          disabled={busy}
                          onClick={() => { setReturnToReview(true); goTo(row.step) }}
                        >
                          <span className={styles.listLabel}>{row.label}</span>
                          <span className={styles.listValue}>{row.value}</span>
                          <ChevronRight size={16} aria-hidden="true" className={styles.listChevron} />
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className={styles.section}>
                    <p className={styles.sectionLabel}>Paket</p>
                    <div className={styles.groupedTable} role="radiogroup" aria-label="Pilih paket">
                      {plans.map(plan => (
                        <button
                          key={plan.id}
                          type="button"
                          role="radio"
                          aria-checked={plan.id === 'gratis'}
                          disabled={!plan.available}
                          className={styles.planRow}
                        >
                          <span className={styles.planText}>
                            <span className={styles.listLabel}>{plan.name}</span>
                            <span className={styles.planDetail}>{plan.detail}</span>
                          </span>
                          {plan.available
                            ? <span className={styles.listValue}>{plan.price}</span>
                            : <span className={styles.planSoon}>Segera hadir</span>}
                          {plan.available && <Check size={18} aria-hidden="true" className={styles.planCheck} />}
                        </button>
                      ))}
                    </div>
                    <p className={styles.hint}>Membuat acara tidak langsung menerbitkan undangan.</p>
                  </section>
                </div>
              )}
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.footer}>
              <div className={styles.introCta}>
                <Button type="submit" variant="accent" size="xl" className={styles.primary} loading={busy} formNoValidate={step === 4} fullWidth>
                  {busy ? (saved ? 'Memuat Beranda…' : 'Membuat acara…') : saved ? 'Muat ulang Beranda' : step === 4 ? 'Buat acara' : step === 3 ? 'Lanjut pilih paket' : 'Berikutnya'}
                </Button>
                {!busy && step < 4 && <img src="/onboarding/couple/arrow-right.svg" alt="" />}
              </div>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
