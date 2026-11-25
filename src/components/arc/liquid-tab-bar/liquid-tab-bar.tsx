import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import type { MotionValue } from 'motion/react'
import styles from './liquid-tab-bar.module.css'

export type LiquidTab = {
  value: string
  label: string
  icon: ReactNode
  /** Drawn where the tab is selected or the lens passes over it. Falls back to `icon`. */
  activeIcon?: ReactNode
  badge?: number
  badgeLabel?: string
}

export interface LiquidTabBarProps {
  tabs: LiquidTab[]
  value: string
  onValueChange: (value: string) => void
  /** Which tabs show their label: the selected one, every tab, or none. */
  labels?: 'active' | 'always' | 'none'
  label?: string
  id?: string
  className?: string
}

export function liquidTabId(id: string, value: string) {
  return `${id}-tab-${value}`
}

/** Inset between the bar's edge and the tabs. The lens and the inverted copy use the same inset. */
const PAD = 6
const spring = { type: 'spring', stiffness: 480, damping: 42, mass: 0.9 } as const
/** Pointer movement before a press counts as a drag rather than a tap. */
const DRAG_SLOP = 4

type Geometry = { x: number; width: number }

/** How much of a tab the lens covers, from 0 to 1. Drives the outline-to-filled crossfade. */
function coverage(lensX: number, lensWidth: number, tab: Geometry | undefined) {
  if (!tab || tab.width <= 0) return 0
  const overlap = Math.min(lensX + lensWidth, tab.x + tab.width) - Math.max(lensX, tab.x)
  return Math.min(1, Math.max(0, overlap / tab.width))
}

/** Outline icon with a filled twin on top. `fill` (0 to 1) drives the crossfade. */
function Slot({ tab, showLabel, fill }: { tab: LiquidTab; showLabel: boolean; fill?: MotionValue<number> }) {
  const hasFill = tab.activeIcon !== undefined && fill !== undefined
  const fallback = useMotionValue(0)
  const outline = useTransform(fill ?? fallback, f => (hasFill ? 1 - f : 1))
  return (
    <span className={`${styles.slot}${showLabel ? ' ' + styles.labeled : ''}`}>
      <span className={styles.icon}>
        <motion.span className={styles.layer} style={{ opacity: outline }}>{tab.icon}</motion.span>
        {hasFill && (
          <motion.span className={`${styles.layer} ${styles.fillLayer}`} style={{ opacity: fill }}>{tab.activeIcon}</motion.span>
        )}
        {tab.badge ? <span className={styles.badge} aria-hidden>{tab.badge > 99 ? '99+' : tab.badge}</span> : null}
      </span>
      <span className={styles.labelSlot} aria-hidden={!showLabel || undefined}>
        <span className={styles.labelText}>{tab.label}</span>
      </span>
    </span>
  )
}

/** A real tab. Its fill follows whether it is selected, and the outline swaps for the filled icon. */
const BaseTab = forwardRef<HTMLButtonElement, {
  tab: LiquidTab
  active: boolean
  showLabel: boolean
  id: string
  onPick: (fromPointer: boolean) => void
}>(function BaseTab({ tab, active, showLabel, id, onPick }, ref) {
  const fill = useMotionValue(active ? 1 : 0)
  useEffect(() => {
    fill.set(active ? 1 : 0)
  }, [active, fill])
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={tab.badge ? `${tab.label}, ${tab.badgeLabel ?? tab.badge}` : tab.label}
      tabIndex={active ? 0 : -1}
      className={`${styles.tab}${active ? ' ' + styles.active : ''}`}
      onClick={event => onPick(event.detail !== 0)}
    >
      <Slot tab={tab} showLabel={showLabel} fill={fill} />
    </button>
  )
})

/** One slot of the inverted copy. Its fill follows how much of the tab the lens covers. */
function InvertedSlot({ tab, showLabel, lensX, lensWidth, geometry }: {
  tab: LiquidTab
  showLabel: boolean
  lensX: MotionValue<number>
  lensWidth: MotionValue<number>
  geometry: { current: Map<string, Geometry> }
}) {
  const fill = useTransform([lensX, lensWidth], ([x, w]: number[]) => coverage(x, w, geometry.current.get(tab.value)))
  return <Slot tab={tab} showLabel={showLabel} fill={fill} />
}

