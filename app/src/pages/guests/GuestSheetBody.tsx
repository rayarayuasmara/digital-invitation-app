import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { Select } from '@/components/arc/select/select'
import { Switch } from '@/components/arc/switch/switch'
import { AdaptiveStepper, AdaptiveStepperDecrement, AdaptiveStepperIncrement, AdaptiveStepperValue } from '@/components/motion/adaptive-stepper'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import type { Guest, GuestForm } from '@/lib/guests'
import { emptyForm } from './guest-helpers'

/** The three RSVP states a client can set by hand; `pending` clears the RSVP row. */
export type RsvpChoice = 'hadir' | 'tidak_hadir' | 'pending'

/** What the status tabs show: the RSVP itself plus the invitation's delivery state. */
type StatusChoice = 'belum_terkirim' | 'pending' | 'hadir' | 'tidak_hadir'

export type SaveFlags = { isSent?: boolean; isCheckedIn?: boolean; rsvpStatus?: RsvpChoice }

export type BodyProps = {
  guest: Guest | null
  categories: string[]
  sessions: string[]
  onSave: (form: GuestForm, flags: SaveFlags) => Promise<void>
  onCopyLink?: () => void
  onDelete?: () => void
}

const statusChoices: { value: StatusChoice; label: string }[] = [
  { value: 'belum_terkirim', label: 'Unsent' },
  { value: 'pending', label: 'Pending' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'tidak_hadir', label: 'Absen' },
]

function rsvpOf(guest: Guest | null): RsvpChoice {
  if (guest?.rsvp_status === 'hadir') return 'hadir'
  if (guest?.rsvp_status === 'tidak_hadir' || guest?.rsvp_status === 'absen') return 'tidak_hadir'
  return 'pending'
}

/**
 * Guest form grouped like iOS Settings: one wrapper per section, rows separated by
 * hairline dividers, and the status rows last so a mistaken RSVP can be corrected.
 */
