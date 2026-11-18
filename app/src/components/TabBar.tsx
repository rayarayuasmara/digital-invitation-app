import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { House, MailOpen, ScanLine, UserPlus, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { ChatBubbleIcon } from '@/components/ChatBubbleIcon'
import { Scrim } from '@/components/Scrim'
import { LiquidTabBar } from '@/components/arc/liquid-tab-bar/liquid-tab-bar'
import { NotificationCenter } from '@/components/arc/notification-center/notification-center'
import type { NotificationItem } from '@/components/arc/notification-center/notification-center'
import { motionTokens } from '@/components/arc/motion-tokens'

export type Tab = 'beranda' | 'tamu' | 'ucapan' | 'undangan'

/** Shared stroke for every tab icon, so they read as one family. */
const ICON_STROKE = 1.9

const ARC_DEGREES = [90, 135, 180]
const ARC_RADIUS = 92

function arcOffset(index: number) {
  const angle = (ARC_DEGREES[index] * Math.PI) / 180
  return { x: Math.round(Math.cos(angle) * ARC_RADIUS), y: Math.round(-Math.sin(angle) * ARC_RADIUS) }
}

type Props = {
  value: Tab
  onChange: (tab: Tab) => void
  onScanner: () => void
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

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const shortcuts: { label: string; icon: LucideIcon; run: () => void }[] = [
    { label: 'Scanner', icon: ScanLine, run: onScanner },
    { label: 'Tambah tamu', icon: UserPlus, run: onAddGuest },
  ]

  const pick = (run: () => void) => {
    setOpen(false)
    run()
  }

  const changeTab = (tab: Tab) => {
    setOpen(false)
    onChange(tab)
  }

  const spring = reduce ? { duration: 0 } : motionTokens.spring.snappy

  // One outline style for every tab. The lens already marks the selected tab by inverting it,
  // so the icons never swap to solid shapes (solid lucide glyphs look blobby next to outlines).
  const tabs = [
    { value: 'beranda', label: 'Beranda', icon: <House strokeWidth={ICON_STROKE} /> },
    { value: 'tamu', label: 'Tamu', icon: <Users strokeWidth={ICON_STROKE} /> },
    {
      value: 'ucapan',
      label: 'Ucapan',
      icon: <ChatBubbleIcon strokeWidth={ICON_STROKE} />,
      badge: unreadWishes,
      badgeLabel: `${unreadWishes} ucapan belum dibaca`,
    },
    { value: 'undangan', label: 'Undangan', icon: <MailOpen strokeWidth={ICON_STROKE} /> },
  ]

  return (
    <>
      <AnimatePresence>
        {open && <Scrim key="fab-scrim" onDismiss={() => setOpen(false)} />}
      </AnimatePresence>

      <nav className="tabbar-wrap" aria-label="Menu utama">
        <div className={`tabbar-shell${open ? ' is-hidden' : ''}`}>
          <LiquidTabBar tabs={tabs} value={value} onValueChange={tab => changeTab(tab as Tab)} label="Menu utama" />
        </div>

        <div className="fab-wrap">
          <AnimatePresence>
            {open && shortcuts.map((item, index) => {
              const Icon = item.icon
              const pos = arcOffset(index)
              return (
                <motion.button
                  key={item.label}
                  type="button"
                  className="fab-menu-item"
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => pick(item.run)}
                  initial={reduce ? false : { x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{ x: pos.x, y: pos.y, opacity: 1, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  transition={reduce ? { duration: 0 } : { ...spring, delay: index * 0.035 }}
                  whileTap={reduce ? undefined : { scale: 0.92 }}
                >
                  <Icon size={24} strokeWidth={2.1} aria-hidden />
                </motion.button>
              )
            })}
            {open && (
              <motion.div
                key="notifikasi"
                className="fab-menu-item fab-menu-notif"
                initial={reduce ? false : { x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{ x: arcOffset(2).x, y: arcOffset(2).y, opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { x: 0, y: 0, opacity: 0, scale: 0.4 }}
                transition={reduce ? { duration: 0 } : { ...spring, delay: 2 * 0.035 }}
              >
                <NotificationCenter
                  key={notifKey}
                  notifications={notifications}
                  label="Notifikasi"
                  onOpenChange={onNotificationsOpenChange}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            className="fab"
            aria-label={open ? 'Tutup pintasan' : unreadNotifications ? `Buka pintasan, ${unreadNotifications} notifikasi baru` : 'Buka pintasan'}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            initial={reduce ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
            {!open && unreadNotifications > 0 && <span className="fab-badge" aria-hidden>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
          </motion.button>
        </div>
      </nav>
    </>
  )
}
