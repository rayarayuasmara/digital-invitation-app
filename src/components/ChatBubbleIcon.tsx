type Props = {
  size?: number
  strokeWidth?: number
  /** Solid bubble with knocked-out dots, drawn where the lens sits on the tab. */
  filled?: boolean
}

const BUBBLE = 'M7 17.5 L4 20 V7 A4 4 0 0 1 8 3 H16 A4 4 0 0 1 20 7 V13 A4 4 0 0 1 16 17 Z'

/** A speech bubble with three dots. Outline at rest, solid when selected. */
export function ChatBubbleIcon({ size = 24, strokeWidth = 2, filled = false }: Props) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        <path fillRule="evenodd" d={`${BUBBLE} M8.4 10.6 a1.3 1.3 0 1 0 0.01 0 Z M12 10.6 a1.3 1.3 0 1 0 0.01 0 Z M15.6 10.6 a1.3 1.3 0 1 0 0.01 0 Z`} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d={BUBBLE} />
      <circle cx="8.4" cy="10.4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.4" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="10.4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