/**
 * Tabs with a lens that slides between them. The lens holds an inverted copy of the row,
 * clipped to its own shape, so the labels and icons it passes over flip colour.
 */
export function LiquidTabBar({ tabs, value, onValueChange, labels = 'active', label = 'Sections', id, className }: LiquidTabBarProps) {
  const generated = useId()
  const baseId = id ?? `liquid-${generated.replace(/[:]/g, '')}`
  const reduce = !!useReducedMotion()

  const trackRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const geometry = useRef(new Map<string, Geometry>())
  const valueRef = useRef(value)
  const suppressClick = useRef(false)
  const drag = useRef<{ pointerId: number; tab: string; startX: number; origin: number; moved: boolean; samples: { x: number; t: number }[] } | null>(null)
  const settleTimer = useRef<number | undefined>(undefined)

  const x = useMotionValue(0)
  const width = useMotionValue(0)
  const lift = useMotionValue(0)
  const scaleX = useTransform(lift, [0, 1], [1, 1.18])
  const scaleY = useTransform(lift, [0, 1], [1, 1.15])
  const reflection = useTransform(lift, [0, 1], [0, 1])
  const innerX = useTransform(x, v => -v)
  const [innerWidth, setInnerWidth] = useState(0)

  const tabKey = tabs.map(t => t.value).join('|')
  const activeIndex = Math.max(0, tabs.findIndex(t => t.value === value))

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setInnerWidth(track.clientWidth - PAD * 2)
    const trackRect = track.getBoundingClientRect()
    const next = new Map<string, Geometry>()
    tabRefs.current.forEach((node, key) => {
      // The slot is the visible handle, so the lens hugs the icon and label, not the whole tab.
      const slot = (node.firstElementChild as HTMLElement | null) ?? node
      const rect = slot.getBoundingClientRect()
      next.set(key, { x: rect.left - trackRect.left, width: rect.width })
    })
    geometry.current = next
  }, [])

  const place = useCallback((target: string, immediate = false) => {
    const g = geometry.current.get(target)
    if (!g) return
    if (immediate || reduce) {
      x.set(g.x)
      width.set(g.width)
      return
    }
    animate(x, g.x, spring)
    animate(width, g.width, spring)
  }, [reduce, x, width])

  useLayoutEffect(() => {
    measure()
    place(value, true)
    // Mount only: later selections animate from the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    valueRef.current = value
    if (drag.current) return
    measure()
    place(value)
  }, [value, labels, tabKey, measure, place])

  // Tabs change width while the selected label opens, so the lens follows every resize.
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (drag.current) return
      measure()
      place(valueRef.current)
    })
    observer.observe(track)
    tabRefs.current.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [tabKey, labels, measure, place])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  const lowerLens = (delay = 0) => {
    window.clearTimeout(settleTimer.current)
    if (reduce) return
    const lower = () => animate(lift, 0, spring)
    if (delay) settleTimer.current = window.setTimeout(lower, delay)
    else lower()
  }

  const bounds = () => {
    const order = tabs.map(t => geometry.current.get(t.value)).filter((g): g is Geometry => !!g)
    if (order.length === 0) return { min: 0, max: 0 }
    const first = order[0]
    const last = order[order.length - 1]
    return { min: first.x, max: last.x + last.width - width.get() }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Every new press starts with a clean slate. A drag that ended on the track
    // (pointer capture) never fires a click to clear the flag, so reset it here.
    if (event.button !== 0 || !event.isPrimary || drag.current) return
    suppressClick.current = false
    const button = (event.target as Element).closest('[role="tab"]')
    const tab = tabs.find(item => tabRefs.current.get(item.value) === button)
    if (!tab) return
    window.clearTimeout(settleTimer.current)
    drag.current = { pointerId: event.pointerId, tab: tab.value, startX: event.clientX, origin: x.get(), moved: false, samples: [{ x: event.clientX, t: performance.now() }] }
    if (!reduce) {
      animate(lift, 1, spring)
      place(tab.value)
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    if (!state.moved && Math.abs(event.clientX - state.startX) > DRAG_SLOP) {
      x.stop()
      width.stop()
      state.origin = x.get()
      state.startX = event.clientX
      state.moved = true
      trackRef.current?.setPointerCapture(event.pointerId)
    }
    if (!state.moved) return
    const now = performance.now()
    state.samples.push({ x: event.clientX, t: now })
    // Only the last 100ms count, so a pause before release reads as a stop, not a flick.
    while (state.samples.length > 2 && now - state.samples[0].t > 100) state.samples.shift()
    const { min, max } = bounds()
    x.set(Math.min(Math.max(state.origin + event.clientX - state.startX, min), max))
  }

  const releaseDrag = (pointerId: number) => {
    drag.current = null
    if (trackRef.current?.hasPointerCapture(pointerId)) trackRef.current.releasePointerCapture(pointerId)
  }

  // The system cancelled the gesture (scroll takeover, incoming call...). Snap back to the
  // selected tab and do not change the selection.
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    releaseDrag(event.pointerId)
    lowerLens()
    place(valueRef.current)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    releaseDrag(event.pointerId)
    lowerLens(state.moved ? 0 : 85)
    if (!state.moved) {
      // A native click commits the tab; a release outside simply restores selection.
      const target = (event.target as Element).closest('[role="tab"]')
      if (tabRefs.current.get(state.tab) !== target) place(valueRef.current)
      return
    }

    suppressClick.current = true
    const first = state.samples[0]
    const last = state.samples[state.samples.length - 1]
    const elapsed = Math.max(1, last.t - first.t)
    const velocity = (last.x - first.x) / elapsed
    // Land on the tab the lens is actually over. Velocity only breaks ties when the
    // drag stopped short, so a release over a tab never coasts past it.
    const centre = x.get() + width.get() / 2
    let nearest = tabs[activeIndex].value
    let best = Infinity
    tabs.forEach(tab => {
      const g = geometry.current.get(tab.value)
      if (!g) return
      const distance = Math.abs(g.x + g.width / 2 - centre)
      if (distance < best) { best = distance; nearest = tab.value }
    })
    // A quick flick from the starting tab always moves at least one tab.
    if (Math.abs(velocity) > 0.4 && nearest === value) {
      const step = velocity > 0 ? 1 : -1
      nearest = tabs[Math.min(tabs.length - 1, Math.max(0, activeIndex + step))].value
    }
    if (nearest !== value) onValueChange(nearest)
    place(nearest)
  }

  const onTabClick = (key: string, fromPointer: boolean) => {
    if (suppressClick.current && fromPointer) {
      suppressClick.current = false
      return
    }
    onValueChange(key)
    place(key)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1
    let next = activeIndex
    if (event.key === 'ArrowRight') next = activeIndex === last ? 0 : activeIndex + 1
    else if (event.key === 'ArrowLeft') next = activeIndex === 0 ? last : activeIndex - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else return
    event.preventDefault()
    onValueChange(tabs[next].value)
    tabRefs.current.get(tabs[next].value)?.focus()
  }

  return (
    <div className={`${styles.bar}${className ? ' ' + className : ''}`} data-labels={labels}>
      <div
        ref={trackRef}
        className={styles.track}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onPointerLeave={event => {
          if (!drag.current?.moved) onPointerCancel(event)
        }}
      >
        {tabs.map(tab => {
          const active = tab.value === value
          return (
            <BaseTab
              key={tab.value}
              ref={node => { if (node) tabRefs.current.set(tab.value, node); else tabRefs.current.delete(tab.value) }}
              tab={tab}
              active={active}
              showLabel={labels === 'always' || (labels === 'active' && active)}
              id={liquidTabId(baseId, tab.value)}
              onPick={fromPointer => onTabClick(tab.value, fromPointer)}
            />
          )
        })}

        {/* The lens: an inverted copy of the row, clipped to the moving shape. */}
        <motion.div className={styles.lens} aria-hidden style={{ x, width, scaleX, scaleY }}>
          <motion.div className={styles.reflection} style={{ opacity: reflection }} />
          <motion.div className={styles.invertedRow} style={{ x: innerX, width: innerWidth }}>
            {tabs.map(tab => {
              const active = tab.value === value
              const showLabel = labels === 'always' || (labels === 'active' && active)
              return (
                <span key={tab.value} className={`${styles.invTab}${active ? ' ' + styles.invActive : ''}`}>
                  <InvertedSlot tab={tab} showLabel={showLabel} lensX={x} lensWidth={width} geometry={geometry} />
                </span>
              )
            })}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
