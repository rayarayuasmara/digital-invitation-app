import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bell, House, ScanLine, Sparkles, UserPlus, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { ChatBubbleIcon } from '@/components/ChatBubbleIcon'
import { Scrim } from '@/components/Scrim'
import { LiquidTabBar } from '@/components/arc/liquid-tab-bar/liquid-tab-bar'
import { motionTokens } from '@/components/arc/motion-tokens'

export type Tab = 'beranda' | 'tamu' | 'ucapan' | 'undangan'

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
  onNotifications: () => void
  /** Wishes the host has not read yet, shown on the Ucapan tab. */
  unreadWishes?: number
}

export function TabBar({ value, onChange, onScanner, onAddGuest, onNotifications, unreadWishes = 0 }: Props) {
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
    { label: 'Notifikasi', icon: Bell, run: onNotifications },
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

  const tabs = [
    { value: 'beranda', label: 'Beranda', icon: <House />, activeIcon: <House fill="currentColor" /> },
    { value: 'tamu', label: 'Tamu', icon: <Users />, activeIcon: <Users fill="currentColor" /> },
    {
      value: 'ucapan',
      label: 'Ucapan',
      icon: <ChatBubbleIcon />,
      activeIcon: <ChatBubbleIcon filled />,
      badge: unreadWishes,
      badgeLabel: `${unreadWishes} ucapan belum dibaca`,
    },
    { value: 'undangan', label: 'Undangan', icon: <Sparkles />, activeIcon: <Sparkles fill="currentColor" /> },
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
          </AnimatePresence>

          <motion.button
            type="button"
            className="fab"
            aria-label={open ? 'Tutup pintasan' : 'Buka pintasan'}
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
          </motion.button>
        </div>
      </nav>
    </>
  )
}
