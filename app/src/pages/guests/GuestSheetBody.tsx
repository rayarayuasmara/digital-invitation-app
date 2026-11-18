import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { NumberField } from '@/components/arc/number-field/number-field'
import { Select } from '@/components/arc/select/select'
import { Switch } from '@/components/arc/switch/switch'
import type { Guest, GuestForm } from '@/lib/guests'
import { emptyForm } from './guest-helpers'

/** The three states a client can set by hand; `pending` clears the RSVP row. */
export type RsvpChoice = 'hadir' | 'tidak_hadir' | 'pending'

export type SaveFlags = { isSent?: boolean; isCheckedIn?: boolean; rsvpStatus?: RsvpChoice }

export type BodyProps = {
  guest: Guest | null
  categories: string[]
  sessions: string[]
  onSave: (form: GuestForm, flags: SaveFlags) => Promise<void>
  onCopyLink?: () => void
  onDelete?: () => void
}

const rsvpChoices: { value: RsvpChoice; label: string }[] = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'pending', label: 'Belum RSVP' },
  { value: 'tidak_hadir', label: 'Tidak hadir' },
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
  const rsvpGroupId = useId()
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
  const shownRsvp: RsvpChoice = isPrint ? 'hadir' : rsvp

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
              rsvpStatus: isPrint ? 'hadir' : rsvp,
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
      <section className="ios-group" aria-labelledby={`${rsvpGroupId}-data`}>
        <h3 className="ios-group-title" id={`${rsvpGroupId}-data`}>Data tamu</h3>
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
          <div className="ios-row ios-row-number">
            <NumberField label="Jumlah orang" value={form.maxPax} min={1} max={50} onValueChange={v => set('maxPax', v)} />
          </div>
        </div>
      </section>

      <section className="ios-group" aria-labelledby={`${rsvpGroupId}-invitation`}>
        <h3 className="ios-group-title" id={`${rsvpGroupId}-invitation`}>Konfigurasi undangan</h3>
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
        <section className="ios-group" aria-labelledby={`${rsvpGroupId}-status`}>
          <h3 className="ios-group-title" id={`${rsvpGroupId}-status`}>Status tamu</h3>
          <div className="ios-group-body">
            <div className="ios-row ios-row-stack">
              <span className="ios-row-label" id={`${rsvpGroupId}-rsvp`}>Status RSVP</span>
              <div className="ios-segment" role="radiogroup" aria-labelledby={`${rsvpGroupId}-rsvp`}>
                {rsvpChoices.map(choice => (
                  <label key={choice.value} className="ios-segment-option" data-checked={shownRsvp === choice.value || undefined}>
                    <input
                      type="radio"
                      name={`${rsvpGroupId}-rsvp`}
                      value={choice.value}
                      checked={shownRsvp === choice.value}
                      disabled={isPrint}
                      onChange={() => setRsvp(choice.value)}
                    />
                    <span>{choice.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="ios-row">
              <span className="ios-row-label" id={`${rsvpGroupId}-sent`}>Undangan terkirim</span>
              <Switch
                aria-labelledby={`${rsvpGroupId}-sent`}
                checked={isPrint || sent}
                disabled={isPrint}
                onCheckedChange={setSent}
              />
            </div>
            <div className="ios-row">
              <span className="ios-row-label" id={`${rsvpGroupId}-checkin`}>Sudah check-in</span>
              <Switch
                aria-labelledby={`${rsvpGroupId}-checkin`}
                checked={checkedIn}
                onCheckedChange={setCheckedIn}
              />
            </div>
          </div>
          <p className="ios-group-note">
            {isPrint
              ? 'Undangan cetak otomatis tercatat terkirim dan hadir.'
              : 'Ubah status di sini untuk mengoreksi RSVP yang tidak sengaja, misalnya saat mencoba undangan.'}
          </p>
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
