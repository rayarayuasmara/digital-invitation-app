import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bell, House, ScanLine, Sparkles, UserPlus, UserRound, Users, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'
import { RadialBlur } from '@/components/RadialBlur'
import { motionTokens } from '@/components/arc/motion-tokens'

export type Tab = 'beranda' | 'tamu' | 'undangan' | 'akun'

const tabs: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'beranda', label: 'Beranda', icon: House },
  { value: 'tamu', label: 'Tamu', icon: Users },
  { value: 'undangan', label: 'Undangan', icon: Sparkles },
  { value: 'akun', label: 'Akun', icon: UserRound },
]

/** Shortcuts fan out along a quarter circle above the button, as in the speed-dial reference. */
const ARC_DEGREES = [90, 135, 180]
const ARC_RADIUS = 112

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
}

export function TabBar({ value, onChange, onScanner, onAddGuest, onNotifications }: Props) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const fabRef = useRef<HTMLButtonElement>(null)

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

  const toggle = () => {
    if (!open && fabRef.current) {
      const rect = fabRef.current.getBoundingClientRect()
      setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
    setOpen(o => !o)
  }

  const pick = (run: () => void) => {
    setOpen(false)
    run()
  }

  const changeTab = (tab: Tab) => {
    setOpen(false)
    onChange(tab)
  }

  const spring = reduce ? { duration: 0 } : motionTokens.spring.snappy

  return (
    <>
      <AnimatePresence>
        {open && <RadialBlur key="fab-blur" origin={origin} onDismiss={() => setOpen(false)} />}
      </AnimatePresence>

      <nav className="tabbar-wrap" aria-label="Menu utama">
        <div className={`ios-tabbar${open ? ' is-hidden' : ''}`}>
          {tabs.map(t => {
            const Icon = t.icon
            const active = t.value === value
            return (
              <button
                key={t.value}
                type="button"
                className={`ios-tab ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => changeTab(t.value)}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 2} aria-hidden />
                <span>{t.label}</span>
              </button>
            )
          })}
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
                  <Icon size={22} strokeWidth={2.1} aria-hidden />
                </motion.button>
              )
            })}
          </AnimatePresence>

          <motion.button
            ref={fabRef}
            type="button"
            className="fab"
            aria-label={open ? 'Tutup pintasan' : 'Buka pintasan'}
            aria-expanded={open}
            onClick={toggle}
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
