import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Copy, MessageCircle, Pencil, Printer, RotateCcw, SlidersHorizontal, Smartphone, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import type { BadgeTone } from '@/components/arc/badge/badge'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { Input } from '@/components/arc/input/input'
import { SearchField } from '@/components/arc/search-field/search-field'
import { NumberField } from '@/components/arc/number-field/number-field'
import { Select } from '@/components/arc/select/select'
import { Switch } from '@/components/arc/switch/switch'
import { SwipeActions, SwipeActionsRow } from '@/components/arc/swipe-actions/swipe-actions'
import type { SwipeAction } from '@/components/arc/swipe-actions/swipe-actions'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/motion/dropdown-menu'
import type { DashboardData } from '@/lib/dashboard'
import { addGuest, deleteGuest, markSent, updateGuest } from '@/lib/guests'
import type { Guest, GuestForm } from '@/lib/guests'
import { messageFor, normalizePhone, openWhatsApp } from '@/lib/whatsapp'

export type GuestStatus = 'semua' | 'hadir' | 'tidak_hadir' | 'belum_rsvp' | 'pending' | 'belum_terkirim' | 'check_in'
type Status = GuestStatus
type SortKey = 'nama' | 'dibuat' | 'diubah'

const statusTabs: { value: Status; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  { value: 'hadir', label: 'Hadir' },
  { value: 'tidak_hadir', label: 'Tidak hadir' },
  { value: 'belum_rsvp', label: 'Belum RSVP' },
  { value: 'belum_terkirim', label: 'Belum terkirim' },
  { value: 'check_in', label: 'Check-in' },
]

const typeOptions = [
  { value: 'digital', label: 'Digital' },
  { value: 'cetak', label: 'Cetak' },
]

const sortFields: { value: SortKey; label: string; asc: string; desc: string }[] = [
  { value: 'nama', label: 'Nama', asc: 'A–Z', desc: 'Z–A' },
  { value: 'dibuat', label: 'Ditambahkan', asc: 'Terlama dulu', desc: 'Terbaru dulu' },
  { value: 'diubah', label: 'Update', asc: 'Terlama dulu', desc: 'Terbaru dulu' },
]

const emptyForm: GuestForm = { name: '', category: 'Umum', maxPax: 1, phone: '', invitationType: 'digital', session: '' }

function matches(g: Guest, f: Status) {
  if (f === 'semua') return true
  if (f === 'hadir') return g.rsvp_status === 'hadir'
  if (f === 'tidak_hadir') return g.rsvp_status === 'tidak_hadir' || g.rsvp_status === 'absen'
  if (f === 'belum_rsvp') return !g.rsvp_status || g.rsvp_status === 'pending'
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

  /**
   * Tapping the active sort field flips its direction instead of re-selecting it,
   * so one row covers both A–Z and Z–A.
   */
  const pickSort = (next: SortKey) => {
    if (sort === next) {
      setAsc(!asc)
      return
    }
    setSort(next)
    setAsc(next === 'nama')
  }

  const toggleFilter = (list: string[], setList: (next: string[]) => void, value: string, on: boolean) => {
    setList(on ? [...list, value] : list.filter(item => item !== value))
  }

  const activeFilters = categories.length + types.length + sessions.length

  const resetFilters = () => {
    setCategories([])
    setTypes([])
    setSessions([])
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
        <div className="page-head-copy">
          <h1 className="page-title">Tamu</h1>
          <p className="page-sub">{visible.length} dari {guests.length} tamu</p>
        </div>
      </div>

      {/* Search and filters stay pinned while the list scrolls */}
      <div className="guests-sticky">
        <div className="guests-toolbar">
          <div className="guests-search-field">
            <SearchField
              label="Cari nama tamu"
              className="guests-search"
              placeholder="Cari nama tamu…"
              value={query}
              onValueChange={setQuery}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                className="guests-filter"
                aria-label={`Filter tamu${activeFilters ? `, ${activeFilters} aktif` : ''}`}
              >
                <SlidersHorizontal size={18} aria-hidden />
                {activeFilters > 0 && <span className="guests-filter-count" aria-hidden>{activeFilters}</span>}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="beui-menu guests-filter-menu fm-sheet">
              <div className="fm-scroll">
                <section className="fm-section">
                  <p className="fm-header">Urutan</p>
                  <div className="fm-group">
                    {sortFields.map(option => {
                      const active = sort === option.value
                      return (
                        <DropdownMenuCheckboxItem
                          key={option.value}
                          className="fm-row fm-row-sort"
                          checked={active}
                          onCheckedChange={() => pickSort(option.value)}
                        >
                          <span className="fm-row-text">
                            <span>{option.label}</span>
                            {active && (
                              <span className="fm-row-sub">{asc ? option.asc : option.desc}</span>
                            )}
                          </span>
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                  </div>
                </section>

                <section className="fm-section">
                  <p className="fm-header">Kategori</p>
                  <div className="fm-group">
                    {categoryOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        className="fm-row"
                        checked={categories.includes(option.value)}
                        onCheckedChange={on => toggleFilter(categories, setCategories, option.value, on)}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </section>

                <section className="fm-section">
                  <p className="fm-header">Jenis undangan</p>
                  <div className="fm-group">
                    {typeOptions.map(option => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        className="fm-row"
                        checked={types.includes(option.value)}
                        onCheckedChange={on => toggleFilter(types, setTypes, option.value, on)}
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                </section>

                {sessionOptions.length > 0 && (
                  <section className="fm-section">
                    <p className="fm-header">Sesi acara</p>
                    <div className="fm-group">
                      {sessionOptions.map(option => (
                        <DropdownMenuCheckboxItem
                          key={option.value}
                          className="fm-row"
                          checked={sessions.includes(option.value)}
                          onCheckedChange={on => toggleFilter(sessions, setSessions, option.value, on)}
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {activeFilters > 0 && (
                <div className="fm-footer">
                  <button type="button" className="fm-btn fm-btn-reset" onClick={resetFilters}>
                    <RotateCcw size={15} aria-hidden />
                    Reset filter
                  </button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status tabs scroll sideways; the sort control stays pinned at the right edge */}
        <div className="list-controls">
          <div className="status-tabs" data-beui>
            <Tabs
              value={status}
              onValueChange={v => setStatus(v as Status)}
              variant="segment"
            >
              <TabsList
                aria-label="Filter status tamu"
                className="rounded-full"
                wrapperClassName="rounded-full"
              >
                {statusTabs.map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="min-h-10 rounded-full text-interface-label"
                    indicatorClassName="rounded-full"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
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
            <div className="dialog-actions">
              <Button
                type="button"
                variant="dangerSoft"
                size="xl"
                fullWidth
                onClick={() => {
                  const target = deleteTarget
                  setDeleteTarget(null)
                  setSheet(null)
                  run(() => deleteGuest(target.id), 'Tamu dihapus')
                }}
              >
                Ya, hapus
              </Button>
              <Button type="button" variant="accentOutline" size="xl" fullWidth onClick={() => setDeleteTarget(null)}>Batal</Button>
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