export function GuestSheetBody({ guest, categories, sessions, onSave, onCopyLink, onDelete }: BodyProps) {
  const fieldId = useId()
  const [form, setForm] = useState<GuestForm>(
    guest
      ? {
          name: guest.group_name,
          category: guest.category,
          maxPax: guest.max_pax,
          phone: guest.phone ?? '',
          invitationType: guest.invitation_type === 'cetak' ? 'cetak' : 'digital',
          session: guest.session ?? sessions[0] ?? '',
        }
      : { ...emptyForm, session: sessions[0] ?? '' },
  )
  const [rsvp, setRsvp] = useState<RsvpChoice>(rsvpOf(guest))
  const [sent, setSent] = useState(guest?.is_sent ?? false)
  const [checkedIn, setCheckedIn] = useState(guest?.is_checked_in ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof GuestForm>(key: K, value: GuestForm[K]) => setForm(f => ({ ...f, [key]: value }))

  // A printed invitation always counts as sent and present, as the RPC enforces.
  const isPrint = form.invitationType === 'cetak'
  // A checked-in guest has clearly arrived, even when the RSVP row was never written.
  const status: StatusChoice = isPrint || checkedIn
    ? 'hadir'
    : !sent
      ? 'belum_terkirim'
      : rsvp === 'pending'
        ? 'pending'
        : rsvp

  /** One control drives all three switches, so the states can never contradict each other. */
  const pickStatus = (next: StatusChoice) => {
    if (next === 'belum_terkirim') {
      setSent(false)
      setRsvp('pending')
      setCheckedIn(false)
      return
    }
    setSent(true)
    // "Pending" means the invitation arrived but has not been answered yet.
    setRsvp(next === 'pending' ? 'pending' : next)
    // Only "Hadir" can sit next to a check-in; the other states have not arrived.
    if (next !== 'hadir') setCheckedIn(false)
  }

  // Clearing the delivery state resets the guest: no RSVP and no check-in yet.
  const changeSent = (next: boolean) => {
    setSent(next)
    if (next) return
    setRsvp('pending')
    setCheckedIn(false)
  }

  // Someone who is checked in must have arrived, so the RSVP and the delivery follow.
  const changeCheckedIn = (next: boolean) => {
    setCheckedIn(next)
    if (!next) return
    setRsvp('hadir')
    setSent(true)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Nama tamu wajib diisi.')
    if (form.maxPax < 1) return setError('Jumlah orang minimal 1.')
    setBusy(true)
    try {
      await onSave(
        { ...form, name: form.name.trim(), phone: form.phone.trim() },
        guest
          ? {
              isSent: isPrint ? true : sent,
              isCheckedIn: checkedIn,
              rsvpStatus: isPrint || checkedIn ? 'hadir' : rsvp,
            }
          : {},
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tamu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="ios-form" onSubmit={submit}>
      <section className="ios-group" aria-label="Data tamu">
        <div className="ios-group-body">
          <div className="ios-row">
            <Input label="Nama tamu" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="ios-row">
            <Input
              label="No. WhatsApp"
              type="tel"
              inputMode="tel"
              placeholder="Opsional"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </div>
          <div className="ios-row">
            <Select label="Kategori" value={form.category} onValueChange={v => set('category', v)} options={categories.map(c => ({ value: c, label: c }))} />
          </div>
          <div className="ios-row ios-row-stepper">
            <span className="ios-row-label" id={`${fieldId}-pax`}>Jumlah orang</span>
            <div data-beui className="ios-stepper-scale">
              <AdaptiveStepper
                value={form.maxPax}
                min={1}
                max={50}
                onValueChange={v => set('maxPax', v)}
                aria-label="Jumlah orang"
              >
                <AdaptiveStepperDecrement />
                <AdaptiveStepperValue />
                <AdaptiveStepperIncrement />
              </AdaptiveStepper>
            </div>
          </div>
        </div>
      </section>

      <section className="ios-group" aria-label="Konfigurasi undangan">
        <div className="ios-group-body">
          <div className="ios-row">
            <Select
              label="Jenis undangan"
              value={form.invitationType}
              onValueChange={v => set('invitationType', v as 'digital' | 'cetak')}
              options={[{ value: 'digital', label: 'Digital' }, { value: 'cetak', label: 'Cetak' }]}
            />
          </div>
          {sessions.length > 0 && (
            <div className="ios-row">
              <Select label="Sesi" value={form.session} onValueChange={v => set('session', v)} options={sessions.map(s => ({ value: s, label: s }))} />
            </div>
          )}
        </div>
      </section>

      {guest && (
        <section className="ios-group" aria-label="Status tamu">
          <div className="ios-group-body">
            <div className="ios-row ios-row-stack">
              <span className="ios-row-label" id={`${fieldId}-status`}>Status RSVP</span>
              <div data-beui className="w-full">
                <Tabs value={status} onValueChange={v => pickStatus(v as StatusChoice)} variant="segment">
                  <TabsList aria-label="Status tamu" className="w-full rounded-full" wrapperClassName="rounded-full">
                    {statusChoices.map(choice => (
                      <TabsTrigger
                        key={choice.value}
                        value={choice.value}
                        disabled={isPrint}
                        className="min-h-9 rounded-full text-xs font-medium"
                        indicatorClassName="rounded-full"
                      >
                        {choice.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="ios-row">
              <span className="ios-row-label" id={`${fieldId}-sent`}>Undangan terkirim</span>
              <Switch
                aria-labelledby={`${fieldId}-sent`}
                checked={isPrint || sent}
                disabled={isPrint}
                onCheckedChange={changeSent}
              />
            </div>
            <div className="ios-row">
              <span className="ios-row-label" id={`${fieldId}-checkin`}>Sudah check-in</span>
              <Switch
                aria-labelledby={`${fieldId}-checkin`}
                checked={checkedIn}
                onCheckedChange={changeCheckedIn}
              />
            </div>
          </div>
          {isPrint && (
            <p className="ios-group-note">Undangan cetak otomatis tercatat terkirim dan hadir.</p>
          )}
        </section>
      )}

      {error && <p role="alert" className="form-error">{error}</p>}

      {guest && onCopyLink && (
        <section className="ios-group" aria-label="Tautan undangan">
          <div className="ios-group-body">
            <button type="button" className="ios-action" onClick={onCopyLink}>
              <Copy size={17} strokeWidth={1.9} aria-hidden />
              Salin tautan undangan
            </button>
          </div>
        </section>
      )}

      {guest && onDelete && (
        <section className="ios-group" aria-label="Hapus tamu">
          <div className="ios-group-body">
            <button type="button" className="ios-action is-destructive" onClick={onDelete}>
              <Trash2 size={17} strokeWidth={1.9} aria-hidden />
              Hapus tamu
            </button>
          </div>
        </section>
      )}

      <div className="ios-form-save">
        <Button type="submit" variant="accent" size="xl" fullWidth disabled={busy}>
          {busy ? 'Menyimpan…' : guest ? 'Simpan perubahan' : 'Tambah tamu'}
        </Button>
      </div>
    </form>
  )
}
