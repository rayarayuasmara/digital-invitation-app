import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ScanLine, X } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { ChatBubbleIcon } from '@/components/ChatBubbleIcon'
import { NavigationGlyph } from '@/components/NavigationGlyph'
import { Scrim } from '@/components/Scrim'
import { LiquidTabBar } from '@/components/arc/liquid-tab-bar/liquid-tab-bar'
import { NotificationCenter } from '@/components/arc/notification-center/notification-center'
import type { NotificationItem } from '@/components/arc/notification-center/notification-center'
import { motionTokens } from '@/components/arc/motion-tokens'

export type Tab = 'beranda' | 'tamu' | 'ucapan' | 'undangan'

const shortcutOffsets = [
  { x: 0, y: -96 },
  { x: -68, y: -68 },
  { x: -96, y: 0 },
]

type Props = {
  value: Tab
  onChange: (tab: Tab) => void
  onScanner: () => boolean
  onAddGuest: () => void
  /** Notifications for the speed-dial's bell; the panel is the beUI notification center. */
  notifications: NotificationItem[]
  /** Changes when the list must be rebuilt, so the panel shows fresh items. */
  notifKey: string
  onNotificationsOpenChange: (open: boolean) => void
  unreadNotifications: number
  /** Wishes the host has not read yet, shown on the Ucapan tab. */
  unreadWishes?: number
}

export function TabBar({ value, onChange, onScanner, onAddGuest, notifications, notifKey, onNotificationsOpenChange, unreadNotifications, unreadWishes = 0 }: Props) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const menuRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  const closeMenu = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => fabRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') {
        closeMenu()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(document.querySelectorAll<HTMLElement>(
        '.fab-menu button, button.fab, [data-radix-popper-content-wrapper] button, [data-radix-popper-content-wrapper] [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.getClientRects().length > 0 && !element.hasAttribute('disabled'))
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement as HTMLElement))) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeMenu])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => menuRef.current?.querySelector('button')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  const shortcuts = [
    { label: 'Pemindai tamu', icon: <ScanLine size={20} strokeWidth={2.5} aria-hidden />, run: onScanner },
    { label: 'Tambah tamu', icon: <NavigationGlyph name="addPerson" size={20} />, run: () => { onAddGuest(); return true } },
  ]

  const pick = (run: () => boolean) => {
    if (run()) setOpen(false)
    else closeMenu()
  }

  const changeTab = (tab: Tab) => {
    onChange(tab)
  }

  const spring = reduce ? { duration: 0 } : motionTokens.spring.snappy
  const shortcutMotion = (index: number) => ({
    initial: reduce ? false as const : { opacity: 0, x: 0, y: 0, scale: .55 },
    animate: { opacity: 1, ...shortcutOffsets[index], scale: 1 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, x: 0, y: 0, scale: .55 },
    transition: reduce ? spring : { ...spring, delay: index * .025 },
  })

  const tabs = [
    { value: 'beranda', label: 'Beranda', icon: <NavigationGlyph name="home" /> },
    { value: 'tamu', label: 'Tamu', icon: <NavigationGlyph name="people" /> },
    {
      value: 'ucapan',
      label: 'Ucapan',
      icon: <ChatBubbleIcon filled />,
      badge: unreadWishes,
      badgeLabel: `${unreadWishes} ucapan belum dibaca`,
    },
    { value: 'undangan', label: 'Undangan', icon: <NavigationGlyph name="envelope" /> },
  ]

  return (
    <>
      <AnimatePresence>
        {open && <Scrim key="fab-scrim" onDismiss={closeMenu} />}
      </AnimatePresence>

      <nav className="tabbar-wrap" aria-label="Menu utama">
        <div className={`tabbar-shell${open ? ' is-hidden' : ''}`} inert={open} aria-hidden={open || undefined}>
          <LiquidTabBar tabs={tabs} value={value} onValueChange={tab => changeTab(tab as Tab)} labels="always" label="Menu utama" />
        </div>

        <div className="fab-wrap">
          <div ref={menuRef} id={menuId} inert={!open} className="fab-menu" role="group" aria-label="Pintasan dashboard">
            <AnimatePresence>
              {open && shortcuts.map((item, index) => (
                <motion.button key={item.label} type="button" className="fab-menu-item" aria-label={item.label} title={item.label} onClick={() => pick(item.run)} {...shortcutMotion(index)} whileTap={reduce ? undefined : { scale: .92 }}>
                  {item.icon}
                </motion.button>
              ))}
              {open && (
                <motion.div key="notifikasi" className="fab-menu-notif" {...shortcutMotion(2)}>
                  <NotificationCenter
                    key={notifKey}
                    notifications={notifications}
                    label="Notifikasi"
                    triggerClassName="fab-menu-item"
                    triggerIcon={<NavigationGlyph name="bell" size={20} />}
                    onOpenChange={onNotificationsOpenChange}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            ref={fabRef}
            type="button"
            className="fab"
            aria-label={open ? 'Tutup pintasan' : unreadNotifications ? `Buka pintasan, ${unreadNotifications} notifikasi baru` : 'Buka pintasan'}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => open ? closeMenu() : setOpen(true)}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            initial={reduce ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? 'close' : 'logo'}
                className="fab-glyph"
                initial={reduce ? false : { opacity: 0, rotate: -60, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 60, scale: 0.6, transition: { duration: motionTokens.duration.fast } }}
                transition={spring}
              >
                {open ? <X size={26} strokeWidth={2.2} aria-hidden /> : <BrandMark size={26} />}
              </motion.span>
            </AnimatePresence>
            {!open && unreadNotifications > 0 && <span className="fab-badge" aria-hidden>{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
          </motion.button>
        </div>
      </nav>
    </>
  )
}
