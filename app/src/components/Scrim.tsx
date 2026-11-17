import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { motionTokens } from '@/components/arc/motion-tokens'

type Props = {
  onDismiss?: () => void
}

/** A flat dim behind an open menu. No backdrop blur, so it stays cheap on low-end phones. */
export function Scrim({ onDismiss }: Props) {
  return createPortal(
    <motion.div
      className="scrim"
      aria-hidden="true"
      onPointerDown={onDismiss}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: motionTokens.duration.fast }}
    />,
    document.body,
  )
}
