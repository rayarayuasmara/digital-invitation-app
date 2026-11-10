import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Input } from '@/components/arc/input/input'
import { NumberField } from '@/components/arc/number-field/number-field'
import { Select } from '@/components/arc/select/select'
import { Sheet } from '@/components/Sheet'
import type { DashboardData } from '@/lib/dashboard'
import { addGuest, deleteGuest, markSent, updateGuest } from '@/lib/guests'
import type { Guest, GuestForm } from '@/lib/guests'

type Filter = 'semua' | 'hadir' | 'tidak_hadir' | 'pending' | 'belum_terkirim' | 'check_in'

const filters: { value: Filter; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'tidak_hadir', label: 'Tidak hadir' },
  { value: 'pending', label: 'Pending' },
  { value: 'belum_terkirim', label: 'Belum terkirim' },
  { value: 'check_in', label: 'Sudah check-in' },
]

const emptyForm: GuestForm = { name: '', category: 'Umum', maxPax: 1, phone: '', invitationType: 'digital', session: '' }

function matches(g: Guest, f: Filter) {
  if (f === 'semua') return true
  if (f === 'hadir') return g.rsvp_status === 'hadir'
  if (f === 'tidak_hadir') return g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen'
  if (f === 'pending') return (!g.rsvp_status || g.rsvp_status === 'pending') && g.is_sent
  if (f === 'belum_terkirim') return !g.is_sent
  return g.is_checked_in
}

