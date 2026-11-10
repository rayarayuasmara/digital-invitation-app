import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/arc/button/button'
import { ConfirmMorph } from '@/components/arc/confirm-morph/confirm-morph'
import { Input } from '@/components/arc/input/input'
import { NumberField } from '@/components/arc/number-field/number-field'
import { SearchField } from '@/components/arc/search-field/search-field'
import { Select } from '@/components/arc/select/select'
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

function statusLabel(g: Guest) {
  if (g.is_checked_in) return 'Sudah check-in'
  if (g.rsvp_status === 'hadir') return 'Hadir'
  if (g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen') return 'Tidak hadir'
  if (!g.is_sent) return 'Belum terkirim'
  return 'Pending'
}

type Props = {
  data: DashboardData
  onChanged: () => Promise<void>
}

export function GuestsPanel({ data, onChanged }: Props) {
  const event = data.event!
  const guests = data.guests as Guest[]
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('semua')
  const [editing, setEditing] = useState<Guest | 'new' | null>(null)
  const [message, setMessage] = useState('')

  const categories = useMemo(() => {
    const set = new Set(['Keluarga', 'Teman', 'Umum', 'VIP', 'Artis', 'Tetangga', ...guests.map(g => g.category)])
    return [...set].filter(Boolean)
  }, [guests])

  const sessions = (event.sessions ?? []) as { name: string; time_text?: string }[]

  const visible = guests
    .filter(g => g.group_name.toLowerCase().includes(query.trim().toLowerCase()))
    .filter(g => matches(g, filter))
    .sort((a, b) => a.group_name.localeCompare(b.group_name))

  const copyLink = async (g: Guest) => {
    const url = `${window.location.origin}/${event.slug}/${g.invitation_token}`
    await navigator.clipboard.writeText(url)
    setMessage(`Tautan ${g.group_name} disalin`)
  }

  const run = async (fn: () => Promise<void>, ok: string) => {
    setMessage('')
    try {
      await fn()
      setMessage(ok)
      await onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    }
  }

  if (editing) {
    return (
      <GuestFormView
        guest={editing === 'new' ? null : editing}
        categories={categories}
        sessions={sessions.map(s => s.name)}
        onCancel={() => setEditing(null)}
        onSave={async (form) => {
          await run(async () => {
            if (editing === 'new') await addGuest(event.id, form)
            else await updateGuest(editing, event.id, form)
          }, editing === 'new' ? 'Tamu ditambahkan' : 'Tamu diperbarui')
          setEditing(null)
        }}
      />
    )
  }

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px' }}>
          <SearchField label="Cari tamu" value={query} onValueChange={setQuery} placeholder="Cari nama tamu" />
        </div>
        <Button variant="primary" size="md" style={brandButton} onClick={() => setEditing('new')}>Tambah tamu</Button>
      </div>

      <div role="group" aria-label="Filter tamu" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            style={{
              ...chip,
              background: filter === f.value ? 'var(--accent)' : 'var(--surface)',
              color: filter === f.value ? 'var(--accent-foreground)' : 'var(--foreground)',
              borderColor: filter === f.value ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {message && <p role="status" style={{ margin: 0, color: 'var(--text-secondary)' }}>{message}</p>}

      {visible.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>Tidak ada tamu yang sesuai.</p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {visible.map(g => (
          <li key={g.id} style={row}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.group_name}</p>
              <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                {g.category} · {g.max_pax} orang · {statusLabel(g)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={() => copyLink(g)}>Salin tautan</Button>
              {!g.is_sent && g.invitation_type !== 'cetak' && (
                <Button variant="ghost" size="sm" onClick={() => run(() => markSent(g.id), 'Ditandai terkirim')}>Tandai terkirim</Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setEditing(g)}>Ubah</Button>
              <ConfirmMorph
                label="Hapus"
                prompt={`Hapus ${g.group_name}?`}
                confirmLabel="Ya, hapus"
                cancelLabel="Batal"
                pendingLabel="Menghapus…"
                doneLabel="Terhapus"
                tone="danger"
                onConfirm={() => run(() => deleteGuest(g.id), 'Tamu dihapus')}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

type FormProps = {
  guest: Guest | null
  categories: string[]
  sessions: string[]
  onCancel: () => void
  onSave: (form: GuestForm) => Promise<void>
}

function GuestFormView({ guest, categories, sessions, onCancel, onSave }: FormProps) {
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
    <form onSubmit={submit} style={{ display: 'grid', gap: 16, maxWidth: 480 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{guest ? 'Ubah tamu' : 'Tamu baru'}</h2>

      <Input label="Nama tamu" value={form.name} onChange={e => set('name', e.target.value)} required />
      <Input label="No. WhatsApp (opsional)" type="tel" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />

      <Select
        label="Kategori"
        value={form.category}
        onValueChange={v => set('category', v)}
        options={categories.map(c => ({ value: c, label: c }))}
      />

      <NumberField label="Jumlah orang" value={form.maxPax} min={1} max={50} onValueChange={v => set('maxPax', v)} />

      <Select
        label="Jenis undangan"
        value={form.invitationType}
        onValueChange={v => set('invitationType', v as 'digital' | 'cetak')}
        options={[{ value: 'digital', label: 'Digital' }, { value: 'cetak', label: 'Cetak' }]}
      />

      {sessions.length > 0 && (
        <Select
          label="Sesi"
          value={form.session}
          onValueChange={v => set('session', v)}
          options={sessions.map(s => ({ value: s, label: s }))}
        />
      )}

      {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>Batal</Button>
        <Button type="submit" variant="primary" loading={busy} style={brandButton}>Simpan</Button>
      </div>
    </form>
  )
}

const brandButton = {
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: 'var(--accent-foreground)',
} as const

const chip = {
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  font: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
} as const

const row = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '12px 16px',
  background: 'var(--surface)',
} as const
