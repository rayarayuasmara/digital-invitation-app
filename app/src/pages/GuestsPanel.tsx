import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowUp, Copy, MessageCircle, Pencil, Printer, Search, SlidersHorizontal, Smartphone, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import type { BadgeTone } from '@/components/arc/badge/badge'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { DropdownMenu } from '@/components/arc/dropdown-menu/dropdown-menu'
import { Input } from '@/components/arc/input/input'
import { MultiSelect } from '@/components/arc/multi-select/multi-select'
import { NumberField } from '@/components/arc/number-field/number-field'
import { Select } from '@/components/arc/select/select'
import { Switch } from '@/components/arc/switch/switch'
import { SwipeActions, SwipeActionsRow } from '@/components/arc/swipe-actions/swipe-actions'
import type { SwipeAction } from '@/components/arc/swipe-actions/swipe-actions'
import { Tabs, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import type { DashboardData } from '@/lib/dashboard'
import { addGuest, deleteGuest, markSent, updateGuest } from '@/lib/guests'
import type { Guest, GuestForm } from '@/lib/guests'
import { messageFor, normalizePhone, openWhatsApp } from '@/lib/whatsapp'

export type GuestStatus = 'semua' | 'hadir' | 'tidak_hadir' | 'pending' | 'belum_terkirim' | 'check_in'
type Status = GuestStatus
type SortKey = 'nama' | 'dibuat' | 'diubah'

const statusTabs: { value: Status; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'tidak_hadir', label: 'Tidak hadir' },
  { value: 'belum_terkirim', label: 'Belum terkirim' },
  { value: 'check_in', label: 'Check-in' },
]

const typeOptions = [
  { value: 'digital', label: 'Digital' },
  { value: 'cetak', label: 'Cetak' },
]

const sortLabel: Record<SortKey, string> = { nama: 'Nama', dibuat: 'Dibuat', diubah: 'Diubah' }

const emptyForm: GuestForm = { name: '', category: 'Umum', maxPax: 1, phone: '', invitationType: 'digital', session: '' }

function matches(g: Guest, f: Status) {
  if (f === 'semua') return true
  if (f === 'hadir') return g.rsvp_status === 'hadir'
  if (f === 'tidak_hadir') return g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen'
  if (f === 'pending') return (!g.rsvp_status || g.rsvp_status === 'pending') && g.is_sent
  if (f === 'belum_terkirim') return !g.is_sent
  return g.is_checked_in
}

