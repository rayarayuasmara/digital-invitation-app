import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useCollapseProgress } from '@/lib/hooks/use-collapse-progress'
import { initialsName } from '@/lib/text'

type Props = {
  title: string
  /** Sits under the header and scrolls away with the content. */
  subtitle?: ReactNode
  /** Opens the account tab from an avatar with the owner's initials. */
  account?: { name: string; onOpen: () => void }
  /** Sticky headers collapse on scroll. A static header scrolls away with the content. */
  sticky?: boolean
}

export function PageAccountButton({ account, className }: { account: NonNullable<Props['account']>; className?: string }) {
  return (
    <button type="button" className={['page-head-avatar', className].filter(Boolean).join(' ')} onClick={account.onOpen} aria-label={`Akun ${account.name}`}>
      <span className="page-head-avatar-mark" aria-hidden="true">
        {initialsName(account.name).split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
      </span>
    </button>
  )
}

/**
 * Tab header. The large title sits at the left; on scroll it shrinks and glides
 * to the centre of a progressive-blur bar that sticks to the top of the viewport.
 */
export function PageHeader({ title, subtitle, account, sticky = true }: Props) {
  const ref = useRef<HTMLElement>(null)
  useCollapseProgress(ref, 44, sticky)

  return (
    <>
      <header ref={ref} className={sticky ? 'page-head' : 'page-head is-static'}>
        <span className="progressive-blur page-head-glass" aria-hidden="true" />
        <h1 className="page-title">{title}</h1>
        {account && <PageAccountButton account={account} />}
      </header>
      {subtitle && <div className="page-head-sub">{subtitle}</div>}
    </>
  )
}
