import { CircleHelp, House, Plus, ScanLine, Share2, Sparkles, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { TabBar as GlassTabBar } from 'glisse'

export type Tab = 'beranda' | 'tamu' | 'undangan' | 'akun'

const tabs: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'beranda', label: 'Beranda', icon: House },
  { value: 'tamu', label: 'Tamu', icon: Users },
  { value: 'undangan', label: 'Undangan', icon: Sparkles },
  { value: 'akun', label: 'Akun', icon: UserRound },
]

const fabIcon: Record<Tab, { icon: LucideIcon; label: string }> = {
  beranda: { icon: ScanLine, label: 'Buka scanner' },
  tamu: { icon: Plus, label: 'Tambah tamu' },
  undangan: { icon: Share2, label: 'Salin tautan pratinjau' },
  akun: { icon: CircleHelp, label: 'Bantuan' },
}

type Props = {
  value: Tab
  onChange: (tab: Tab) => void
  onAction: () => void
}

export function TabBar({ value, onChange, onAction }: Props) {
  const reduce = useReducedMotion()
  const action = fabIcon[value]
  const ActionIcon = action.icon

  return (
    <nav className="tabbar-wrap" aria-label="Menu utama">
      <GlassTabBar
        className="home-tabbar"
        aria-label="Menu utama"
        value={value}
        onValueChange={next => onChange(next as Tab)}
        items={tabs.map(t => {
          const Icon = t.icon
          return {
            value: t.value,
            label: t.label,
            icon: <Icon size={26} strokeWidth={2} aria-hidden />,
          }
        })}
      />
      <motion.button
        key={value}
        type="button"
        className="fab"
        aria-label={action.label}
        onClick={onAction}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        initial={reduce ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <ActionIcon size={24} strokeWidth={2.2} aria-hidden />
      </motion.button>
    </nav>
  )
}
