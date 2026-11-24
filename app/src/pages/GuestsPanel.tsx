import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { SearchField } from '@/components/arc/search-field/search-field'
import { PageHeader } from '@/components/PageHeader'
import { Scrim } from '@/components/Scrim'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import type { DashboardData } from '@/lib/dashboard'
import { addGuest, deleteGuest, markSent, updateGuest } from '@/lib/guests'
import type { Guest } from '@/lib/guests'
import { messageFor, normalizePhone, openWhatsApp } from '@/lib/whatsapp'
import { useCollapseProgress } from '@/lib/hooks/use-collapse-progress'
import { GuestFilterMenu } from './guests/GuestFilterMenu'
import { GuestGrid } from './guests/GuestGrid'
import { GuestSheetBody } from './guests/GuestSheetBody'
import { matches, statusTabs } from './guests/guest-helpers'
import type { SortKey } from './guests/guest-helpers'

export type { GuestStatus } from './guests/guest-helpers'

type Props = {
  data: DashboardData
  onChanged: () => Promise<void>
  notify: (message: string) => void
  /** Non-zero asks for the new-guest sheet. The panel calls onCreateHandled to reset it. */
  createRequest: number
  onCreateHandled: () => void
  search: URLSearchParams
  onFilterChange: (patch: Record<string, string | string[] | null>) => void
  onOpenAccount: () => void
}

