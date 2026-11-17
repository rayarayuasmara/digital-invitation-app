import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/arc/button/button'
import { Input } from '@/components/arc/input/input'
import { NumberField } from '@/components/arc/number-field/number-field'
import { Select } from '@/components/arc/select/select'
import { Switch } from '@/components/arc/switch/switch'
import type { Guest, GuestForm } from '@/lib/guests'
import { emptyForm } from './guest-helpers'

export type BodyProps = {
  guest: Guest | null
  categories: string[]
  sessions: string[]
  onSave: (form: GuestForm, flags: { isSent?: boolean; isCheckedIn?: boolean }) => Promise<void>
  onCopyLink?: () => void
  onDelete?: () => void
}

export function GuestSheetBody({ guest, categories, sessions, onSave, onCopyLink, onDelete }: BodyProps) {
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
  const [sent, setSent] = useState(guest?.is_sent ?? false)
  const [checkedIn, setCheckedIn] = useState(guest?.is_checked_in ?? false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof GuestForm>(key: K, value: GuestForm[K]) => setForm(f => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Nama tamu wajib diisi.')
    if (form.maxPax < 1) return setError('Jumlah orang minimal 1.')
    setBusy(true)
    try {
      await onSave(
        { ...form, name: form.name.trim(), phone: form.phone.trim() },
        guest ? { isSent: form.invitationType === 'cetak' ? true : sent, isCheckedIn: checkedIn } : {},
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tamu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="sheet-form" onSubmit={submit}>
      <Input label="Nama tamu" value={form.name} onChange={e => set('name', e.target.value)} required />
      <Input label="No. WhatsApp (opsional)" type="tel" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
      <Select label="Kategori" value={form.category} onValueChange={v => set('category', v)} options={categories.map(c => ({ value: c, label: c }))} />
      <NumberField label="Jumlah orang" value={form.maxPax} min={1} max={50} onValueChange={v => set('maxPax', v)} />
      <Select
        label="Jenis undangan"
        value={form.invitationType}
        onValueChange={v => set('invitationType', v as 'digital' | 'cetak')}
        options={[{ value: 'digital', label: 'Digital' }, { value: 'cetak', label: 'Cetak' }]}
      />
      {sessions.length > 0 && (
        <Select label="Sesi" value={form.session} onValueChange={v => set('session', v)} options={sessions.map(s => ({ value: s, label: s }))} />
      )}

      {guest && (
        <div className="switch-list">
          <Switch
            label="Undangan terkirim"
            checked={form.invitationType === 'cetak' ? true : sent}
            onCheckedChange={setSent}
            disabled={form.invitationType === 'cetak'}
          />
          <Switch
            label="Sudah check-in"
            checked={checkedIn}
            onCheckedChange={setCheckedIn}
          />
        </div>
      )}

      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="sheet-actions">
        <Button type="submit" variant="accent" size="xl" fullWidth disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>

      {guest && (onCopyLink || onDelete) && (
        <div className="sheet-secondary">
          {onCopyLink && <Button type="button" variant="accentOutline" size="xl" fullWidth onClick={onCopyLink}>Salin tautan undangan</Button>}
          {onDelete && <Button type="button" variant="dangerSoft" size="xl" fullWidth onClick={onDelete}>Hapus tamu</Button>}
        </div>
      )}
    </form>
  )
}