function statusBadge(g: Guest): { text: string; tone: 'ok' | 'bad' | '' } {
  if (g.is_checked_in) return { text: 'Check-in', tone: 'ok' }
  if (g.rsvp_status === 'hadir') return { text: 'Hadir', tone: 'ok' }
  if (g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen') return { text: 'Tidak hadir', tone: 'bad' }
  if (!g.is_sent) return { text: 'Belum terkirim', tone: '' }
  return { text: 'Pending', tone: '' }
}

type Props = {
  data: DashboardData
  onChanged: () => Promise<void>
  notify: (message: string) => void
  /** Increment to open the new-guest sheet, for example from the tab bar action. */
  createSignal: number
}

export function GuestsPanel({ data, onChanged, notify, createSignal }: Props) {
  const event = data.event!
  const guests = data.guests as Guest[]
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('semua')
  const [sheet, setSheet] = useState<{ mode: 'new' } | { mode: 'edit'; guest: Guest } | null>(null)

  useEffect(() => {
    if (createSignal > 0) setSheet({ mode: 'new' })
  }, [createSignal])

  const categories = useMemo(() => {
    const set = new Set(['Keluarga', 'Teman', 'Umum', 'VIP', 'Artis', 'Tetangga', ...guests.map(g => g.category)])
    return [...set].filter(Boolean)
  }, [guests])

  const sessions = (event.sessions ?? []).map(s => s.name)

  const visible = guests
    .filter(g => g.group_name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(g => matches(g, filter))
    .sort((a, b) => a.group_name.localeCompare(b.group_name))

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn()
      notify(ok)
      await onChanged()
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    }
  }

  const copyLink = async (g: Guest) => {
    const url = `${window.location.origin}/${event.slug}/${g.invitation_token}`
    try {
      await navigator.clipboard.writeText(url)
      notify(`Tautan ${g.group_name} disalin`)
    } catch {
      notify('Gagal menyalin tautan.')
    }
  }

  const close = () => setSheet(null)

  return (
    <>
      <h1 className="page-title">Tamu</h1>
      <p className="page-sub">{guests.length} tamu terdaftar</p>

      <label className="search">
        <Search size={18} aria-hidden color="var(--sub)" />
        <input
          type="search"
          placeholder="Cari nama tamu"
          aria-label="Cari nama tamu"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="icon-btn" style={{ width: 26, height: 26, border: 0 }} onClick={() => setQuery('')} aria-label="Hapus pencarian">
            <X size={14} aria-hidden />
          </button>
        )}
      </label>

      <div className="chips" role="group" aria-label="Filter tamu">
        {filters.map(f => (
          <button key={f.value} type="button" className="chip" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 && <p className="empty">Tidak ada tamu yang sesuai.</p>}

      <ul className="list" style={{ marginTop: 8 }}>
        {visible.map(g => {
          const badge = statusBadge(g)
          return (
            <li key={g.id}>
              <button type="button" className="list-row" onClick={() => setSheet({ mode: 'edit', guest: g })}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="name">{g.group_name}</p>
                  <p className="meta">{g.category} · {g.max_pax} orang</p>
                </div>
                <span className={`badge ${badge.tone === 'ok' ? 'badge-ok' : badge.tone === 'bad' ? 'badge-bad' : ''}`}>{badge.text}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <Sheet
        open={sheet !== null}
        title={sheet?.mode === 'edit' ? 'Ubah tamu' : 'Tamu baru'}
        onClose={close}
      >
        {sheet && (
          <GuestSheetBody
            key={sheet.mode === 'edit' ? sheet.guest.id : 'new'}
            guest={sheet.mode === 'edit' ? sheet.guest : null}
            categories={categories}
            sessions={sessions}
            onCancel={close}
            onSave={async form => {
              await run(async () => {
                if (sheet.mode === 'edit') await updateGuest(sheet.guest, event.id, form)
                else await addGuest(event.id, form)
              }, sheet.mode === 'edit' ? 'Tamu diperbarui' : 'Tamu ditambahkan')
              close()
            }}
            onCopyLink={sheet.mode === 'edit' ? () => copyLink(sheet.guest) : undefined}
            onMarkSent={sheet.mode === 'edit' && !sheet.guest.is_sent && sheet.guest.invitation_type !== 'cetak'
              ? () => run(() => markSent(sheet.guest.id), 'Ditandai terkirim').then(close)
              : undefined}
            onDelete={sheet.mode === 'edit' ? () => run(() => deleteGuest(sheet.guest.id), 'Tamu dihapus').then(close) : undefined}
          />
        )}
      </Sheet>
    </>
  )
}

type BodyProps = {
  guest: Guest | null
  categories: string[]
  sessions: string[]
  onCancel: () => void
  onSave: (form: GuestForm) => Promise<void>
  onCopyLink?: () => void
  onMarkSent?: () => void
  onDelete?: () => void
}

function GuestSheetBody({ guest, categories, sessions, onCancel, onSave, onCopyLink, onMarkSent, onDelete }: BodyProps) {
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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = <K extends keyof GuestForm>(key: K, value: GuestForm[K]) => setForm(f => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Nama tamu wajib diisi.')
    if (form.maxPax < 1) return setError('Jumlah orang minimal 1.')
    setBusy(true)
    try {
      await onSave({ ...form, name: form.name.trim(), phone: form.phone.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tamu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="sheet-body" onSubmit={submit}>
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

      {error && <p role="alert" style={{ margin: 0, color: 'var(--red-ink)' }}>{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan'}
      </button>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>

      {guest && (onCopyLink || onMarkSent || onDelete) && (
        <div style={{ display: 'grid', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          {onCopyLink && <button type="button" className="btn btn-secondary" onClick={onCopyLink}>Salin tautan undangan</button>}
          {onMarkSent && <button type="button" className="btn btn-secondary" onClick={onMarkSent}>Tandai terkirim</button>}
          {onDelete && (
            <>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Hapus tamu</button>
              <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <DialogContent title={`Hapus ${guest.group_name}?`} description="Data tamu ini akan dihapus dan tidak bisa dikembalikan.">
                  <div style={{ display: 'grid', gap: 10 }}>
                    <button type="button" className="btn btn-danger" onClick={() => { setConfirmDelete(false); onDelete() }}>Ya, hapus</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Batal</button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      )}
    </form>
  )
}