export function GuestsPanel({ data, onChanged, notify, createRequest, onCreateHandled, search, onFilterChange, onOpenAccount }: Props) {
  const event = data.event!
  const guests = data.guests as Guest[]
  const query = search.get('cari') ?? ''
  const status = statusTabs.find(item => item.value === search.get('status'))?.value ?? 'semua'
  const categories = useMemo(() => search.getAll('kategori'), [search])
  const types = useMemo(() => search.getAll('jenis'), [search])
  const sessions = useMemo(() => search.getAll('sesi'), [search])
  const order = search.get('urut')
  const sort: SortKey = order === 'dibuat' || order === 'diubah' ? order : 'nama'
  const asc = search.get('arah') !== 'turun'
  const [sheet, setSheet] = useState<{ mode: 'new' } | { mode: 'edit'; guest: Guest } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const stickyRef = useRef<HTMLDivElement>(null)
  const sheetTrigger = useRef<HTMLElement | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  useCollapseProgress(stickyRef)

  useEffect(() => {
    if (createRequest === 0) return
    sheetTrigger.current = document.querySelector<HTMLButtonElement>('button.fab')
    setSheet({ mode: 'new' })
    onCreateHandled()
  }, [createRequest, onCreateHandled])

  const openSheet = (next: NonNullable<typeof sheet>) => {
    sheetTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSheet(next)
  }

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
      onFilterChange({ arah: asc ? 'turun' : null })
      return
    }
    onFilterChange({ urut: next === 'nama' ? null : next, arah: next === 'nama' ? null : 'turun' })
  }

  const activeFilters = categories.length + types.length + sessions.length


  const resetFilters = () => onFilterChange({ kategori: null, jenis: null, sesi: null })

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

  const requestDelete = (guest: Guest) => {
    setDeleteError('')
    setDeleteTarget(guest)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteGuest(deleteTarget.id)
      setDeleteTarget(null)
      setSheet(null)
      notify('Tamu dihapus')
      await onChanged()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Gagal menghapus tamu. Coba lagi.')
    } finally {
      setDeleting(false)
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

  return (
    <div className="guests-page">
      <PageHeader
        sticky={false}
        title="Tamu"
        subtitle={<p className="page-sub">{visible.length} dari {guests.length} tamu</p>}
        account={{ name: data.client.name, onOpen: onOpenAccount }}
      />

      {/* Search and filters stay pinned while the list scrolls */}
      <div className={`guests-sticky${filterOpen ? ' is-raised' : ''}`} ref={stickyRef}>
        <span className="progressive-blur" aria-hidden="true" />
        <div className="guests-toolbar">
          <div className="guests-search-field">
            <SearchField
              label="Cari nama tamu"
              className="guests-search"
              placeholder="Cari nama tamu…"
              value={query}
              onValueChange={value => onFilterChange({ cari: value })}
            />
          </div>
          <GuestFilterMenu
            open={filterOpen}
            onOpenChange={setFilterOpen}
            sort={sort}
            asc={asc}
            onPickSort={pickSort}
            categoryOptions={categoryOptions}
            categories={categories}
            onCategories={value => onFilterChange({ kategori: value })}
            types={types}
            onTypes={value => onFilterChange({ jenis: value })}
            sessionOptions={sessionOptions}
            sessions={sessions}
            onSessions={value => onFilterChange({ sesi: value })}
            activeFilters={activeFilters}
            onReset={resetFilters}
          />
        </div>

        {/* Keep the status filters scrollable on smaller screens. */}
        <div className="list-controls guests-status-controls">
          <div className="status-tabs" data-beui>
            <Tabs
              value={status}
              onValueChange={(value: string) => onFilterChange({ status: value === 'semua' ? null : value })}
              labels={{ scrollLeft: 'Gulir filter ke kiri', scrollRight: 'Gulir filter ke kanan' }}
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

      <AnimatePresence>
        {filterOpen && <Scrim key="filter-scrim" />}
      </AnimatePresence>

      {/* Guest grid or list */}
      {visible.length === 0 && (
        <div className="guests-empty">
          {guests.length === 0 ? (
            <>
              <p>Belum ada tamu.</p>
              <Button type="button" variant="accent" size="sm" onClick={() => openSheet({ mode: 'new' })}>
                Tambah tamu pertama
              </Button>
            </>
          ) : (
            <>
              <p>Tidak ada tamu yang cocok dengan pencarian atau filter.</p>
              <Button type="button" variant="secondary" size="sm" onClick={() =>
                onFilterChange({ cari: null, status: null, kategori: null, jenis: null, sesi: null })
              }>
                Hapus pencarian dan filter
              </Button>
            </>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <GuestGrid
          guests={visible}
          onOpen={guest => openSheet({ mode: 'edit', guest })}
          onCopyLink={copyLink}
          onSendWhatsApp={sendWhatsApp}
          onDelete={requestDelete}
        />
      )}

      {/* Sheet untuk add/edit guest */}
      <BottomSheet
        open={sheet !== null}
        onOpenChange={open => { if (!open) close() }}
        title={sheet?.mode === 'edit' ? 'Ubah tamu' : 'Tamu baru'}
        closeLabel="Tutup formulir tamu"
        onCloseAutoFocus={event => {
          event.preventDefault()
          const trigger = sheetTrigger.current
          const fallback = document.querySelector<HTMLButtonElement>('button.fab')
          const target = trigger?.isConnected && trigger !== document.body ? trigger : fallback
          target?.focus({ preventScroll: true })
        }}
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
              if (sheet.mode === 'edit') await updateGuest(sheet.guest, event.id, form, flags)
              else await addGuest(event.id, form)
              close()
              notify(sheet.mode === 'edit' ? 'Tamu diperbarui' : 'Tamu ditambahkan')
              await onChanged()
            }}
            onCopyLink={sheet.mode === 'edit' ? () => copyLink(sheet.guest) : undefined}
            onDelete={sheet.mode === 'edit' ? () => requestDelete(sheet.guest) : undefined}
          />
        )}
      </BottomSheet>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null) }}>
        {deleteTarget && (
          <DialogContent title={`Hapus ${deleteTarget.group_name}?`} description="Data tamu ini akan dihapus dan tidak bisa dikembalikan.">
            <div className="dialog-actions">
              {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
              <Button
                type="button"
                variant="dangerSoft"
                size="xl"
                fullWidth
                loading={deleting}
                onClick={confirmDelete}
              >
                Ya, hapus
              </Button>
              <Button type="button" variant="accentOutline" size="xl" fullWidth disabled={deleting} onClick={() => setDeleteTarget(null)}>Batal</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