function statusOf(g: Guest): { text: string; tone: BadgeTone } {
  if (g.is_checked_in) return { text: 'Check-in', tone: 'info' }
  if (g.rsvp_status === 'hadir') return { text: 'Hadir', tone: 'success' }
  if (g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen') return { text: 'Tidak hadir', tone: 'danger' }
  if (!g.is_sent) return { text: 'Belum terkirim', tone: 'neutral' }
  return { text: 'Pending', tone: 'warning' }
}

type Props = {
  data: DashboardData
  onChanged: () => Promise<void>
  notify: (message: string) => void
  /** Increment to open the new-guest sheet, for example from the tab bar action. */
  createSignal: number
  /** Status tab to start on, for example after tapping a metric on Beranda. */
  initialStatus?: GuestStatus
}

export function GuestsPanel({ data, onChanged, notify, createSignal, initialStatus = 'semua' }: Props) {
  const event = data.event!
  const guests = data.guests as Guest[]
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>(initialStatus)
  const [categories, setCategories] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [sessions, setSessions] = useState<string[]>([])
  const [sort, setSort] = useState<SortKey>('nama')
  const [asc, setAsc] = useState(true)
  const [sheet, setSheet] = useState<{ mode: 'new' } | { mode: 'edit'; guest: Guest } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null)

  useEffect(() => {
    if (createSignal > 0) setSheet({ mode: 'new' })
  }, [createSignal])

  const categoryOptions = useMemo(() => {
    const set = new Set(['Keluarga', 'Teman', 'Umum', 'VIP', 'Artis', 'Tetangga', ...guests.map(g => g.category)])
    return [...set].filter(Boolean).map(c => ({ value: c, label: c }))
  }, [guests])

  const sessionOptions = useMemo(() => {
    const set = new Set<string>([...(event.sessions ?? []).map(s => s.name), ...guests.map(g => g.session ?? '')])
    return [...set].filter(Boolean).map(s => ({ value: s, label: s }))
  }, [event.sessions, guests])

  // One MultiSelect carries all three facets: values are prefixed so the groups never collide.
  const filterGroups = useMemo(() => [
    { title: 'Kategori', options: categoryOptions.map(o => ({ value: `kategori:${o.value}`, label: o.label })) },
    { title: 'Jenis', options: typeOptions.map(o => ({ value: `jenis:${o.value}`, label: o.label })) },
    { title: 'Sesi', options: sessionOptions.map(o => ({ value: `sesi:${o.value}`, label: o.label })) },
  ].filter(group => group.options.length > 0), [categoryOptions, sessionOptions])

  const filterValue = [
    ...categories.map(v => `kategori:${v}`),
    ...types.map(v => `jenis:${v}`),
    ...sessions.map(v => `sesi:${v}`),
  ]

  const applyFilters = (next: string[]) => {
    setCategories(next.filter(v => v.startsWith('kategori:')).map(v => v.slice('kategori:'.length)))
    setTypes(next.filter(v => v.startsWith('jenis:')).map(v => v.slice('jenis:'.length)))
    setSessions(next.filter(v => v.startsWith('sesi:')).map(v => v.slice('sesi:'.length)))
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = guests
      .filter(g => g.group_name.toLowerCase().includes(q))
      .filter(g => matches(g, status))
      .filter(g => categories.length === 0 || categories.includes(g.category || 'Umum'))
      .filter(g => types.length === 0 || types.includes(g.invitation_type === 'cetak' ? 'cetak' : 'digital'))
      .filter(g => sessions.length === 0 || sessions.includes(g.session ?? ''))
    const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)
    const direction = asc ? 1 : -1
    if (sort === 'dibuat') list.sort((a, b) => direction * (time(a.created_at) - time(b.created_at)))
    else if (sort === 'diubah') list.sort((a, b) => direction * (time(a.updated_at) - time(b.updated_at)))
    else list.sort((a, b) => direction * a.group_name.localeCompare(b.group_name))
    return list
  }, [guests, query, status, categories, types, sessions, sort, asc])

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

  const sendWhatsApp = async (g: Guest) => {
    const message = messageFor(event, data.event?.wa_templates ?? null, g)
    if (!g.is_sent) {
      try {
        await markSent(g.id)
      } catch {
        /* status terkirim gagal disimpan, pesan tetap dibuka */
      }
    }
    const phone = normalizePhone(g.phone)
    if (phone) {
      openWhatsApp(phone, message)
      notify('Membuka WhatsApp…')
    } else {
      try {
        await navigator.clipboard.writeText(message)
        notify('Nomor WhatsApp kosong. Pesan disalin.')
      } catch {
        notify('Nomor WhatsApp kosong dan pesan gagal disalin.')
      }
    }
    await onChanged()
  }

  const close = () => setSheet(null)

  /** Same actions on the swipe and in the row menu, in the order people reach for them. */
  const rowActions = (g: Guest): SwipeAction[] => [
    { label: 'Copy link', icon: <Copy size={18} aria-hidden />, onSelect: () => copyLink(g) },
    ...(g.invitation_type !== 'cetak'
      ? [{ label: 'Kirim WA', icon: <MessageCircle size={18} aria-hidden />, tone: 'accent' as const, onSelect: () => sendWhatsApp(g) }]
      : []),
    { label: 'Edit', icon: <Pencil size={18} aria-hidden />, onSelect: () => setSheet({ mode: 'edit', guest: g }) },
    { label: 'Hapus', icon: <Trash2 size={18} aria-hidden />, tone: 'danger' as const, onSelect: () => setDeleteTarget(g) },
  ]

  return (
    <div className="guests-page">
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Tamu</h1>
          <p className="page-sub">{visible.length} dari {guests.length} tamu</p>
        </div>
      </div>

      {/* Search and filters stay pinned while the list scrolls */}
      <div className="guests-sticky">
        <div className="guests-toolbar">
          <div className="search">
            <Search size={18} aria-hidden color="var(--sub)" />
            <input
              type="search"
              placeholder="Cari nama tamu…"
              aria-label="Cari nama tamu"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Hapus pencarian">
                <X size={14} aria-hidden />
              </button>
            )}

            <MultiSelect
              compact
              icon={<SlidersHorizontal size={18} aria-hidden />}
              label="Filter tamu"
              groups={filterGroups}
              value={filterValue}
              onValueChange={applyFilters}
            />
          </div>
        </div>

        {/* Status tabs scroll sideways; the sort control stays pinned at the right edge */}
        <div className="list-controls">
          <Tabs value={status} onValueChange={v => setStatus(v as Status)} className="status-tabs">
            <TabsList aria-label="Filter status tamu">
              {statusTabs.map(t => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DropdownMenu
            label={sortLabel[sort]}
            icon={asc ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />}
            items={[
              { label: 'Nama (A-Z)', onSelect: () => { setSort('nama'); setAsc(true) } },
              { label: 'Nama (Z-A)', onSelect: () => { setSort('nama'); setAsc(false) } },
              { label: 'Terbaru ditambah', onSelect: () => { setSort('dibuat'); setAsc(false) } },
              { label: 'Terakhir diubah', onSelect: () => { setSort('diubah'); setAsc(false) } },
            ]}
          />
        </div>
      </div>

      {/* Guest grid or list */}
      {visible.length === 0 && (
        <div className="guests-empty">
          <p>Tidak ada tamu yang sesuai dengan filter.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="guests-grid">
          <SwipeActions label="Daftar tamu">
            {visible.map(g => {
              const { text: statusText, tone: statusTone } = statusOf(g)
              const actions = rowActions(g)
              return (
                <SwipeActionsRow key={g.id} label={g.group_name} leading={actions.slice(0, 2)} trailing={actions.slice(2)}>
                  <button
                    type="button"
                    className="guest-card"
                    onClick={() => setSheet({ mode: 'edit', guest: g })}
                  >
                    <div className={`guest-avatar ${g.invitation_type === 'cetak' ? 'is-print' : 'is-digital'}`}>
                      <Avatar name={g.group_name} size="lg" />
                      <span
                        className="guest-avatar-badge"
                        role="img"
                        aria-label={g.invitation_type === 'cetak' ? 'Undangan cetak' : 'Undangan digital'}
                      >
                        {g.invitation_type === 'cetak'
                          ? <Printer size={10} aria-hidden />
                          : <Smartphone size={10} aria-hidden />}
                      </span>
                    </div>
                    <div className="guest-card-content">
                      <p className="guest-card-name">{g.group_name}</p>
                      <div className="guest-card-badges">
                        <Badge size="sm" pill>{g.category || 'Umum'}</Badge>
                        <Badge size="sm" pill tone={statusTone}>{statusText}</Badge>
                        <Badge size="sm" pill>{g.max_pax} pax</Badge>
                      </div>
                    </div>
                  </button>
                </SwipeActionsRow>
              )
            })}
          </SwipeActions>
        </div>
      )}

      {/* Sheet untuk add/edit guest */}
      <BottomSheet
        open={sheet !== null}
        onOpenChange={open => { if (!open) close() }}
        title={sheet?.mode === 'edit' ? 'Ubah tamu' : 'Tamu baru'}
        description={sheet?.mode === 'edit' ? sheet.guest.group_name : undefined}
        detents={[0.94]}
        initialDetent={0}
      >
        {sheet && (
          <GuestSheetBody
            key={sheet.mode === 'edit' ? sheet.guest.id : 'new'}
            guest={sheet.mode === 'edit' ? sheet.guest : null}
            categories={categoryOptions.map(c => c.value)}
            sessions={sessionOptions.map(s => s.value)}
            onSave={async (form, flags) => {
              await run(async () => {
                if (sheet.mode === 'edit') await updateGuest(sheet.guest, event.id, form, flags)
                else await addGuest(event.id, form)
              }, sheet.mode === 'edit' ? 'Tamu diperbarui' : 'Tamu ditambahkan')
              close()
            }}
            onCopyLink={sheet.mode === 'edit' ? () => copyLink(sheet.guest) : undefined}
            onDelete={sheet.mode === 'edit' ? () => setDeleteTarget(sheet.guest) : undefined}
          />
        )}
      </BottomSheet>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        {deleteTarget && (
          <DialogContent title={`Hapus ${deleteTarget.group_name}?`} description="Data tamu ini akan dihapus dan tidak bisa dikembalikan.">
            <div style={{ display: 'grid', gap: 10 }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  const target = deleteTarget
                  setDeleteTarget(null)
                  setSheet(null)
                  run(() => deleteGuest(target.id), 'Tamu dihapus')
                }}
              >
                Ya, hapus
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Batal</button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

type BodyProps = {
  guest: Guest | null
  categories: string[]
  sessions: string[]
  onSave: (form: GuestForm, flags: { isSent?: boolean; isCheckedIn?: boolean }) => Promise<void>
  onCopyLink?: () => void
  onDelete?: () => void
}

function GuestSheetBody({ guest, categories, sessions, onSave, onCopyLink, onDelete }: BodyProps) {
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

      {error && <p role="alert" style={{ margin: 0, color: 'var(--red-ink)' }}>{error}</p>}

      <div className="sheet-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>

      {guest && (onCopyLink || onDelete) && (
        <div className="sheet-secondary">
          {onCopyLink && <button type="button" className="btn btn-secondary" onClick={onCopyLink}>Salin tautan undangan</button>}
          {onDelete && <button type="button" className="btn btn-danger" onClick={onDelete}>Hapus tamu</button>}
        </div>
      )}
    </form>
  )
}
