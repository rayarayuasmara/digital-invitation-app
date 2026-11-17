import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Writes scroll progress (0 at the top, 1 once `distance` px have scrolled) to `--p`
 * on the element. Styles interpolate the header with that variable, so scrolling
 * never triggers a React render.
 */
export function useCollapseProgress(ref: RefObject<HTMLElement | null>, distance = 44, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const update = () => {
      frame = 0
      const p = Math.min(1, Math.max(0, window.scrollY / distance))
      ref.current?.style.setProperty('--p', p.toFixed(3))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, distance, enabled])
}
