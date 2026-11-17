import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { motion } from 'motion/react'
import { motionTokens } from '@/components/arc/motion-tokens'

type Props = {
  /** Viewport point the blur radiates from, such as the centre of the button that opened the menu. */
  origin: { x: number; y: number }
  onDismiss?: () => void
}

/** Progressive radial blur. Strongest at the origin, fading out so the page stays readable at the edges. */
export function RadialBlur({ origin, onDismiss }: Props) {
  return createPortal(
    <motion.div
      className="radial-blur"
      aria-hidden="true"
      style={{ '--ox': `${origin.x}px`, '--oy': `${origin.y}px` } as CSSProperties}
      onPointerDown={onDismiss}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: motionTokens.duration.standard }}
    />,
    document.body,
  )
}
